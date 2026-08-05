/**
 * Хранилище в памяти — всегда доступный запасной вариант.
 *
 * Персистентности не даёт (живёт до первого F5), но нужно по двум причинам: это единственная
 * стратегия, работающая в node и в тестах без эмуляции браузерных API, и это гарантированный
 * последний элемент цепочки `pickStorage` — кэш никогда не «отсутствует», он лишь становится
 * менее долговечным.
 *
 * @module reformer/form-registry/storage/memory
 */

import {
  DEFAULT_MAX_BYTES,
  selectEvictions,
  type StorageOptions,
  type StorageStrategy,
  type StoredRecord,
} from './types';

export function createMemoryStorage(opts: StorageOptions = {}): StorageStrategy {
  const max = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const map = new Map<string, StoredRecord>();
  let usage = 0;

  const evictIfNeeded = (): void => {
    for (const key of selectEvictions([...map.values()], usage, max)) {
      const rec = map.get(key);
      if (rec) {
        usage -= rec.size;
        map.delete(key);
      }
    }
  };

  return {
    name: 'memory',

    async get(key) {
      const rec = map.get(key);
      if (!rec) return undefined;
      // Чтение обновляет возраст — иначе LRU выродится в FIFO.
      const touched = { ...rec, lastUsedAt: Date.now() };
      map.set(key, touched);
      return touched;
    },

    async set(rec) {
      const prev = map.get(rec.key);
      if (prev) usage -= prev.size;
      map.set(rec.key, rec);
      usage += rec.size;
      evictIfNeeded();
    },

    async delete(key) {
      const rec = map.get(key);
      if (rec) {
        usage -= rec.size;
        map.delete(key);
      }
    },

    async keys() {
      return [...map.keys()];
    },

    async clear() {
      map.clear();
      usage = 0;
    },

    async estimate() {
      return { usage, quota: max };
    },
  };
}

/** Стратегия по умолчанию: доступна всегда и везде. */
export const defaultStorage: StorageStrategy = createMemoryStorage();
