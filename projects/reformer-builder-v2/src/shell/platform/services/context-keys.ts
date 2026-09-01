/**
 * Контекстные ключи — единый читатель состояния, по которому вычисляются условия `when`.
 *
 * ## Оборачивает `WhenContext`, а не заменяет его
 *
 * Пять полей контекста (`focus`, `activeEditorId`, `activeResourceKind`, `hasSelection`,
 * `previewMode`) остаются ЕДИНСТВЕННОЙ истиной и живут там же, где жили. Здесь их копии нет:
 * чтение зарезервированного имени делегируется порту-источнику. Заведи мы копию — появилось
 * бы второе место, отвечающее на вопрос «куда направлен фокус», и расхождение между ними
 * проявилось бы не отказом, а по-разному ведущими себя клавишей и панелью.
 *
 * Решение «`WhenContext` остаётся на пяти полях» (plugin-and-shell.md) при этом не
 * переоткрывается, а наоборот — становится исполнимым: поля больше не обязаны расти, потому
 * что всё, что плагин хочет сказать о себе, он говорит СВОИМ ключом.
 *
 * ## Зачем ключи плагинов
 *
 * Без них плагин может выразить «узел выделен на канвасе» только предикатом `enabled`,
 * читающим его собственный реестр сеансов. Предикат непрозрачен: его нельзя ни сравнить с
 * чужим, ни показать в таблице клавиш, ни записать в файл раскладки. Ключ прозрачен —
 * и потому участвует в разрешении конфликтов наравне с полями платформы.
 *
 * ## Портами, а не импортом
 *
 * Источник пяти полей и стек областей живут в `host/ui/**`, а этот модуль — в
 * `host/services/**`, и зависеть от оболочки он не должен. Поэтому оба приходят портами —
 * тем же приёмом, что `WorkspaceStatusSource` в `ui/status.ts`. Настоящий `WhenContextStore`
 * подходит под форму порта структурно, приводить его ни к чему не нужно.
 *
 * @module shell/platform/services/context-keys
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import { defineService } from '@/shell/platform/primitives/service';
import { NEUTRAL_WHEN_CONTEXT, type WhenContext } from '@/shell/platform/primitives/when-context';

/** Порт источника пяти полей. `WhenContextStore` подходит под эту форму как есть. */
export interface WhenContextSource {
  get(): WhenContext;
  subscribe(listener: () => void): Disposable;
}

/** Порт стека областей. Появляется вместе с окнами; до тех пор ключи `scope`/`scopes` пусты. */
export interface ScopeSource {
  top(): string | null;
  all(): readonly string[];
  subscribe(listener: () => void): Disposable;
}

/**
 * Имена, которые принадлежат платформе и заняты навсегда.
 *
 * Объявить ключ с таким именем нельзя. Иначе плагин затенил бы `focus`, и диспетчер клавиш
 * с панелями стали бы отвечать на «куда направлен фокус» по-разному — то есть вернулся бы
 * ровно тот дефект v1, ради которого заводился единый классификатор фокуса, только на этот
 * раз распределённый по плагинам и потому неотлавливаемый.
 */
export const RESERVED_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  'focus',
  'activeEditorId',
  'activeResourceKind',
  'hasSelection',
  'previewMode',
  'scope',
  'scopes',
]);

/** Снимок состояния: одно значение, две проекции. */
export interface ContextKeySnapshot {
  /** Чтение любого ключа — платформенного, областного, плагинного. */
  read(key: string): unknown;
  /**
   * Проекция на пять полей — для `CommandRegistry.execute` и `isEnabled`, которые по
   * контракту принимают {@link WhenContext}. Один снимок обслуживает обоих, поэтому
   * предикат и условие видят одно и то же состояние, а не два соседних во времени.
   */
  whenContext(): WhenContext;
}

export interface ContextKeyReader {
  /** Значение ключа. Неизвестный ключ — `undefined`, и это норма, а не отказ. */
  read(key: string): unknown;
  /** Снимок. Ссылка стабильна между изменениями — требование `useSyncExternalStore`. */
  snapshot(): ContextKeySnapshot;
  /**
   * Подписка на изменения. Уведомление НЕСЁТ имена изменившихся ключей: подписчик, который
   * знает читаемые ключи своих условий, сравнивает пересечение и молчит, если оно пусто.
   * Ради этого свойства `WhenExpr.keys` и считается один раз при разборе.
   */
  subscribe(listener: (changed: ReadonlySet<string>) => void): Disposable;
}

/** Объявленный ключ. `dispose()` снимает объявление — на этом держится выключение плагина. */
export interface ContextKey<T> extends Disposable {
  readonly key: string;
  get(): T;
  set(value: T): void;
  /** Возвращает начальное значение, с которым ключ объявлен. */
  reset(): void;
}

export interface ContextKeyInfo {
  readonly key: string;
  /** Идентификатор плагина либо `host`. */
  readonly owner: string;
}

export interface ContextKeyService extends ContextKeyReader {
  /**
   * Объявляет ключ.
   *
   * @throws Error если имя зарезервировано платформой либо ключ уже объявлен. Повторное
   * объявление — отказ, а не замена, по тому же доводу, что у умолчаний настроек: две
   * записи одного ключа означали бы, что действующее значение зависит от порядка активации
   * плагинов, а он по контракту рантайма ничего не значит.
   */
  createKey<T>(key: string, initial: T, owner?: string): ContextKey<T>;
  /** Объявленные ключи — редактору клавиш для подсказки и диагностике «такого ключа нет». */
  declared(): readonly ContextKeyInfo[];
}

export const ContextKeyServiceToken = defineService<ContextKeyService>('host.contextKeys');

/**
 * Пять полей контекста как ключи. Единственное место, где написано соответствие «имя ключа —
 * поле снимка»: и служба, и читатель без службы зовут именно его, поэтому разойтись в том,
 * что означает `focus`, они не могут.
 */
function contextField(context: WhenContext, key: string): unknown {
  switch (key) {
    case 'focus':
      return context.focus;
    case 'activeEditorId':
      return context.activeEditorId;
    case 'activeResourceKind':
      return context.activeResourceKind;
    case 'hasSelection':
      return context.hasSelection;
    case 'previewMode':
      return context.previewMode;
    default:
      return undefined;
  }
}

interface Entry {
  value: unknown;
  readonly initial: unknown;
  readonly owner: string;
}

export interface ContextKeyServiceDeps {
  readonly whenContext: WhenContextSource;
  readonly scopes?: ScopeSource;
}

/**
 * Создаёт службу контекстных ключей.
 *
 * `dispose()` снимает подписки на порты. Служба переживает плагины, но не приложение.
 */
export function createContextKeyService(
  deps: ContextKeyServiceDeps
): ContextKeyService & Disposable {
  const entries = new Map<string, Entry>();
  const listeners = new Set<(changed: ReadonlySet<string>) => void>();

  /**
   * Снимок пересобирается лениво и кэшируется. Это КЭШ, а не вторая истина: он всегда
   * собирается из портов, и в нём нет ни одной записи, которой нет в источнике. Тот же
   * приём и тот же довод, что у снимка реестра команд, — `useSyncExternalStore` уходит
   * в бесконечную перерисовку, получая новый объект на каждый вызов.
   */
  let cached: ContextKeySnapshot | null = null;

  const read = (key: string): unknown => {
    if (key === 'scope') return deps.scopes?.top() ?? null;
    if (key === 'scopes') return deps.scopes?.all() ?? [];
    if (RESERVED_CONTEXT_KEYS.has(key)) return contextField(deps.whenContext.get(), key);
    return entries.get(key)?.value;
  };

  function notify(changed: ReadonlySet<string>): void {
    cached = null;
    const errors: unknown[] = [];
    for (const listener of [...listeners]) {
      try {
        listener(changed);
      } catch (error) {
        errors.push(error);
      }
    }
    // Политика та же, что у точки расширения и у контекста применимости: падение одного
    // подписчика не отменяет уже совершённого изменения и не мешает остальным, но и не теряется.
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'ошибки в подписчиках контекстных ключей');
    }
  }

  // Изменение любого из портов задевает ключи, которые этот порт обслуживает целиком:
  // какое именно из пяти полей сменилось, источник не сообщает, а перечислять их дешевле,
  // чем сравнивать снимки.
  const CONTEXT_FIELD_KEYS: ReadonlySet<string> = new Set([
    'focus',
    'activeEditorId',
    'activeResourceKind',
    'hasSelection',
    'previewMode',
  ]);
  const SCOPE_KEYS: ReadonlySet<string> = new Set(['scope', 'scopes']);

  const subscriptions = [
    deps.whenContext.subscribe(() => {
      notify(CONTEXT_FIELD_KEYS);
    }),
    ...(deps.scopes === undefined
      ? []
      : [
          deps.scopes.subscribe(() => {
            notify(SCOPE_KEYS);
          }),
        ]),
  ];

  return {
    read,

    snapshot(): ContextKeySnapshot {
      if (cached === null) {
        // Значения снимаются в момент создания снимка, а не при каждом чтении: предикаты
        // одного нажатия обязаны видеть одно состояние, а не соседние во времени.
        const context = deps.whenContext.get();
        const scope = deps.scopes?.top() ?? null;
        const scopes = deps.scopes?.all() ?? [];
        const values = new Map<string, unknown>();
        for (const [key, entry] of entries) values.set(key, entry.value);

        cached = {
          read(key: string): unknown {
            if (key === 'scope') return scope;
            if (key === 'scopes') return scopes;
            if (RESERVED_CONTEXT_KEYS.has(key)) return contextField(context, key);
            return values.get(key);
          },
          whenContext: (): WhenContext => context,
        };
      }
      return cached;
    },

    subscribe(listener: (changed: ReadonlySet<string>) => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },

    createKey<T>(key: string, initial: T, owner = 'host'): ContextKey<T> {
      if (key.trim() === '') throw new Error('createKey: имя ключа не может быть пустым');
      if (RESERVED_CONTEXT_KEYS.has(key)) {
        throw new Error(
          `createKey: «${key}» принадлежит платформе. Затенив его, плагин заставил бы ` +
            'клавиши и панели по-разному отвечать на один вопрос о состоянии'
        );
      }
      if (entries.has(key)) {
        throw new Error(
          `createKey: ключ «${key}» уже объявлен (${entries.get(key)?.owner ?? 'неизвестно кем'}). ` +
            'Два объявления означали бы, что значение зависит от порядка активации плагинов'
        );
      }

      const entry: Entry = { value: initial, initial, owner };
      entries.set(key, entry);
      notify(new Set([key]));

      const write = (value: unknown): void => {
        // Запись того же значения не уведомляет: ключи пишут из обработчиков выделения и
        // фокуса, то есть десятками раз в секунду, и подавляющее большинство записей
        // ничего не меняет.
        if (Object.is(entry.value, value)) return;
        entry.value = value;
        notify(new Set([key]));
      };

      return {
        key,
        get: (): T => entry.value as T,
        set: write,
        reset: (): void => {
          write(initial);
        },
        dispose: (): void => {
          // Сверяем значение, а не только имя: снятие устаревшего объявления не должно
          // уносить ключ, объявленный под тем же именем позже.
          if (entries.get(key) !== entry) return;
          entries.delete(key);
          notify(new Set([key]));
        },
      };
    },

    declared(): readonly ContextKeyInfo[] {
      return [...entries].map(([key, entry]) => ({ key, owner: entry.owner }));
    },

    dispose(): void {
      for (const subscription of subscriptions) subscription.dispose();
      listeners.clear();
      entries.clear();
    },
  };
}

/**
 * Читатель поверх готового снимка {@link WhenContext}.
 *
 * Нужен там, где службы нет и быть не должно: тесты диспетчера, вызов команды из кода при
 * старте, проверка правила по снимку, снятому раньше. Пять полей читаются так же, как их
 * читает служба, — потому что читает их один и тот же код.
 */
export function readWhenContext(
  context: WhenContext = NEUTRAL_WHEN_CONTEXT
): (key: string) => unknown {
  return (key: string): unknown => {
    if (key === 'scope') return null;
    if (key === 'scopes') return EMPTY_SCOPES;
    return contextField(context, key);
  };
}

/** Пустой стек областей. Заморожен и один на всех: его читают, но не пишут. */
const EMPTY_SCOPES: readonly string[] = Object.freeze([]);
