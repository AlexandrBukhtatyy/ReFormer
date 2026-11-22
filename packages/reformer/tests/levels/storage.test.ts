// @vitest-environment happy-dom
/**
 * Хранилище выбора уровней [ReFormer-cn5g.1]: `webStorage` и внутренний `bindStorage`.
 *
 * Тема и язык помнят выбор пользователя. Хранилище обязано не ломать уровень там, где его нет
 * (сервер, запрет политикой, битый JSON), не писать обратно значение, которое только что из него
 * прочитано, и подхватывать правку из другой вкладки.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import { createStore } from '../../src/model/index';
import { bindStorage, webStorage, type StorageAdapter } from '../../src/levels/storage';
import { settle } from '../test-utils/async';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Хранилище в памяти со счётчиком записей и ручным «внешним» изменением. */
function memoryStorage(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  const listeners = new Map<string, Set<() => void>>();
  const adapter: StorageAdapter & { writes: unknown[]; external(key: string, v: unknown): void } = {
    writes: [],
    get: (key) => data.get(key),
    set(key, value) {
      adapter.writes.push(value);
      data.set(key, value);
    },
    subscribe(key, onChange) {
      const set = listeners.get(key) ?? new Set();
      set.add(onChange);
      listeners.set(key, set);
      return () => set.delete(onChange);
    },
    external(key, value) {
      data.set(key, value);
      for (const l of listeners.get(key) ?? []) l();
    },
  };
  return adapter;
}

const asColor = (v: unknown) => (v === 'red' || v === 'blue' ? v : undefined);

describe('webStorage — localStorage в JSON', () => {
  it('пишет и читает JSON', () => {
    const storage = webStorage();
    storage.set('k', { a: 1 });
    expect(localStorage.getItem('k')).toBe('{"a":1}');
    expect(storage.get('k')).toEqual({ a: 1 });
    expect(storage.get('missing')).toBeUndefined();
  });

  it('битый JSON — как будто ничего не сохранено', () => {
    localStorage.setItem('k', '{не json');
    expect(webStorage().get('k')).toBeUndefined();
  });

  it('ошибка записи (квота) не бросает', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    } as unknown as Storage;
    expect(() => webStorage(broken).set('k', 1)).not.toThrow();
  });

  it('null — пустое хранилище: ничего не читает, не пишет, не подписывается', () => {
    const storage = webStorage(null);
    storage.set('k', 1);
    expect(storage.get('k')).toBeUndefined();
    const onChange = vi.fn();
    const stop = storage.subscribe!('k', onChange);
    window.dispatchEvent(new StorageEvent('storage', { key: 'k' }));
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('событие storage своего ключа будит подписчика, чужого — нет', () => {
    const storage = webStorage();
    const onChange = vi.fn();
    const stop = storage.subscribe!('theme', onChange);
    window.dispatchEvent(new StorageEvent('storage', { key: 'lang' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('событие своей области хранения будит, чужой (sessionStorage) — нет', () => {
    const storage = webStorage(localStorage);
    const onChange = vi.fn();
    const stop = storage.subscribe!('theme', onChange);
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'theme', storageArea: sessionStorage })
    );
    expect(onChange).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', storageArea: localStorage }));
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  it('без localStorage в среде (сервер) — пустое хранилище по умолчанию', () => {
    vi.stubGlobal('localStorage', undefined);
    try {
      const storage = webStorage();
      storage.set('k', 1);
      expect(storage.get('k')).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('localStorage недоступен (запрет политикой) — пустое хранилище по умолчанию', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      const storage = webStorage();
      storage.set('k', 1);
      expect(storage.get('k')).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', descriptor);
    }
  });
});

describe('bindStorage — сигнал ↔ ключ хранилища', () => {
  it('при старте валидное сохранённое значение попадает в сигнал и обратно не пишется', () => {
    const storage = memoryStorage({ color: 'blue' });
    const color = signal('red');
    const store = createStore(() => {
      bindStorage(color, storage, 'color', asColor);
      return {};
    });
    expect(color.value).toBe('blue');
    expect(storage.writes).toEqual([]);
    store.dispose();
  });

  it('негодное сохранённое значение пропускается', () => {
    const storage = memoryStorage({ color: 'green' });
    const color = signal('red');
    const store = createStore(() => {
      bindStorage(color, storage, 'color', asColor);
      return {};
    });
    expect(color.value).toBe('red');
    store.dispose();
  });

  it('изменение сигнала пишется в хранилище', () => {
    const storage = memoryStorage();
    const color = signal('red');
    const store = createStore(() => {
      bindStorage(color, storage, 'color', asColor);
      return {};
    });
    expect(storage.writes).toEqual([]); // начальное значение не пишется
    color.value = 'blue';
    expect(storage.writes).toEqual(['blue']);
    store.dispose();
    color.value = 'red';
    expect(storage.writes).toEqual(['blue']); // после снятия — не пишет
  });

  it('правка снаружи возвращается в сигнал и не пишется обратно (без эха)', () => {
    const storage = memoryStorage();
    const color = signal('red');
    const store = createStore(() => {
      bindStorage(color, storage, 'color', asColor);
      return {};
    });
    storage.external('color', 'blue');
    expect(color.value).toBe('blue');
    expect(storage.writes).toEqual([]);
    store.dispose();
    storage.external('color', 'red');
    expect(color.value).toBe('blue'); // подписка снята
  });

  it('хранилище без subscribe — только чтение при старте и запись', () => {
    const data = new Map<string, unknown>([['color', 'blue']]);
    const storage: StorageAdapter = { get: (k) => data.get(k), set: (k, v) => void data.set(k, v) };
    const color = signal('red');
    const store = createStore(() => {
      bindStorage(color, storage, 'color', asColor);
      return {};
    });
    expect(color.value).toBe('blue');
    color.value = 'red';
    expect(data.get('color')).toBe('red');
    store.dispose();
  });

  it('отказ асинхронного хранилища — предупреждение, значение на экране остаётся', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage: StorageAdapter = {
      get: () => undefined,
      set: () => Promise.reject(new Error('offline')),
    };
    const color = signal('red');
    const store = createStore(() => {
      bindStorage(color, storage, 'color', asColor);
      return {};
    });
    color.value = 'blue';
    await settle();
    expect(color.value).toBe('blue');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('не сохранило выбор'),
      expect.any(Error)
    );
    store.dispose();
  });

  it('в production отказ хранилища не шумит в консоль', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage: StorageAdapter = {
      get: () => undefined,
      set: () => Promise.reject(new Error('offline')),
    };
    const color = signal('red');
    const store = createStore(() => {
      bindStorage(color, storage, 'color', asColor);
      return {};
    });
    color.value = 'blue';
    await settle();
    expect(warn).not.toHaveBeenCalled();
    store.dispose();
  });
});
