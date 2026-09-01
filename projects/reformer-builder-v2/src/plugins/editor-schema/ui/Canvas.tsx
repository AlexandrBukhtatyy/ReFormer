/**
 * Канвас: дерево узлов схемы с выделением, наведением и клавиатурой.
 *
 * Компонент рисует ГОТОВЫЙ список строк ({@link flattenCanvas}) и не обходит модель сам —
 * весь разбор вложенности живёт в чистом модуле и проверяется без DOM. Здесь остаётся то,
 * что без браузера не проверить: щелчки, фокус и отступы.
 *
 * ## Что канвас делает сам, а что отдаёт командам
 *
 * Сам: выделение (щелчок, Shift, Ctrl), сворачивание веток, перемещение курсора стрелками,
 * приём броска. Отдаёт: удаление, дублирование, группировку, отмену — всё, что меняет модель
 * помимо перетаскивания.
 *
 * Своей панели инструментов у канваса нет вовсе. Структурные действия живут командами
 * с сочетаниями клавиш, а переключатель вида уехал в полосу вкладок
 * ({@link '../canvas/canvas-actions'}) — туда, где уже отвечают на вопрос «чем показан этот
 * документ». Полоса над деревом существовала ради двух кнопок и отнимала высоту у самой
 * схемы на каждой вкладке.
 *
 * ## Перетаскивание: решение принимает {@link planDrop}, канвас его только показывает
 *
 * Здесь остаётся ровно то, чего нет в чистом модуле: координата курсора, подсветка и признак
 * «груз наш». Во что превратится бросок — считает {@link planDrop}, и он же отвечает `null`
 * на запрещённый: тогда подсветки нет, и человек видит запрет ДО того, как отпустил кнопку.
 *
 * Груз берётся из сеанса перетаскивания, а не из `dataTransfer`: во время `dragover` тот
 * не читается вовсе (см. {@link './drag-session'}), а решать надо именно тогда.
 *
 * ## Свёрнутые ветки — состояние вида, и оно живёт вне компонента
 *
 * Реестр снимков ({@link CollapseRegistry}) записывается на КАЖДОЕ сворачивание, а не по
 * запросу оболочки: `viewState.capture` зовётся в уборке эффекта раскладки, когда тела
 * редактора на дереве может уже не быть. Подробности — в `./view-state`.
 *
 * ## Область объявляет себя канвасом
 *
 * `data-focus-zone="canvas"` — то, по чему оболочка отличает фокус на канвасе от фокуса
 * в поле ввода. Без него Delete, нажатый над деревом, считался бы нажатым «где-то в панели»,
 * и охранные условия команд перестали бы работать.
 *
 * ## Диагностика на строке узла
 *
 * Структурная находка адресована идентификатором узла, а строка канваса — это узел:
 * сведение прямое и ничего не ищет в тексте. Именно поэтому канвас показывает такую
 * находку ВСЕГДА, а подчёркивание в Monaco — не всегда (там идентификатор надо сперва
 * найти в буфере, а он попадает в файл только при первом сохранении).
 *
 * Находки, узла не называющие (ошибка разбора, «это не схема формы»), на строку не
 * ложатся — их число показано полосой над деревом, а сами они живут в панели проблем.
 * Молча терять их нельзя.
 *
 * ## Быстрое исправление — кнопкой на той же строке
 *
 * Узловая находка чинится там, где она видна: рядом с меткой встаёт кнопка на каждое
 * исправление, которому есть чем исполниться. «Есть чем» проверяется по реестру команд
 * НА КАЖДОЙ отрисовке и ещё раз перед вызовом: между публикацией находки и щелчком плагин,
 * владеющий командой, могли выключить, и кнопка, отказывающая при нажатии, хуже её отсутствия.
 *
 * @module plugins/editor-schema/ui/Canvas
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@reformer/ui-kit/item';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import type { CommandLookup, Diagnostic, QuickFix } from '@/sdk';
import { navTarget, type NavDir } from '@/lib/form-model/query';
import { canvasOrder, flattenCanvas, type CanvasRow } from '../canvas/canvas-tree';
import {
  canDropInside,
  dropPositionAt,
  planDrop,
  type DropPosition,
  type DropSpot,
} from '../editing/drag';
import { carriesSchemaNode, DRAG_MIME, type DragSession } from '../session/drag-session';
import {
  indexNodeDiagnostics,
  nodeFixes,
  nodeProblemTitle,
  unplacedCount,
  type NodeDiagnostics,
} from '../canvas/node-diagnostics';
import { indexNodes } from '../model/node-index';
import { selectNode, type SelectMode } from '../session/selection';
import type { CanvasPrefs } from '../session/canvas-prefs';
import { LiveView } from './LiveView';
import { SchematicView } from './SchematicView';
import { useCanvasPrefs } from './usePrefs';
import type { CollapseRegistry } from '../session/view-state';
import type { CommandAccess } from '../editing/commands';
import type { LivePreviewPort, NodeId, Translate } from '../host';
import type { SchemaEditorState, SchemaSession } from '../session/sessions';

/** Отступ уровня в пикселях. Динамическая величина, классом Tailwind невыразима. */
const INDENT_STEP = 14;
const INDENT_BASE = 8;

/** Стрелка → направление навигации домена. Прочие клавиши канвас не трогает. */
const ARROW_DIRECTIONS: Readonly<Record<string, NavDir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export interface CanvasProps {
  readonly session: SchemaSession;
  readonly state: SchemaEditorState;
  readonly t: Translate;
  /** Реестр команд: общая дверь с сочетаниями и ассистентом — и она же чинит находки. */
  readonly commands: CommandAccess;
  /** Свод диагностик документа. Пустой список — законное состояние, а не «ещё не пришло». */
  readonly problems?: readonly Diagnostic[];
  /**
   * Перевод кода диагностики словарём Host.
   *
   * Отдельный от `t` перевод, и это не дублирование: `t` знает словарь ПЛАГИНА,
   * а коды ошибок лежат в словаре Host — одна ошибка обязана выглядеть одинаково
   * здесь, в редакторе и в панели проблем.
   */
  readonly message?: Translate;
  /**
   * Подпись быстрого исправления — словарём Host, БЕЗ приставки `errors.`.
   *
   * Третий перевод в одном компоненте, и он третий не по недосмотру: `t` знает словарь
   * плагина, `message` приписывает коду находки `errors.`, а `QuickFix.titleKey` — уже
   * полный ключ общего словаря. Свести их значило бы либо промахнуться мимо ключа,
   * либо развести подписи одного исправления на канвасе и в панели проблем.
   */
  readonly fixTitle?: Translate;
  /**
   * Сеанс перетаскивания — общий с палитрой.
   *
   * Необязателен: без него канвас не берётся ни тащить, ни принимать, и остаётся ровно тем,
   * чем был до перетаскивания. Это состояние честное, а не поломка: тест, которому нужны
   * только клавиши, поднимает канвас без сеанса.
   */
  readonly drag?: DragSession | null;
  /** Реестр снимков вида. Без него свёрнутые ветки теряются при переключении вкладок. */
  readonly viewStates?: CollapseRegistry | null;
  /**
   * Предпочтения канваса: каким видом показан конструктор и видны ли обёртки.
   *
   * `null` — вид ровно один, дерево. Это законная сборка: тест, которому нужны только
   * клавиши, поднимает канвас без настроек, и переключателя у него просто нет.
   */
  readonly prefs?: CanvasPrefs | null;
  /**
   * Живой рендер формы — поверхность превью, отданная композицией.
   *
   * `null` означает, что вида «форма» нет вовсе: кнопки в полосе вкладок нет, а запомненное
   * предпочтение падает на дерево. Так бывает и в сборке без плагина превью, и в тесте
   * канваса, которому нужны только клавиши.
   */
  readonly live?: LivePreviewPort | null;
}

/** Пустой свод: одна ссылка вместо нового массива на каждую отрисовку. */
const NO_PROBLEMS: readonly Diagnostic[] = Object.freeze([]);

/** Пустой список исправлений — для строк без находок. */
const NO_FIXES: readonly QuickFix[] = Object.freeze([]);

/** Запасной перевод кода: сам код. Композиция вправе не давать словарь Host канвасу. */
const rawCode: Translate = (code) => code;

export function Canvas({
  session,
  state,
  t,
  commands,
  problems = NO_PROBLEMS,
  message = rawCode,
  fixTitle = rawCode,
  drag = null,
  viewStates = null,
  prefs = null,
  live = null,
}: CanvasProps): ReactElement {
  const prefsState = useCanvasPrefs(prefs);
  const documentId = session.documentId;
  // Снимок читается ОДИН раз, при монтировании: тело редактора пересоздаётся на пару
  // «редактор + документ», поэтому другого момента у него и нет.
  const [collapsed, setCollapsed] = useState<ReadonlySet<NodeId>>(
    () => new Set(viewStates?.peek(documentId) ?? [])
  );
  const [dropSpot, setDropSpot] = useState<DropSpot | null>(null);
  const { model, selection } = state;

  // Запись в реестр — на каждое изменение, а не по запросу оболочки: `capture` зовётся, когда
  // компонента на дереве может уже не быть, и спросить его будет нечем.
  useEffect(() => {
    viewStates?.record(documentId, collapsed);
  }, [viewStates, documentId, collapsed]);

  const rows = useMemo(
    () => flattenCanvas(model, { selection, collapsed }),
    [model, selection, collapsed]
  );

  // Указатель считается по своду, а не по строкам: находок единицы, строк сотни, и
  // обход свода на каждую строку дал бы произведение вместо суммы.
  const byNode = useMemo(() => indexNodeDiagnostics(problems), [problems]);
  const unplaced = unplacedCount(problems);

  const select = useCallback(
    (id: NodeId, mode: SelectMode) => {
      session.setSelection(selectNode(selection, id, mode, canvasOrder(rows)));
    },
    [session, selection, rows]
  );

  // Метод реестра берётся обёрткой, а не ссылкой: `usableFixes` зовут как обычную функцию,
  // и отвязанный метод чужого объекта потерял бы своё `this` на первой же чужой реализации.
  const hasCommand = useCallback((commandId: string) => commands.has(commandId), [commands]);

  const runFix = useCallback(
    (fix: QuickFix) => {
      // Проверка ПЕРЕД вызовом, хотя кнопка уже отобрана по реестру при отрисовке: между
      // отрисовкой и щелчком плагин, владеющий командой, могли выключить. Тишина здесь
      // честнее отказа посреди правки — кнопки в следующем кадре не будет вовсе.
      if (!commands.has(fix.commandId)) return;
      commands.run(fix.commandId, fix.args);
    },
    [commands]
  );

  const toggle = useCallback((id: NodeId) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  // Груз читается синхронно в обработчиках, поэтому свежая ссылка нужна без перерисовки.
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const editable = state.syncState === 'synced';

  const onRowDragStart = useCallback(
    (event: DragEvent<HTMLElement>, id: NodeId) => {
      const session = dragRef.current;
      if (session === null || !editable) {
        event.preventDefault();
        return;
      }
      session.begin({ kind: 'node', id });
      // Тип в `dataTransfer` — признак «груз наш»: только он и виден на `dragover`.
      event.dataTransfer.setData(DRAG_MIME, id);
      event.dataTransfer.effectAllowed = 'move';
    },
    [editable]
  );

  const endDrag = useCallback(() => {
    dragRef.current?.end();
    setDropSpot(null);
  }, []);

  /** Куда встал бы бросок и допустим ли он. `null` — сюда нельзя. */
  const spotUnder = useCallback(
    (event: DragEvent<HTMLElement>, id: NodeId): DropSpot | null => {
      const payload = dragRef.current?.payload() ?? null;
      if (payload === null || !editable) return null;
      const rect = event.currentTarget.getBoundingClientRect();
      const position = dropPositionAt(rect, event.clientY, canDropInside(model, id));
      const spot: DropSpot = { target: id, position };
      return planDrop(model, payload, spot) === null ? null : spot;
    },
    [editable, model]
  );

  const onRowDragOver = useCallback(
    (event: DragEvent<HTMLElement>, id: NodeId) => {
      if (!carriesSchemaNode(event.dataTransfer.types)) return;
      const spot = spotUnder(event, id);
      if (spot === null) {
        event.dataTransfer.dropEffect = 'none';
        setDropSpot((current) => (current === null ? current : null));
        return;
      }
      // Без этого браузер бросок не разрешит вовсе — и обработчик `drop` не позовётся.
      event.preventDefault();
      event.dataTransfer.dropEffect = dragRef.current?.payload()?.kind === 'new' ? 'copy' : 'move';
      setDropSpot((current) => (sameSpot(current, spot) ? current : spot));
    },
    [spotUnder]
  );

  const onRowDrop = useCallback(
    (event: DragEvent<HTMLElement>, id: NodeId) => {
      if (!carriesSchemaNode(event.dataTransfer.types)) return;
      event.preventDefault();
      const payload = dragRef.current?.payload() ?? null;
      const spot = spotUnder(event, id);
      endDrag();
      if (payload === null || spot === null) return;
      const op = planDrop(model, payload, spot);
      // Выделение переедет на перетащенный узел само: его называет `focus` операции.
      if (op !== null) session.apply(op);
    },
    [endDrag, model, session, spotUnder]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const dir = ARROW_DIRECTIONS[event.key];
      if (dir === undefined) return;
      // Стрелка с Ctrl/Cmd или Alt принадлежит КОМАНДЕ — перемещению и дублированию
      // (`plugins/editor-schema/commands`). Курсор её не трогает: иначе одно нажатие
      // делало бы два дела сразу — узел уезжал бы, и выделение уходило бы с него.
      // Shift исключением не является: он расширяет диапазон, и это работа курсора.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const current = selection[selection.length - 1];
      if (current === undefined) return;
      const index = indexNodes(model);
      const from = index.find(current);
      if (!from) return;
      const target = navTarget(model, from.path, dir);
      const id = target === null ? undefined : index.idAt(target);
      if (id === undefined) return;
      // Прокрутка страницы стрелками — не то, чего ждут от дерева с курсором.
      event.preventDefault();
      // Шаг «внутрь» свёрнутой ветки разворачивает её: курсор, уехавший на невидимую
      // строку, выглядит как несработавшая клавиша.
      if (!rows.some((row) => row.id === id)) {
        setCollapsed((collapsedNow) => {
          const next = new Set(collapsedNow);
          next.delete(current);
          return next;
        });
      }
      session.setSelection(
        selectNode(selection, id, event.shiftKey ? 'range' : 'replace', canvasOrder(rows))
      );
    },
    [model, selection, session, rows]
  );

  // Полосы над видом — общие: расхождение с текстом и находки без узла не зависят от того,
  // чем показана модель, и две их копии разошлись бы на первой же правке.
  const notices = (
    <>
      {state.syncState === 'diverged' && (
        <div className="bg-destructive/10 text-destructive px-3 py-1.5 text-[12px]">
          {t('canvas.diverged')}
        </div>
      )}
      {unplaced > 0 && (
        // Не «ошибка канваса», а честное указание: эти находки узла не называют,
        // и показать их строкой дерева нечем. Полностью они видны в панели проблем.
        <div className="text-muted-foreground px-3 py-1 text-[11px]">
          {t('canvas.problems.unplaced', { count: unplaced })}
        </div>
      )}
    </>
  );

  // Порт мог исчезнуть вместе с плагином превью, а предпочтение — приехать из сборки,
  // где он был. Падаем на дерево и не притворяемся, что показываем форму.
  if (prefsState.view === 'live' && live !== null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {notices}
        <LiveView session={session} state={state} t={t} live={live} drag={drag} />
      </div>
    );
  }

  if (prefsState.view === 'schematic') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {notices}
        <SchematicView
          session={session}
          state={state}
          t={t}
          commands={commands}
          problems={problems}
          message={message}
          fixTitle={fixTitle}
          drag={drag}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notices}
      <ScrollArea className="min-h-0 flex-1">
        <div
          role="tree"
          aria-label={t('canvas.label')}
          data-focus-zone="canvas"
          tabIndex={0}
          onKeyDown={onKeyDown}
          // Уход курсора за пределы дерева гасит подсветку. Проверка «ушёл ли наружу» нужна
          // потому, что `dragleave` прилетает и при переходе между строками и их значками.
          onDragLeave={(event) => {
            const to = event.relatedTarget;
            if (to instanceof Node && event.currentTarget.contains(to)) return;
            setDropSpot(null);
          }}
          onDrop={endDrag}
          className="outline-none"
        >
          {rows.length === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyTitle className="text-sm font-medium">{t('canvas.empty')}</EmptyTitle>
                <EmptyDescription className="text-xs">{t('palette.hint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup>
              {rows.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  t={t}
                  onSelect={select}
                  onToggle={toggle}
                  problems={byNode.get(row.id)}
                  message={message}
                  hasCommand={hasCommand}
                  fixTitle={fixTitle}
                  onFix={runFix}
                  draggable={drag !== null && editable}
                  dropPosition={dropSpot?.target === row.id ? dropSpot.position : null}
                  onDragStart={onRowDragStart}
                  onDragEnd={endDrag}
                  onDragOver={onRowDragOver}
                  onDrop={onRowDrop}
                />
              ))}
            </ItemGroup>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/** Строка дерева. Разметка та же, что у дерева ресурсов Host: одно дерево — один вид. */
function Row({
  row,
  t,
  onSelect,
  onToggle,
  problems,
  message,
  hasCommand,
  fixTitle,
  onFix,
  draggable,
  dropPosition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  row: CanvasRow;
  t: Translate;
  onSelect: (id: NodeId, mode: SelectMode) => void;
  onToggle: (id: NodeId) => void;
  problems: NodeDiagnostics | undefined;
  message: Translate;
  /** Есть ли команда исправления — спрашивается на каждой отрисовке строки. */
  hasCommand: CommandLookup;
  fixTitle: Translate;
  onFix: (fix: QuickFix) => void;
  draggable: boolean;
  /** Куда встанет бросок, если отпустить сейчас; `null` — сюда не бросают. */
  dropPosition: DropPosition | null;
  onDragStart: (event: DragEvent<HTMLElement>, id: NodeId) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>, id: NodeId) => void;
  onDrop: (event: DragEvent<HTMLElement>, id: NodeId) => void;
}): ReactElement {
  const base = 'relative cursor-pointer gap-1.5 rounded-none py-1 pr-2 text-[12px]';
  const tone = row.selected
    ? 'bg-accent text-accent-foreground'
    : dropPosition === 'inside'
      ? 'bg-accent/40'
      : 'hover:bg-accent/50';
  // Кольцо только у «внутрь»: у краёв роль играет полоса, а два признака сразу читались бы
  // как два разных предложения.
  const ring = dropPosition === 'inside' ? 'ring-primary ring-2 ring-inset' : '';
  // Отбор по реестру на КАЖДОЙ отрисовке: между публикацией находки и этим кадром плагин,
  // владеющий командой, могли выключить — тогда кнопки просто нет.
  const fixes = problems === undefined ? NO_FIXES : nodeFixes(problems, hasCommand);

  return (
    <Item
      size="sm"
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.expandable ? row.expanded : undefined}
      aria-selected={row.selected}
      data-selected={row.selected || undefined}
      data-node-id={row.id}
      data-drop={dropPosition ?? undefined}
      draggable={draggable || undefined}
      className={`${base} ${tone} ${ring}`}
      style={{ paddingLeft: INDENT_BASE + row.depth * INDENT_STEP }}
      onClick={(event) => {
        onSelect(row.id, modeOf(event));
      }}
      onDragStart={(event) => {
        onDragStart(event, row.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        onDragOver(event, row.id);
      }}
      onDrop={(event) => {
        onDrop(event, row.id);
      }}
    >
      {/* Полоса-указатель не перехватывает события: иначе `dragover` над ней считался бы
          уходом со строки, и подсветка мигала бы у самой границы. */}
      {dropPosition === 'before' && (
        <span className="bg-primary pointer-events-none absolute inset-x-0 top-0 h-0.5" />
      )}
      {dropPosition === 'after' && (
        <span className="bg-primary pointer-events-none absolute inset-x-0 bottom-0 h-0.5" />
      )}
      <ItemMedia className="size-4">
        {row.expandable ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={row.expanded ? t('canvas.collapse') : t('canvas.expand')}
            onClick={(event) => {
              // Щелчок по треугольнику — только сворачивание: выделение он не меняет.
              event.stopPropagation();
              onToggle(row.id);
            }}
          >
            {row.expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </Button>
        ) : null}
      </ItemMedia>
      <ItemContent className="gap-0">
        <ItemTitle className="text-[12px] font-normal">{row.title}</ItemTitle>
      </ItemContent>
      <ItemActions className="gap-1">
        {fixes.map((fix) => (
          <Button
            key={`${fix.commandId}:${fix.titleKey}`}
            variant="ghost"
            size="icon-xs"
            aria-label={fixTitle(fix.titleKey)}
            title={fixTitle(fix.titleKey)}
            data-fix={fix.commandId}
            onClick={(event) => {
              // Щелчок по кнопке — только исправление: выделение он не меняет, иначе
              // починка соседнего узла уводила бы курсор с того, над которым работают.
              event.stopPropagation();
              onFix(fix);
            }}
          >
            <Wrench className="size-3.5" />
          </Button>
        ))}
        {problems !== undefined && (
          // Подпись — родным `title`, а не всплывающим виджетом: подсказка нужна на
          // каждой из сотен строк, а `Tooltip` кита — это подписка и портал на каждую.
          // Тот же приём, что у значка привязки строкой ниже.
          <Badge
            variant={problems.worst === 'error' ? 'destructive' : 'outline'}
            className="text-[10px]"
            title={nodeProblemTitle(problems, message)}
          >
            {problems.total}
          </Badge>
        )}
        {row.binding !== null && (
          <Badge
            variant="secondary"
            className="font-mono text-[10px]"
            title={t('canvas.binding', { path: row.binding })}
          >
            {row.binding}
          </Badge>
        )}
        {row.component !== null && (
          <Badge variant="outline" className="text-[10px]">
            {row.component}
          </Badge>
        )}
      </ItemActions>
    </Item>
  );
}

/** Модификаторы щелчка → режим выделения. Shift сильнее Ctrl: диапазон важнее добавления. */
function modeOf(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): SelectMode {
  if (event.shiftKey) return 'range';
  return event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
}

/**
 * То же ли это место броска.
 *
 * Нужно затем, чтобы `dragover` — событие, которое браузер шлёт непрерывно, — не перерисовывал
 * дерево на каждое дрожание мыши. Перерисовка во время перетаскивания стоит дороже обычной:
 * она идёт поверх работы самого браузера с курсором.
 */
function sameSpot(a: DropSpot | null, b: DropSpot | null): boolean {
  if (a === null || b === null) return a === b;
  return a.target === b.target && a.position === b.position;
}
