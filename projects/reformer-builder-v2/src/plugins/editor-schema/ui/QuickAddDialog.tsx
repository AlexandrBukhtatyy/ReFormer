/**
 * Быстрое добавление компонента: широкий диалог с поиском и сеткой карточек.
 *
 * Возвращает возможность первой версии, но не её вёрстку. Там каталог раскладывался по колонкам
 * ВРУЧНУЮ — с подсчётом строк, переносом разделов и «продолжениями» сверху следующей колонки;
 * это полторы сотни строк арифметики ради того, что сегодня делает `grid` с `auto-fill`. Здесь
 * раскладку считает браузер, а код знает про неё ровно одно число — сколько карточек влезло
 * в строку, и то измерением, а не формулой.
 *
 * ## Число колонок ИЗМЕРЯЕТСЯ, а не выводится
 *
 * Ширину карточки задаёт `minmax` в стилях, ширину сетки — раскладка оболочки, зазор — тема кита.
 * Вывести число колонок из этих трёх величин можно, но любая правка стилей сделает вывод
 * неверным молча. Поэтому оно считается по DOM: сколько карточек стоит на одной строке
 * с первой. Пересчитывается на изменение размера и на смену выдачи — больше поводов нет.
 *
 * ## Высота не зависит от запроса
 *
 * Область прокрутки меряется по ПОЛНОЙ выдаче и держит эту высоту, пока диалог открыт.
 * Считать её по текущей выдаче кажется естественным — окно ровно под содержимое, — но тогда
 * диалог менял бы размер под руками у того, кто печатает: три буквы, и он схлопнулся до одной
 * карточки, стёр их — распахнулся обратно. Пустое место под короткой выдачей дешевле, чем
 * поверхность, скачущая от каждого нажатия.
 *
 * ## Куда встанет компонент
 *
 * Туда же, куда его поставил бы щелчок в палитре: правило одно ({@link placementFor}) и живёт
 * отдельно от обеих поверхностей. Иначе «добавить Input» означало бы разное в панели и в диалоге.
 *
 * @module plugins/editor-schema/ui/QuickAddDialog
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@reformer/ui-kit/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@reformer/ui-kit/dialog';
import { Input } from '@reformer/ui-kit/input';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { NavDir } from '@/lib/form-model/query';
import { insertOp } from '../ops';
import { paletteNode } from '../palette-model';
import { placementFor } from '../placement';
import { gridTarget, quickAddView, type QuickAddItem } from '../quick-add';
import type { Translate } from '../host';
import type { SchemaEditorState, SchemaSession } from '../sessions';

export interface QuickAddDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly session: SchemaSession;
  readonly state: SchemaEditorState;
  readonly t: Translate;
  readonly catalog: readonly CatalogEntry[];
  /** Порядок разделов из конфига клиента; без него — умолчание домена. */
  readonly order?: readonly string[];
}

/**
 * Предел высоты сетки — доля высоты окна.
 *
 * Функция, а не константа: окно меняют размером, и число, снятое при загрузке модуля,
 * осталось бы от прошлого размера экрана. В окружении без `window` (серверный разбор)
 * берётся разумное значение, чтобы код не падал на импорте.
 */
const MAX_VIEWPORT_HEIGHT = (): number =>
  typeof window === 'undefined' ? 480 : Math.round(window.innerHeight * 0.6);

/** Стрелка → направление обхода сетки. Прочие клавиши диалог отдаёт полю ввода. */
const ARROW_DIRECTIONS: Readonly<Record<string, NavDir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function QuickAddDialog({
  open,
  onClose,
  session,
  state,
  t,
  catalog,
  order,
}: QuickAddDialogProps): ReactElement {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [columns, setColumns] = useState(1);
  /** Высота сетки при ПОЛНОЙ выдаче; `null` — ещё не измеряли. */
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const view = useMemo(() => quickAddView(catalog, query, order), [catalog, query, order]);
  const total = view.flat.length;
  /**
   * Сужена ли выдача запросом — признак, а не сам запрос: от него зависит только то, годится ли
   * сетка в мерку высоты, и пересобирать наблюдателя на каждый набранный символ незачем.
   */
  const filtered = query !== '';

  // Каждое открытие начинается с чистого поиска: диалог вызывают, чтобы добавить компонент
  // СЕЙЧАС, а не чтобы вернуться к прошлому запросу.
  //
  // Правка во время ОТРИСОВКИ, а не в эффекте: это состояние производное от пропа, и эффект
  // здесь дал бы лишний каскад — первый кадр со старым запросом, второй с пустым. React такую
  // подстройку поддерживает прямо: он перезапускает отрисовку до коммита, ничего не показав.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }

  // Курсор не должен пережить сужение выдачи: после набора символа записей стало меньше,
  // и прежний индекс указывал бы за конец списка. Зажимаем при ЧТЕНИИ, а не правим состояние:
  // хранимое значение переживает временное сужение, и курсор возвращается на место, когда
  // символ стирают.
  const active = Math.min(cursor, Math.max(total - 1, 0));

  /**
   * Сколько карточек стоит в одной строке и какой высоты вся сетка — измерением, а не формулой.
   *
   * Высота нужна затем же, зачем колонки: область прокрутки кита ставит своему окну
   * `height: 100%`, а сто процентов от `max-height` — это `auto`, то есть предела нет вовсе
   * и прокрутка не включается: содержимое просто вылезает из диалога. Определённая высота
   * ставит предел, а «по содержимому, но не больше доли экрана» иначе не выразить.
   *
   * Под запросом высота не снимается (см. шапку модуля) — только колонки: их число задаёт
   * ширина, а она от запроса не зависит. Плата за это одна: если окно браузера меняют шириной,
   * пока фильтр набран, высота полной выдачи остаётся от прежней ширины — до тех пор, пока
   * запрос не сотрут. Сама доля экрана при этом пересчитывается сразу (см. `viewportHeight`),
   * так что за пределы уменьшенного окна диалог не вылезет.
   */
  const measure = useCallback(() => {
    const grid = gridRef.current;
    if (grid === null) return;
    if (!filtered) setContentHeight(grid.scrollHeight);
    const cards = [...grid.querySelectorAll<HTMLElement>('[data-quick-index]')];
    if (cards.length === 0) return;
    const top = cards[0].getBoundingClientRect().top;
    // Сравнение с допуском: подпиксельные различия высоты дают разницу в доли пикселя,
    // а строгое равенство посчитало бы такую строку за несколько.
    const inRow = cards.filter((card) => Math.abs(card.getBoundingClientRect().top - top) < 2);
    setColumns(Math.max(inRow.length, 1));
  }, [filtered]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const grid = gridRef.current;
    if (grid === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => {
      observer.disconnect();
    };
  }, [open, measure, total]);

  // Курсор, уехавший за нижний край, надо показать — иначе стрелка выглядит несработавшей.
  useEffect(() => {
    gridRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const editable = state.syncState === 'synced';

  /**
   * Высота области прокрутки: по полной выдаче, пока она помещается в отведённую долю экрана.
   *
   * До первого измерения — предел: показать высокий диалог и сжать его следующим кадром
   * лучше, чем показать схлопнутый и растянуть, — второе читается как подскок вёрстки. И то
   * и другое случается внутри `useLayoutEffect`, то есть до отрисовки, так что глаз замены
   * не видит; видел бы он ровно то, чего здесь нет, — изменение размера от набора запроса.
   *
   * Долю экрана считаем каждым рендером, а не один раз: окно браузера могли уменьшить, и тогда
   * запомненная высота полной выдачи обязана уступить новому пределу — иначе сетка вылезет
   * за нижний край диалога.
   */
  const limit = MAX_VIEWPORT_HEIGHT();
  const viewportHeight = Math.min(contentHeight ?? limit, limit);

  const insert = useCallback(
    (item: QuickAddItem | undefined) => {
      if (item === undefined || !editable) return;
      const { model, selection } = state;
      // Тот же путь, что у щелчка в палитре: правило вставки одно на обе поверхности.
      session.apply(insertOp(paletteNode(item.entry), placementFor(model, selection)));
      onClose();
    },
    [editable, onClose, session, state]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const dir = ARROW_DIRECTIONS[event.key];
      if (dir !== undefined) {
        // Стрелки принадлежат сетке, а не полю ввода и не канвасу под диалогом: каретка
        // в однострочном поле никуда не едет, а канвас про открытый диалог не знает.
        event.preventDefault();
        event.stopPropagation();
        setCursor(gridTarget(active, total, columns, dir));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        insert(view.flat[active]);
      }
    },
    [active, columns, insert, total, view.flat]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape, крестик и щелчок по подложке — отказ добавить. Отдельного «отменить» нет:
        // диалог ничего не меняет до самого выбора.
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-3 sm:max-w-4xl"
        onKeyDown={onKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="text-sm">{t('quick-add.title')}</DialogTitle>
        </DialogHeader>

        <div className="relative flex-none">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            autoFocus
            value={query}
            placeholder={t('quick-add.search')}
            aria-label={t('quick-add.search')}
            data-quick-search
            className="pl-8"
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
          />
        </div>

        {/* Высота числом, а не классом: «по содержимому, но не больше доли экрана» —
            это `min` из измеренной высоты сетки и предела, и оба слагаемых известны только
            в рантайме. Классом `max-h` область прокрутки кита предела не получает вовсе
            (см. {@link measure}), и сетка уезжает за нижний край диалога. */}
        <ScrollArea style={{ height: viewportHeight }} className="w-full">
          <div ref={gridRef} className="flex flex-col gap-4 pr-2">
            {total === 0 ? (
              <p className="text-muted-foreground px-1 py-8 text-center text-[12px]">
                {t('quick-add.empty')}
              </p>
            ) : (
              view.sections.map((section) => (
                <section key={section.category} className="flex flex-col gap-1.5">
                  <header className="flex items-baseline gap-2">
                    <h3 className="text-[12px] font-semibold">{section.category}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {section.items.length}
                    </Badge>
                  </header>
                  {/* `auto-fill` вместо ручной раскладки по колонкам: сколько влезет,
                      столько и будет, а сколько влезло — сообщит измерение. */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
                    {section.items.map((item) => (
                      <button
                        key={item.entry.name}
                        type="button"
                        data-quick-index={item.index}
                        data-active={item.index === active || undefined}
                        aria-label={t('palette.add', { name: item.entry.label })}
                        disabled={!editable}
                        onMouseMove={() => {
                          setCursor(item.index);
                        }}
                        onClick={() => {
                          insert(item);
                        }}
                        className={`flex min-w-0 flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
                          item.index === active
                            ? 'border-primary bg-accent'
                            : 'border-border hover:bg-accent/50'
                        }`}
                      >
                        <span className="w-full truncate text-[12.5px] font-medium">
                          {item.entry.label}
                        </span>
                        {/* Вторая строка — только когда она что-то добавляет: у `Input`
                            подпись и каталожное имя совпадают, и повторять его значит
                            занимать строку ничем. */}
                        {subtitleOf(item) !== null && (
                          <span className="text-muted-foreground w-full truncate font-mono text-[10px]">
                            {subtitleOf(item)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </ScrollArea>

        <p className="text-muted-foreground flex-none text-[11px]">{t('quick-add.hint')}</p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Вторая строка карточки — или `null`, если её нечем занять.
 *
 * Показываем метку варианта (`Пароль` у `InputPassword`), а если её нет — каталожное имя,
 * и только когда оно отличается от подписи: у большинства записей они совпадают.
 */
function subtitleOf(item: QuickAddItem): string | null {
  const { variant, name, label } = item.entry;
  if (variant !== undefined && variant !== '') return variant;
  return name === label ? null : name;
}
