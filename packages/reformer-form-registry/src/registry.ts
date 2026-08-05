/**
 * Реестр форм: микрофронт регистрирует, хост разрешает.
 *
 * Реестр пиннится в `globalThis` через `Symbol.for` — это единственное хранилище, общее для
 * независимо собранных бандлов, и единственный ключ, совпадающий у двух копий модуля в одном
 * realm (`Symbol.for` живёт в cross-realm registry). Модульный синглтон здесь не годится:
 * при Module Federation без общего chunk'а или при web-components каждый бандл получил бы
 * свой экземпляр, и хост не увидел бы форм, зарегистрированных ремоутом.
 *
 * @module reformer/form-registry/registry
 */

import type { Diagnostic, FormEntry, FormQuery, ResolveContext } from './types';
import { resolveForms } from './resolve';

const REALM_KEY = Symbol.for('reformer.form-registry.v1');

interface RealmSlot {
  instance?: FormRegistry;
}

function realm(): RealmSlot {
  const g = globalThis as unknown as Record<symbol, RealmSlot | undefined>;
  return (g[REALM_KEY] ??= {});
}

/** Что делать при повторной регистрации того же `id@version`. */
export type ConflictPolicy =
  /** Бросить с указанием обоих владельцев. Дефолт: молчаливая перезапись хуже явного отказа. */
  | 'throw'
  /** Заменить существующую запись. */
  | 'replace'
  /** Оставить существующую, новую игнорировать. */
  | 'keep';

export interface FormRegistry {
  /**
   * Регистрирует форму.
   *
   * @returns `unregister`. Возвращать его ОБЯЗАТЕЛЬНО: в single-spa `unmount` микрофронта
   *   должен снять свои записи, иначе слот продолжит показывать форму выгруженного приложения.
   */
  register(entry: FormEntry, opts?: { onConflict?: ConflictPolicy }): () => void;
  /** Регистрирует пачку; возвращает один `unregister` на всю пачку. */
  registerAll(entries: readonly FormEntry[], opts?: { onConflict?: ConflictPolicy }): () => void;
  /** Все записи в порядке регистрации. */
  list(): readonly FormEntry[];
  /** Разрешение формы. См. {@link resolveForms}. */
  resolve(query: FormQuery, ctx: ResolveContext): FormEntry[];
  /** Подписка на изменения состава реестра — для `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
  /** Накопленные диагностические сообщения (конфликты, промахи). */
  readonly diagnostics: readonly Diagnostic[];
}

const keyOf = (e: Pick<FormEntry, 'id' | 'version'>): string => `${e.id}@${e.version}`;

/**
 * Создаёт независимый реестр. Обычному приложению нужен {@link getFormRegistry} —
 * эта фабрика существует для тестов и для случаев, когда нужна изоляция.
 */
export function createFormRegistry(): FormRegistry {
  const entries = new Map<string, FormEntry>();
  const listeners = new Set<() => void>();
  const diagnostics: Diagnostic[] = [];

  // Снимок кэшируется и пересоздаётся ТОЛЬКО при изменении состава.
  // `useSyncExternalStore` сравнивает результат getSnapshot по ссылке: новый массив на каждый
  // вызов — это бесконечный цикл рендера (React error #185), а не просто лишняя работа.
  let snapshot: readonly FormEntry[] = [];
  let dirty = true;

  const list = (): readonly FormEntry[] => {
    if (dirty) {
      snapshot = [...entries.values()];
      dirty = false;
    }
    return snapshot;
  };

  const notify = (): void => {
    dirty = true;
    listeners.forEach((l) => l());
  };

  const register: FormRegistry['register'] = (entry, opts) => {
    const key = keyOf(entry);
    const existing = entries.get(key);
    const policy = opts?.onConflict ?? 'throw';

    if (existing && existing !== entry) {
      if (policy === 'keep') {
        diagnostics.push({
          level: 'warn',
          code: 'duplicate-entry-kept',
          message: `Форма ${key} уже зарегистрирована владельцем "${existing.owner}"; регистрация от "${entry.owner}" проигнорирована.`,
          entry: { id: entry.id, version: entry.version, owner: entry.owner },
        });
        return () => {};
      }
      if (policy === 'throw') {
        throw new Error(
          `Конфликт в реестре форм: ${key} уже зарегистрирована владельцем "${existing.owner}", ` +
            `повторная регистрация от "${entry.owner}". Разведите id по владельцам или передайте ` +
            `{ onConflict: 'replace' | 'keep' }, если перекрытие намеренное.`
        );
      }
      diagnostics.push({
        level: 'warn',
        code: 'duplicate-entry-replaced',
        message: `Форма ${key} от "${existing.owner}" заменена регистрацией от "${entry.owner}".`,
        entry: { id: entry.id, version: entry.version, owner: entry.owner },
      });
    }

    entries.set(key, entry);
    notify();

    let removed = false;
    return () => {
      // Идемпотентность и защита от снятия ЧУЖОЙ записи: если ключ успели перезаписать,
      // unregister прошлого владельца не должен убирать актуальную запись.
      if (removed) return;
      removed = true;
      if (entries.get(key) === entry) {
        entries.delete(key);
        notify();
      }
    };
  };

  return {
    register,
    registerAll(list, opts) {
      const offs = list.map((e) => register(e, opts));
      return () => offs.forEach((off) => off());
    },
    list,
    resolve: (query, ctx) => resolveForms(list(), query, ctx),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get diagnostics() {
      return diagnostics;
    },
  };
}

/**
 * Реестр форм этого realm'а. Один на окно — сколько бы бандлов его ни импортировало.
 *
 * @example Микрофронт регистрирует свои формы при монтировании
 * ```typescript
 * const off = getFormRegistry().registerAll(myForms);
 * // при unmount:
 * off();
 * ```
 */
export function getFormRegistry(): FormRegistry {
  const slot = realm();
  return (slot.instance ??= createFormRegistry());
}

/** Сбрасывает пиннинг. Только для тестов. */
export function resetFormRegistry(): void {
  realm().instance = undefined;
}
