/**
 * Реестр команд: регистрация, поиск, проверка применимости, выполнение.
 *
 * **Команды и ввод — разные вещи.** Это вывод из разбора v1, а не стилистика: обработчик
 * клавиш там занимает 192 строки, и командами является меньше трети. Остальное — ввод,
 * принадлежащий сфокусированному редактору: стрелки с четырьмя комбинациями модификаторов,
 * F6, аккорд из двух нажатий, пробел как переход фокуса, Escape с тремя разными смыслами
 * в зависимости от места. Если сложить это в реестр команд, получится та же цепочка условий,
 * просто размазанная по десятку файлов, и регрессы вида «Delete в инспекторе удаляет узел
 * схемы».
 *
 * Поэтому здесь **только реестр**. В него попадает то, что имеет смысл вызвать из палитры,
 * из меню или ассистентом. Диспетчер сочетаний и разбор ввода — Э5, отдельный слой поверх;
 * этот модуль о клавиатуре не знает ничего, кроме канонического написания сочетания
 * (см. {@link normalizeKeybinding}).
 *
 * @module host/primitives/command
 */

import { toDisposable, type Disposable } from './disposable';
import { NEUTRAL_WHEN_CONTEXT, type WhenContext } from './when-context';

/**
 * Как команда выглядит для модели. Заполняется осознанно — см.
 * {@link CommandRegistry.agentCommands}.
 */
export interface CommandAgentSpec {
  /** Описание для модели, а не ключ i18n: модель читает по-английски и перевода не ждёт. */
  readonly description: string;
  /** JSON Schema аргументов. Проверяется до вызова — это работа моста ассистента (Э10). */
  readonly schema: object;
}

/** Вклад в точку расширения `command`. */
export interface CommandContribution {
  /** Уникальный идентификатор с пространством имён владельца: `workspace.save`. */
  readonly id: string;
  /**
   * Ключ i18n, не литерал: иначе одна из локалей становится главной, а перевод —
   * привязанным к месту объявления команды.
   *
   * Разрешается словарём ВЛАДЕЛЬЦА (см. {@link CommandContribution.pluginId}), а не Host:
   * иначе команда плагина гарантированно промахивается мимо ключа и показывает маркер.
   */
  readonly titleKey: string;
  /**
   * Кто внёс команду. Проставляет РЕЕСТР, а не объявление, — тем же приёмом, что у вкладов
   * (`ExtensionRegistry.forPlugin`): будь это параметр, его забыли бы, ошиблись
   * бы в нём или подставили чужой.
   *
   * Отсутствие означает команду самой оболочки, и её `titleKey` — ключ словаря Host.
   * Разница видна пользователю: без владельца заголовок команды плагина был бы маркером
   * промаха вроде `⟦editor-schema.command.delete⟧`.
   */
  readonly pluginId?: string;
  /**
   * Действие. Может быть синхронным или асинхронным; реестр вызывает его синхронно
   * (см. {@link CommandRegistry.execute}).
   */
  readonly run: (args?: unknown) => unknown | Promise<unknown>;
  /**
   * Применимость. Отсутствие означает «доступна всегда».
   *
   * Предикат обязан быть чистым и дешёвым: его зовут на каждую перерисовку палитры и на
   * каждое нажатие, которое диспетчер сопоставит с сочетанием.
   */
  readonly enabled?: (ctx: WhenContext) => boolean;
  /** Например `mod+s`, `mod+alt+v`. `mod` = Cmd на macOS, Ctrl на остальных. */
  readonly keybinding?: string;
  /**
   * Разрешить сочетание, когда фокус в поле ввода. По умолчанию — нет.
   *
   * Помечаются единицы: сохранение, палитра команд. Всё остальное в поле ввода принадлежит
   * тому, кто в это поле печатает.
   *
   * Поле живёт здесь, рядом с `keybinding`, а не вносится дополнением объявления из диспетчера:
   * раз `keybinding` уже здесь, знание о клавиатуре в этом модуле уже есть, и разносить два
   * поля одного понятия по разным файлам — хуже, чем держать их вместе.
   */
  readonly allowInEditable?: boolean;
  /** Опционально: как эта команда выглядит для модели. */
  readonly agent?: CommandAgentSpec;
}

/** Команда, у которой есть блок `agent`, — с сужением типа, чтобы не проверять его повторно. */
export type AgentVisibleCommand = CommandContribution & { readonly agent: CommandAgentSpec };

/**
 * Причина отказа. Код, а не переведённая фраза: по коду ассистент чинится сам, по фразе — нет,
 * и одна ошибка выглядит одинаково в интерфейсе, логе и тесте.
 */
export type CommandErrorKind =
  | 'invalid-id'
  | 'invalid-keybinding'
  | 'duplicate'
  | 'not-found'
  | 'disabled';

/**
 * Отказ реестра команд.
 *
 * `message` — диагностика для разработчика; интерфейс обязан строить текст из {@link kind}
 * и {@link params}, а не показывать его пользователю.
 */
export class CommandError extends Error {
  readonly kind: CommandErrorKind;
  /** Параметры кода: `commandId`, `keybinding`. */
  readonly params: Readonly<Record<string, string>>;

  constructor(
    kind: CommandErrorKind,
    message: string,
    params: Readonly<Record<string, string>> = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CommandError';
    this.kind = kind;
    this.params = params;
  }
}

/**
 * Синонимы модификаторов → канонический вид.
 *
 * `mod` остаётся отдельным модификатором и в `ctrl`/`meta` здесь не разворачивается:
 * нормализация — про написание, а не про платформу. Разрешает `mod` диспетчер (Э5), который
 * единственный знает, на чём выполняется приложение.
 */
const MODIFIER_ALIASES: Readonly<Record<string, string>> = {
  mod: 'mod',
  commandorcontrol: 'mod',
  cmdorctrl: 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
  win: 'meta',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  shift: 'shift',
};

/**
 * Порядок модификаторов в каноническом виде.
 *
 * Конкретный порядок неважен, важно что он один: без него `shift+mod+k` и `mod+shift+k` —
 * две разные строки, и диспетчер не найдёт команду, зарегистрированную «наоборот».
 * Выбран под чтение: платформенные модификаторы впереди, `shift` последним, как пишут в меню.
 */
const MODIFIER_ORDER = ['mod', 'ctrl', 'meta', 'alt', 'shift'] as const;

/**
 * Синонимы клавиш → канонический вид.
 *
 * Канон — это `KeyboardEvent.key` в нижнем регистре: диспетчеру достанется именно оно,
 * и любое другое написание пришлось бы отображать туда на каждом нажатии.
 */
const KEY_ALIASES: Readonly<Record<string, string>> = {
  esc: 'escape',
  return: 'enter',
  del: 'delete',
  ins: 'insert',
  spacebar: 'space',
  plus: '+',
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
  down: 'arrowdown',
};

/**
 * Делит сочетание по `+`, не ломая сам `+` как клавишу.
 *
 * Разделителем считается только тот `+`, слева от которого уже накоплен непустой токен.
 * Поэтому `mod++` — это `mod` и клавиша `+`, а не три пустых куска.
 */
function splitKeybinding(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (const ch of input) {
    if (ch === '+' && current.trim() !== '') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function invalidKeybinding(keybinding: string, reason: string): CommandError {
  return new CommandError(
    'invalid-keybinding',
    `сочетание «${keybinding}» разобрать нельзя: ${reason}`,
    { keybinding }
  );
}

/**
 * Приводит сочетание к каноническому виду: `mod+shift+K` → `mod+shift+k`.
 *
 * Чистая функция и единственное место, где решается, как выглядит сочетание. Регистрация
 * и будущий диспетчер зовут её обе — иначе они разойдутся в написании, и расхождение
 * проявится не отказом, а молчаливо не сработавшей клавишей.
 *
 * Что делает: снимает регистр и пробелы, разворачивает синонимы (`cmd` → `meta`,
 * `esc` → `escape`, `option+left` → `alt+arrowleft`), выстраивает модификаторы в
 * фиксированном порядке. Чего не делает: не разрешает `mod` в платформенный модификатор
 * и не проверяет, существует ли такая клавиша, — первое знает только диспетчер, второе
 * отсекло бы раскладки и клавиши, о которых мы не подумали.
 *
 * @throws {CommandError} `invalid-keybinding`, если есть пустая часть, повторён модификатор,
 * клавиш больше одной или их нет вовсе.
 */
export function normalizeKeybinding(keybinding: string): string {
  const modifiers = new Set<string>();
  let key: string | null = null;

  for (const part of splitKeybinding(keybinding)) {
    const token = part.trim().toLowerCase();
    if (token === '') throw invalidKeybinding(keybinding, 'пустая часть');

    const modifier = MODIFIER_ALIASES[token];
    if (modifier !== undefined) {
      if (modifiers.has(modifier)) {
        throw invalidKeybinding(keybinding, `модификатор «${modifier}» повторён`);
      }
      modifiers.add(modifier);
      continue;
    }

    if (key !== null) throw invalidKeybinding(keybinding, 'больше одной клавиши');
    key = KEY_ALIASES[token] ?? token;
  }

  if (key === null) throw invalidKeybinding(keybinding, 'нет клавиши, только модификаторы');

  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
}

/** Где именно упал чужой код. Пока причина одна, но она не последняя. */
export interface CommandErrorInfo {
  readonly commandId: string;
  readonly phase: 'enabled';
}

export interface CommandRegistryOptions {
  /**
   * Откуда брать контекст, если он не передан явно. По умолчанию — {@link NEUTRAL_WHEN_CONTEXT}.
   *
   * Поставщик, а не аргумент на каждом вызове: контекст обязан быть один на приложение.
   * Если бы его собирал каждый вызывающий, палитра, диспетчер и ассистент разошлись бы в том,
   * что считается «текущим состоянием», — и охранные условия вернулись бы туда, откуда
   * их убрали.
   */
  readonly getContext?: () => WhenContext;
  /**
   * Куда сообщать об ошибке в чужом коде. По умолчанию — `console.error`.
   *
   * Тот же канал и та же причина, что у шины событий: упавший предикат — это чужая поломка,
   * и она не должна ни ронять палитру, ни исчезать бесследно.
   */
  readonly onError?: (error: unknown, info: CommandErrorInfo) => void;
}

/** Вид реестра команд для плагина: то же, что {@link CommandRegistry}, но без `forPlugin`. */
export type PluginCommandRegistry = Omit<CommandRegistry, 'forPlugin'>;

export interface CommandRegistry {
  /**
   * Регистрирует команду. `dispose()` снимает её — на этом держится выключение плагина
   * и уход команд вместе с закрытым редактором.
   *
   * @throws {CommandError} `invalid-id` — пустой идентификатор; `duplicate` — идентификатор
   * занят; `invalid-keybinding` — сочетание не разбирается.
   */
  register(command: CommandContribution): Disposable;

  /**
   * Вид реестра для плагина: `register` проставляет владельца сам. Повторный вызов
   * с тем же идентификатором возвращает тот же объект — идентичность стабильна, чтобы вид
   * годился в зависимости хуков.
   *
   * В самом виде метода `forPlugin` нет: плагин не располагает способом зарегистрировать
   * команду от чужого имени, потому что пути к этому не существует, а не потому, что так
   * договорились.
   */
  forPlugin(pluginId: string): PluginCommandRegistry;

  /** Команда по идентификатору или `undefined`. */
  get(id: string): CommandContribution | undefined;

  /**
   * Все зарегистрированные, в порядке регистрации. Порядок показа решает палитра.
   *
   * Между изменениями возвращается **та же** ссылка на массив. Это не оптимизация, а
   * требование `useSyncExternalStore`: он сравнивает снимки по ссылке и падает с «результат
   * getSnapshot должен кэшироваться», получая новый массив на каждый вызов. Снимок
   * сбрасывается ровно тогда же, когда зовутся наблюдатели {@link onDidChange}.
   */
  getAll(): readonly CommandContribution[];

  /**
   * Уведомление о появлении и снятии команды.
   *
   * Существует потому, что набор команд меняется ПОСЛЕ первой отрисовки: команды оболочки
   * регистрируются эффектами компонентов (палитра, справка), а команды плагинов — при
   * активации. Без этого события меню, построенное на первом кадре, навсегда осталось бы
   * без них — и показывало бы пустой «Вид» рядом с работающим сочетанием клавиш.
   *
   * Реестр вкладов решает ту же задачу тем же способом (`observe`), и намеренно одинаково:
   * два разных механизма подписки на два соседних реестра пришлось бы каждый раз вспоминать.
   */
  onDidChange(cb: () => void): Disposable;

  /**
   * Применима ли команда. Незнакомый идентификатор — `false`: палитра и меню спрашивают
   * про то, что сами же перечислили, и отказ им здесь не нужен.
   */
  isEnabled(id: string, ctx?: WhenContext): boolean;

  /**
   * Выполняет команду, предварительно проверив применимость.
   *
   * `run` вызывается синхронно — до первого `await` внутри самой команды. Это нужно, чтобы
   * команда могла участвовать в контуре правки и укладываться в одну запись отмены;
   * асинхронен только её результат.
   *
   * @throws {CommandError} `not-found` или `disabled` — отказом, а не тихим ничем: молчание
   * здесь неотличимо от «команда отработала и ничего не сделала», и ассистент по нему
   * не поймёт, что промахнулся.
   */
  execute(id: string, args?: unknown, ctx?: WhenContext): Promise<unknown>;

  /**
   * Команды, у которых объявлен блок `agent`, — поверхность инструментов ассистента.
   *
   * Применимость здесь **не фильтруется**, и это осознанно: набор инструментов уходит
   * в каждый запрос к модели, поэтому он обязан быть устойчивым — иначе префикс запроса
   * меняется от фокуса пользователя и кэширование префикса перестаёт работать. Применимость
   * проверяется в момент вызова, там же, где у человека.
   */
  agentCommands(): readonly AgentVisibleCommand[];
}

function defaultOnError(error: unknown, info: CommandErrorInfo): void {
  console.error(`[command] «${info.commandId}»: ошибка в ${info.phase}`, error);
}

/** Результат проверки предиката вместе с причиной отказа, если предикат сам упал. */
interface EnabledResult {
  readonly enabled: boolean;
  readonly error?: unknown;
}

function evaluateEnabled(command: CommandContribution, ctx: WhenContext): EnabledResult {
  if (command.enabled === undefined) return { enabled: true };
  try {
    return { enabled: command.enabled(ctx) };
  } catch (error) {
    // Упавший предикат считаем запретом, а не разрешением: охранное условие, которое
    // не смогло ответить, тем более не должно пропускать действие дальше.
    return { enabled: false, error };
  }
}

/**
 * Общее для реестра и всех его видов: наблюдатели и кэш снимка.
 *
 * Одно на все виды, как и само хранилище: подписавшийся на реестр обязан узнать о команде,
 * зарегистрированной через вид плагина, — иначе меню обновлялось бы только на командах
 * оболочки.
 */
interface RegistryState {
  readonly observers: Set<() => void>;
  /** Отсортированный снимок; `null` — устарел и будет пересобран при первом чтении. */
  snapshot: readonly CommandContribution[] | null;
}

/**
 * Общая реализация реестра и его видов.
 *
 * Виды делят ОДНО хранилище команд: вид для плагина — это тот же реестр с проставленным
 * владельцем, а не второй список. Иначе палитра показывала бы только команды оболочки,
 * а команды плагинов пришлось бы собирать обходом видов.
 */
function createRegistryOver(
  commands: Map<string, CommandContribution>,
  options: CommandRegistryOptions,
  owner: string | undefined,
  views: Map<string, PluginCommandRegistry>,
  state: RegistryState
): CommandRegistry {
  const getContext = options.getContext ?? (() => NEUTRAL_WHEN_CONTEXT);
  const onError = options.onError ?? defaultOnError;

  /**
   * Сообщает об изменении набора: сбрасывает снимок и зовёт наблюдателей.
   *
   * Копия набора — на случай, если наблюдатель в ответ регистрирует или снимает команду:
   * без неё это была бы мутация коллекции во время обхода. Ошибка одного наблюдателя
   * не отменяет уже совершённой регистрации — политика та же, что в реестре вкладов,
   * и одинаковой она сделана нарочно.
   */
  function notify(): void {
    state.snapshot = null;
    const errors: unknown[] = [];
    for (const cb of [...state.observers]) {
      try {
        cb();
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'ошибки в наблюдателях реестра команд');
  }

  function resolveEnabled(
    command: CommandContribution,
    id: string,
    ctx: WhenContext | undefined
  ): EnabledResult {
    const result = evaluateEnabled(command, ctx ?? getContext());
    if (result.error !== undefined) onError(result.error, { commandId: id, phase: 'enabled' });
    return result;
  }

  return {
    register(command: CommandContribution): Disposable {
      if (command.id.trim() === '') {
        throw new CommandError('invalid-id', 'идентификатор команды не может быть пустым');
      }
      if (commands.has(command.id)) {
        // Молчаливая подмена хуже отказа: пользователь получил бы не ту команду, которую
        // ждал, и виновника пришлось бы искать чтением всех плагинов сразу.
        throw new CommandError('duplicate', `команда «${command.id}» уже зарегистрирована`, {
          commandId: command.id,
        });
      }
      if (command.keybinding !== undefined) {
        // Проверяем на регистрации, а не при первом нажатии: иначе опечатка в сочетании
        // живёт до того дня, когда кто-то попробует его нажать.
        try {
          normalizeKeybinding(command.keybinding);
        } catch (error) {
          throw new CommandError(
            'invalid-keybinding',
            `команда «${command.id}»: сочетание «${command.keybinding}» разобрать нельзя`,
            { commandId: command.id, keybinding: command.keybinding },
            { cause: error }
          );
        }
      }

      // Владельца ставит реестр: пришедший в объявлении игнорируется, иначе плагин мог бы
      // зарегистрировать команду от чужого имени, просто написав чужой идентификатор.
      const stored: CommandContribution =
        owner === undefined ? command : { ...command, pluginId: owner };
      commands.set(stored.id, stored);
      notify();
      return toDisposable(() => {
        // Сверяем значение, а не только ключ: снятие устаревшей подписки не должно уносить
        // команду, зарегистрированную под тем же идентификатором позже.
        if (commands.get(stored.id) !== stored) return;
        commands.delete(stored.id);
        notify();
      });
    },

    get(id: string): CommandContribution | undefined {
      return commands.get(id);
    },

    getAll(): readonly CommandContribution[] {
      state.snapshot ??= Object.freeze([...commands.values()]);
      return state.snapshot;
    },

    onDidChange(cb: () => void): Disposable {
      state.observers.add(cb);
      return toDisposable(() => {
        state.observers.delete(cb);
      });
    },

    isEnabled(id: string, ctx?: WhenContext): boolean {
      const command = commands.get(id);
      if (command === undefined) return false;
      return resolveEnabled(command, id, ctx).enabled;
    },

    async execute(id: string, args?: unknown, ctx?: WhenContext): Promise<unknown> {
      const command = commands.get(id);
      if (command === undefined) {
        throw new CommandError('not-found', `команда «${id}» не зарегистрирована`, {
          commandId: id,
        });
      }

      const result = resolveEnabled(command, id, ctx);
      if (!result.enabled) {
        throw new CommandError(
          'disabled',
          `команда «${id}» недоступна в текущем контексте`,
          { commandId: id },
          result.error !== undefined ? { cause: result.error } : undefined
        );
      }

      return await command.run(args);
    },

    agentCommands(): readonly AgentVisibleCommand[] {
      const visible: AgentVisibleCommand[] = [];
      for (const command of commands.values()) {
        if (command.agent !== undefined) visible.push(command as AgentVisibleCommand);
      }
      return visible;
    },

    forPlugin(pluginId: string): PluginCommandRegistry {
      if (pluginId.trim() === '') {
        throw new Error('forPlugin: идентификатор плагина не может быть пустым');
      }
      let view = views.get(pluginId);
      if (view === undefined) {
        view = createRegistryOver(commands, options, pluginId, views, state);
        views.set(pluginId, view);
      }
      return view;
    },
  };
}

/**
 * Реестр команд приложения.
 *
 * Хранилище создаётся здесь и одно на все виды: `forPlugin` возвращает тот же реестр
 * с проставленным владельцем, а не отдельный список.
 */
export function createCommandRegistry(options: CommandRegistryOptions = {}): CommandRegistry {
  return createRegistryOver(
    new Map<string, CommandContribution>(),
    options,
    undefined,
    new Map<string, PluginCommandRegistry>(),
    { observers: new Set<() => void>(), snapshot: null }
  );
}
