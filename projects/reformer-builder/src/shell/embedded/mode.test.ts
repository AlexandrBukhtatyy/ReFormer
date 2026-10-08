/**
 * Режим билдера: переживает перезагрузку страницы и не падает без хранилища.
 *
 * @module shell/embedded/mode.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createModeStore, MODE_STORAGE_KEY, type ModeStorage } from './mode';

function memoryStorage(initial: Record<string, string> = {}): ModeStorage & {
  readonly entries: Map<string, string>;
} {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

describe('режим билдера', () => {
  it('по умолчанию выключен: приложение открывается приложением', () => {
    expect(createModeStore(memoryStorage()).get()).toBe(false);
  });

  it('включённый режим восстанавливается после перезагрузки страницы', () => {
    const storage = memoryStorage();
    createModeStore(storage).set(true);

    // Новое хранилище режима над тем же хранилищем страницы — это и есть перезагрузка.
    expect(createModeStore(storage).get()).toBe(true);
  });

  it('выключение снимает запись, а не пишет «выключено»', () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: 'on' });
    createModeStore(storage).set(false);

    expect(storage.entries.has(MODE_STORAGE_KEY)).toBe(false);
  });

  it('подписчик узнаёт о смене и не узнаёт о повторе того же значения', () => {
    const store = createModeStore(memoryStorage());
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(true);
    store.set(true);
    store.set(false);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('отписавшийся подписчик больше не зовётся', () => {
    const store = createModeStore(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.set(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('без хранилища режим живёт в памяти страницы', () => {
    const store = createModeStore(null);

    store.set(true);

    expect(store.get()).toBe(true);
  });

  it('хранилище, отказавшее в доступе, не роняет ни чтение, ни запись', () => {
    const denied: ModeStorage = {
      getItem: () => {
        throw new Error('доступ запрещён');
      },
      setItem: () => {
        throw new Error('доступ запрещён');
      },
      removeItem: () => {
        throw new Error('доступ запрещён');
      },
    };
    const store = createModeStore(denied);

    expect(store.get()).toBe(false);
    expect(() => {
      store.set(true);
    }).not.toThrow();
    expect(store.get()).toBe(true);
  });
});
