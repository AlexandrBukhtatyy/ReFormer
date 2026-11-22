/**
 * Где уровень хранит выбор пользователя: тема, язык. Общий модуль уровней, своего сабпата нет —
 * `StorageAdapter` и `webStorage` реэкспортируют `@reformer/core/theme` и `@reformer/core/language`.
 *
 * Публичного `persist()` для произвольных сигналов здесь нет намеренно: сохранение модели
 * приложения — отдельное решение (эпик «модель как стор» его не включает). Уровни сохраняют
 * только свой выбор, через опцию `storage`.
 *
 * @module levels/storage
 */

import type { Signal } from '@preact/signals-core';
import { watchField } from '../model/behaviors-value';
import { onScopeDispose } from '../model/scope';

/**
 * Хранилище выбора уровня: `localStorage`, настройки приложения, cookie.
 *
 * @group Levels
 */
export interface StorageAdapter {
  /** Сохранённое значение ключа; `undefined` — ничего не сохранено. */
  get(key: string): unknown;
  /** Сохранить значение. Промис — для асинхронных хранилищ; ошибку уровень не ждёт. */
  set(key: string, value: unknown): void | Promise<void>;
  /** Правка ключа снаружи (другая вкладка, панель настроек). Возвращает отписку. */
  subscribe?(key: string, onChange: () => void): () => void;
}

/**
 * Хранилище над Web Storage (`localStorage` по умолчанию): значения в JSON.
 *
 * Без `localStorage` (сервер, воркер, запрет политикой) хранилище пустое и ничего не пишет —
 * уровень работает, просто не помнит выбор. Битый JSON читается как «ничего не сохранено»,
 * ошибка записи (квота, приватный режим) молча пропускается. Правки из других вкладок приходят
 * событием `storage`.
 *
 * @param storage - Web Storage; `null` — пустое хранилище. По умолчанию `localStorage`.
 * @returns Адаптер для опции `storage` уровней.
 *
 * @example
 * ```typescript
 * import { createTheme, webStorage } from '@reformer/core/theme';
 *
 * const theme = createTheme({ storage: webStorage() });
 * ```
 *
 * @group Levels
 */
export function webStorage(storage: Storage | null = defaultStorage()): StorageAdapter {
  return {
    get(key) {
      try {
        const raw = storage?.getItem(key);
        return raw == null ? undefined : (JSON.parse(raw) as unknown);
      } catch {
        return undefined;
      }
    },
    set(key, value) {
      try {
        storage?.setItem(key, JSON.stringify(value));
      } catch {
        // Квота, приватный режим: выбор просто не сохранится.
      }
    },
    subscribe(key, onChange) {
      if (storage === null || typeof window === 'undefined') return () => {};
      const listener = (event: StorageEvent): void => {
        const area = event.storageArea;
        if (event.key === key && (area === null || area === storage)) onChange();
      };
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
  };
}

/**
 * Связать сигнал с ключом хранилища. Вызывать внутри области уровня: подписки снимаются с ней.
 *
 * - При старте валидное сохранённое значение записывается в сигнал.
 * - Каждое изменение сигнала пишется в хранилище; значение, которое только что пришло из
 *   хранилища, обратно не пишется.
 * - Правка ключа снаружи (`subscribe`) возвращается в сигнал.
 *
 * @param target - Сигнал выбора: свой сигнал уровня или поле модели приложения.
 * @param storage - Хранилище.
 * @param key - Ключ.
 * @param parse - Проверка сохранённого значения; `undefined` — значение не годится, его не читать.
 *
 * @internal
 */
export function bindStorage<T>(
  target: Signal<T>,
  storage: StorageAdapter,
  key: string,
  parse: (raw: unknown) => T | undefined
): void {
  let synced: { value: T } | undefined;
  const restore = (): void => {
    const stored = parse(storage.get(key));
    if (stored === undefined) return;
    synced = { value: stored };
    target.value = stored;
  };
  restore();
  // Первый прогон watchField пропускает: начальное значение в хранилище не пишется.
  watchField(target, (value) => {
    if (synced !== undefined && Object.is(value, synced.value)) return;
    synced = { value };
    writeStorage(storage, key, value);
  });
  const stop = storage.subscribe?.(key, restore);
  if (stop) onScopeDispose(stop);
}

/**
 * Записать значение в хранилище. Отказ асинхронного хранилища выбор на экране не отменяет —
 * значение уже применено; в режиме разработки он попадает в консоль.
 *
 * @internal
 */
export function writeStorage(storage: StorageAdapter, key: string, value: unknown): void {
  Promise.resolve(storage.set(key, value)).catch(reportStorageError);
}

function reportStorageError(error: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[@reformer/core] хранилище уровня не сохранило выбор:', error);
  }
}

/** `localStorage`, если он есть и доступен; иначе `null`. */
function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // доступ к localStorage запрещён политикой
  }
}
