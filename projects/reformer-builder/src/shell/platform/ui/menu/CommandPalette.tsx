/**
 * Палитра команд — отрисовка и связь с реестрами. Правила живут в `./palette`.
 *
 * ## Окно и список — компоненты кита
 *
 * Окно — `@reformer/ui-kit/dialog`, список — `@reformer/ui-kit/command`. Второй внутри
 * устроен на `cmdk`, и замены ему кит не предлагает: `/command` — это и есть обёртка над
 * `cmdk`, стилизованная токенами кита. Поэтому вопрос «оставить `cmdk` или взять кит»
 * ложный: беря кит, мы берём `cmdk`, и наоборот.
 *
 * Что мы у него берём и чего не берём — существенно:
 *
 * - **не берём фильтрацию** (`shouldFilter={false}`). Отбор, слияние и порядок — наши, они
 *   живут в `./palette` и проверены без браузера; отдать их библиотеке значило бы потерять
 *   и правило «слова ищутся по И», и приоритет команд реестра над динамическими пунктами;
 * - **берём поведение списка**: роли `listbox`/`option`, `aria-activedescendant`,
 *   перемещение стрелками, выбор Enter'ом, подкрутку к выделенному пункту и выделение
 *   под курсором. Всё это — то, чего в правилах нет и быть не может, и ровно это здесь
 *   раньше было написано руками.
 *
 * Окно кита добавляет то, чего у самодельной подложки не было вовсе: ловушку фокуса и
 * `aria-hidden` на остальном дереве. Раньше окно объявляло себя `aria-modal`, но Tab
 * спокойно уходил в интерфейс за ним — то есть объявление было неправдой. Radix идёт
 * другим путём и `aria-modal` не ставит вовсе: он прячет соседей окна `aria-hidden`,
 * что для программы чтения строже — проверено в браузере.
 *
 * ## Контекст снимается до того, как палитра забирает фокус
 *
 * Это главное решение файла, и оно не очевидно. Открытая палитра ставит фокус в своё поле
 * ввода, то есть `ctx.focus` становится `editable`. Если считать применимость по текущему
 * контексту, команда с условием «фокус на канвасе» исчезнет из списка ровно в тот момент,
 * когда её собрались вызвать, — палитра меняла бы ответ самим фактом своего открытия.
 * Поэтому снимок берётся в момент открытия и живёт до закрытия: и для `enabled`, и для
 * поставщиков динамических пунктов, и для `execute`.
 *
 * ## Кто выигрывает нажатие, пока палитра открыта
 *
 * Она сама, и тем же способом, что любой редактор: обработчик на своём поддереве зовёт
 * `stopPropagation()`, и до глобального слушателя на `document` событие не доходит. Стрелки
 * и Enter при этом НЕ гасятся `preventDefault()`: их обрабатывает `cmdk`, стоящий ниже по
 * тому же поддереву, и уже погашенное событие он пропускает. Наше дело здесь — не пустить
 * их в глобальный слой, и только.
 *
 * Окно кита рисуется в портале, вне корня оболочки. На изоляцию это не влияет: React вешает
 * делегированный слушатель и на контейнер портала, а `stopPropagation()` синтетического
 * события останавливает и нативное — до `document` оно так же не доходит. Проверено
 * в браузере на стрелках и Enter.
 *
 * **Escape — исключение, и оно не там, где казалось.** Его перехватывает Radix, слушателем
 * на `document` в фазе погружения, и закрывает окно синхронно. К моменту, когда React
 * рассылает синтетическое событие, поле ввода уже снято с дерева — обработчик поддерева
 * не зовётся вовсе, и `stopPropagation()` в нём мёртв. Гасит Escape `onEscapeKeyDown`
 * у окна; ветка в `onKeyDown` осталась запасной, на случай если событие всё же дойдёт.
 *
 * ## Что проверено и чем
 *
 * Разметка, фокус, геометрия и тема — [CommandPalette.browser.test.tsx](CommandPalette.browser.test.tsx),
 * прогон в настоящем Chromium. Слияние, фильтрация, упорядочивание и отмена устаревшего
 * запроса вынесены в `./palette` и проверяются там, без браузера.
 *
 * @module shell/platform/ui/menu/CommandPalette
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@reformer/ui-kit/command';
import { Dialog, DialogContent, DialogTitle } from '@reformer/ui-kit/dialog';
import { Kbd, KbdGroup } from '@reformer/ui-kit/kbd';
import type { CommandRegistry } from '@/shell/platform/primitives/command';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import { NEUTRAL_WHEN_CONTEXT, type WhenContext } from '@/shell/platform/primitives/when-context';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useScope, type ScopeStack } from '@/shell/platform/ui/keyboard/scope';
import {
  detectPlatformModifier,
  formatKeybinding,
  type PlatformModifier,
} from '@/shell/platform/ui/keyboard/keybindings';
import {
  PaletteItemsPoint,
  commandPaletteItems,
  createPaletteQueryRunner,
  filterPaletteItems,
  mergePaletteItems,
  resolvePaletteItem,
  type PaletteItem,
  type ResolvedPaletteItem,
} from './palette';
import {
  useContributions,
  useLocale,
  type ExtensionReader,
} from '@/shell/platform/ui/chrome/usePanels';
import type { WhenContextStore } from '@/shell/platform/ui/state/when-context-store';

/**
 * Идентификатор команды открытия.
 *
 * Палитра открывается **командой**, а не пропом и не обработчиком: тогда её умеет открыть всё,
 * что умеет вызывать команды, — сочетание клавиш, пункт меню, ассистент, — и ни один из них
 * не нуждается в ссылке на компонент.
 */
export const PALETTE_OPEN_COMMAND_ID = 'host.palette.open';

/** Сколько пунктов рисуется. Список без предела превращает палитру в файловый менеджер. */
const MAX_VISIBLE_ITEMS = 50;

/**
 * Разбирает подпись сочетания на клавиши: `Ctrl+Shift+P` в `['Ctrl', 'Shift', 'P']`.
 *
 * Разделитель тот же, которым `formatKeybinding` подпись собрал. Пустые куски отбрасываются,
 * и если не осталось ничего (подпись — сам знак сложения), клавишей становится вся строка:
 * лучше показать её как есть, чем не показать ничего.
 */
function keysOf(detail: string): readonly string[] {
  const keys = detail.split('+').filter((key) => key !== '');
  return keys.length === 0 ? [detail] : keys;
}

export interface CommandPaletteProps {
  readonly commands: CommandRegistry;
  readonly extensions: ExtensionReader;
  readonly whenContext: WhenContextStore;
  readonly i18n: RootI18nService;
  /**
   * Стек областей. Пока палитра открыта, она кладёт туда свою область — иначе её
   * собственные клавиши неотличимы от клавиш поля ввода где угодно ещё.
   */
  readonly scopes?: ScopeStack;
  /** Во что разворачивать `mod` в подписях. По умолчанию определяется по платформе. */
  readonly modifier?: PlatformModifier;
}

/** Область палитры. Экспортирована: на неё ссылаются условия правил, а строку не угадывают. */
export const PALETTE_SCOPE = 'palette';

export function CommandPalette({
  commands,
  extensions,
  whenContext,
  i18n,
  scopes,
  modifier,
}: CommandPaletteProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  // Область живёт ровно столько, сколько окно: положена при открытии, снята при закрытии.
  useScope(scopes, open ? PALETTE_SCOPE : null);
  const [query, setQuery] = useState('');
  const [dynamic, setDynamic] = useState<readonly PaletteItem[]>([]);
  // Контекст на момент открытия — см. шапку модуля.
  const [openContext, setOpenContext] = useState<WhenContext>(NEUTRAL_WHEN_CONTEXT);
  // Куда вернуть фокус после закрытия. Без этого фокус остаётся нигде, `ctx.focus`
  // становится `none`, и следующее сочетание вычисляется по состоянию, которого нет.
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const locale = useLocale(i18n);
  const providerEntries = useContributions(extensions, PaletteItemsPoint);
  const providers = useMemo(() => providerEntries.map((entry) => entry.value), [providerEntries]);
  const platformModifier = useMemo(() => modifier ?? detectPlatformModifier(), [modifier]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  /**
   * Возврат фокуса. Зовётся ТОЛЬКО из `onCloseAutoFocus`, то есть после размонтирования окна.
   *
   * Раньше это делал `close()` сразу после `setOpen(false)` — и не работало ни разу: окно
   * в этот момент ещё на экране, а его ловушка фокуса на `focusin` немедленно утаскивает
   * фокус обратно к себе. Дальше окно исчезало вместе с полем ввода, и фокус оказывался
   * на `body`, то есть ровно в том состоянии `none`, которого возврат и должен избегать.
   * Проверено в браузере: `starter.focus()` при открытом окне не меняет `activeElement`.
   *
   * Условие «фокус нигде» существует ради команд, которые уводят фокус намеренно: пункт
   * запускается раньше этого места (микрозадача против таймера), и если он уже поставил
   * фокус куда-то осмысленно, возврат обязан промолчать.
   */
  const restoreFocus = useCallback(() => {
    const target = returnFocusTo.current;
    returnFocusTo.current = null;
    if (target === null || !target.isConnected) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    target.focus();
  }, []);

  // Команда открытия. Регистрация живёт вместе с компонентом: палитра, которой нет на экране,
  // не должна значиться доступной ни у ассистента, ни в меню.
  useEffect(() => {
    let subscription: Disposable;
    try {
      subscription = commands.register({
        id: PALETTE_OPEN_COMMAND_ID,
        titleKey: 'shell.palette.open.title',
        keybinding: 'mod+shift+p',
        // Одно из немногих сочетаний, которое обязано работать и в поле ввода: иначе палитра
        // недоступна ровно тогда, когда человек что-то печатает, — то есть почти всегда.
        allowInEditable: true,
        run: () => {
          returnFocusTo.current =
            typeof document === 'undefined' || !(document.activeElement instanceof HTMLElement)
              ? null
              : document.activeElement;
          setOpenContext(whenContext.get());
          setQuery('');
          // Пункты прошлого открытия сбрасываются ЗДЕСЬ, а не при закрытии: ответ поставщика
          // мог уже уехать, и показать его в новом открытии было бы показом чужого запроса.
          setDynamic([]);
          setOpen(true);
        },
      });
    } catch (error) {
      // Идентификатор занят: палитру уже кто-то внёс. Ронять из-за этого оболочку нельзя,
      // но и молчать нечестно — иначе `mod+shift+p` откроет не то, и виновника не найти.
      console.error(`[shell] команда «${PALETTE_OPEN_COMMAND_ID}» не зарегистрирована`, error);
      return;
    }
    return () => {
      subscription.dispose();
    };
  }, [commands, whenContext]);

  // Один бегунок на всё время жизни компонента: он держит номер актуального запроса, и
  // пересоздание сбрасывало бы отмену — ответ на закрытую палитру приехал бы в открытую.
  const runner = useMemo(
    () =>
      createPaletteQueryRunner(
        (items) => {
          setDynamic(items);
        },
        {
          onError: (error, providerId) => {
            console.error(`[shell] поставщик пунктов палитры «${providerId}» отказал`, error);
          },
        }
      ),
    []
  );
  useEffect(
    () => () => {
      runner.dispose();
    },
    [runner]
  );

  useEffect(() => {
    if (!open) {
      // Отмена, а не очистка: запрос мог уже уйти к поставщику, и его ответ обязан быть
      // отброшен. Сами пункты убирает открытие — иначе состояние правилось бы из эффекта,
      // а это лишний каскад отрисовок на каждое закрытие.
      runner.cancel();
      return;
    }
    runner.request(providers, query, openContext);
  }, [runner, open, providers, query, openContext]);

  // Вместе с пунктами считается и то, чьё пояснение является сочетанием клавиш: подпись
  // сочетания рисуется клавишами (`Kbd`), а путь к файлу — обычным текстом, и различить их
  // по самой строке нельзя. Различает тот, кто её сделал, — то есть это место.
  const { items, shortcuts } = useMemo(() => {
    const shortcutIds = new Set<string>();
    if (!open) return { items: [] as readonly ResolvedPaletteItem[], shortcuts: shortcutIds };
    const staticItems = commandPaletteItems(commands.getAll(), openContext, {
      // Заголовок разрешается словарём ВЛАДЕЛЬЦА команды, а не Host. Без этого команда
      // плагина гарантированно промахивается мимо ключа: её `titleKey` лежит в её
      // собственном пространстве имён, а показывался бы маркер промаха.
      translate: (key, command) =>
        command?.pluginId === undefined ? i18n.t(key) : i18n.forPlugin(command.pluginId).t(key),
      execute: (commandId) => commands.execute(commandId, undefined, openContext),
      detail: (command) => {
        if (command.keybinding === undefined) return undefined;
        shortcutIds.add(command.id);
        return formatKeybinding(command.keybinding, platformModifier);
      },
      onError: (error, commandId) => {
        console.error(`[shell] предикат команды «${commandId}» бросил`, error);
      },
    });
    const dynamicItems = dynamic.map((item) => resolvePaletteItem(item, (key) => i18n.t(key)));
    const visible = filterPaletteItems(
      mergePaletteItems(staticItems, dynamicItems),
      query,
      locale
    ).slice(0, MAX_VISIBLE_ITEMS);
    return { items: visible, shortcuts: shortcutIds };
  }, [open, commands, openContext, i18n, locale, dynamic, query, platformModifier]);

  const run = useCallback(
    (item: ResolvedPaletteItem) => {
      // Закрытие раньше запуска: команда вправе открыть свой диалог или перевести фокус,
      // и палитра поверх него спорила бы с ней за клавиатуру.
      close();
      void Promise.resolve()
        .then(() => item.run())
        .catch((error: unknown) => {
          console.error(`[shell] пункт палитры «${item.id}» отказал`, error);
        });
    },
    [close]
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      // Запасной путь: в обычной работе сюда не попадает — Escape перехватывает Radix
      // раньше (см. `onEscapeKeyDown` ниже и шапку модуля).
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      // Навигация и выбор — дело `cmdk`. Здесь только изоляция от глобального слоя:
      // `stopPropagation` без `preventDefault`, иначе список перестал бы слушаться стрелок.
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Home' ||
        event.key === 'End' ||
        event.key === 'Enter'
      ) {
        event.stopPropagation();
      }
    },
    [close]
  );

  if (!open) return null;

  const label = i18n.t('shell.palette.label');

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Escape и щелчок мимо окна приходят сюда же: закрытие у палитры одно, и оно обязано
        // вернуть фокус туда, откуда её позвали.
        if (!next) close();
      }}
    >
      <DialogContent
        // Крестика нет намеренно: палитра закрывается Escape и щелчком мимо, а кнопка
        // в правом верхнем углу села бы поверх подписи сочетания у первого пункта.
        showCloseButton={false}
        // Описания у палитры нет: поле ввода объясняет себя подсказкой. Без явного
        // `undefined` Radix ищет несуществующий `aria-describedby` и жалуется в консоль.
        aria-describedby={undefined}
        onKeyDown={onKeyDown}
        // Escape перехватывает Radix — своим слушателем на `document` в фазе ПОГРУЖЕНИЯ,
        // то есть раньше, чем событие вообще дойдёт до нашего поддерева. К моменту, когда
        // React рассылает синтетическое событие, поле ввода уже снято с дерева, обработчик
        // ниже не зовётся, и без этой строки Escape доезжал до глобального слоя. Проверено
        // в браузере: слушатель на `document` его получал.
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
        }}
        // Возврат фокуса — наш (`restoreFocus`), и он случается ЗДЕСЬ: только тут окна уже
        // нет и его ловушка фокуса не отменит перевод. `preventDefault` запрещает Radix
        // делать свой перевод следом.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
        // Сдвиг вверх и ширина; всё остальное — от кита. Переопределяется только предел
        // ширины на широком экране: узкий предел (`max-w-[calc(100%-2rem)]`) кита оставлен
        // как есть, иначе на телефоне окно легло бы вплотную к краям.
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        {/* Заголовок обязателен для Radix и не нужен глазу: палитра узнаётся полем ввода. */}
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <Command
          label={label}
          // Отбор — наш, см. шапку модуля.
          shouldFilter={false}
          // Высота по содержимому, а не `h-full` кита: у окна её задаёт не сетка, а сам
          // список, и процент от неопределённой высоты родителя дал бы нулевую.
          className="h-auto"
        >
          <CommandInput
            value={query}
            aria-label={i18n.t('shell.palette.input.label')}
            placeholder={i18n.t('shell.palette.placeholder')}
            onValueChange={setQuery}
          />
          {/* Предел высоты стоит на списке, а не на окне: список уже умеет прокручиваться
              (`overflow-y-auto` кита), и ограничивать его через `flex-1` в контейнере
              с высотой по содержимому значило бы схлопнуть его в ноль. */}
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>{i18n.t('shell.palette.empty')}</CommandEmpty>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => {
                  run(item);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.detail !== undefined &&
                  (shortcuts.has(item.id) ? (
                    <KbdGroup className="flex-none">
                      {keysOf(item.detail).map((key, index) => (
                        <Kbd key={`${key}-${String(index)}`}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  ) : (
                    // Пояснение динамического пункта — путь или раздел, а не сочетание:
                    // `Kbd` тут соврал бы, а `CommandShortcut` кита назван по единственному
                    // своему назначению, которое уже занято веткой выше.
                    <span className="text-muted-foreground flex-none text-[11px]">
                      {item.detail}
                    </span>
                  ))}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
