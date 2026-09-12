/**
 * Реестр команд и его виды — реализация того, что объявлено контрактом.
 *
 * Вклад команды, разбор сочетаний и контракт реестра живут в пакете
 * `@reformer/builder-plugin-api`; там же записано, почему владельца проставляет реестр,
 * а не вносящий. Здесь — одно хранилище на все виды: вид для плагина это тот же реестр
 * с проставленным владельцем, а не второй список.
 *
 * @module shell/platform/primitives/command
 */

import {
  compileWhen,
  NEUTRAL_WHEN_CONTEXT,
  normalizeChord,
  rememberWhen,
  toDisposable,
  WhenSyntaxError,
  type AgentVisibleCommand,
  type CommandContribution,
  type CommandErrorInfo,
  type CommandRegistry,
  type CommandRegistryOptions,
  type Disposable,
  type PluginCommandRegistry,
  type WhenContext,
  type WhenExpr,
} from '@reformer/builder-plugin-api/internal';
import { CommandError } from '@reformer/builder-plugin-api/internal';

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
        //
        // Через `normalizeChord`, а не `normalizeKeybinding`: аккорд из двух ступеней —
        // законное сочетание. Это расширение, а не смена правил: односоставная запись
        // разбирается ровно так же, что закреплено отдельным тестом.
        try {
          normalizeChord(command.keybinding);
        } catch (error) {
          throw new CommandError(
            'invalid-keybinding',
            `команда «${command.id}»: сочетание «${command.keybinding}» разобрать нельзя`,
            { commandId: command.id, keybinding: command.keybinding },
            { cause: error }
          );
        }
      }

      let when: WhenExpr | undefined;
      if (command.when !== undefined) {
        // Проверяем здесь по тому же доводу, что и сочетание: неразбираемое условие — это
        // клавиша, которая не сработает никогда, и узнавать об этом в день нажатия значит
        // получить самую дорогую из поломок — молчаливую.
        try {
          when = compileWhen(command.when);
        } catch (error) {
          throw new CommandError(
            'invalid-when',
            `команда «${command.id}»: условие «${command.when}» разобрать нельзя`,
            {
              commandId: command.id,
              when: command.when,
              ...(error instanceof WhenSyntaxError ? { at: String(error.at) } : {}),
            },
            { cause: error }
          );
        }
      }

      // Владельца ставит реестр: пришедший в объявлении игнорируется, иначе плагин мог бы
      // зарегистрировать команду от чужого имени, просто написав чужой идентификатор.
      const stored: CommandContribution =
        owner === undefined ? command : { ...command, pluginId: owner };
      // Кэш заполняется по ХРАНИМОМУ объявлению, а не по пришедшему: у команды плагина это
      // разные объекты, и диспетчер спрашивает условие именно у хранимого.
      if (when !== undefined) rememberWhen(stored, when);
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
