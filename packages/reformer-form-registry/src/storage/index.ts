/**
 * Персистентный кэш форм: выбор стратегии хранения.
 *
 * @module reformer/form-registry/storage
 */

export {
  DEFAULT_MAX_BYTES,
  DEFAULT_NAMESPACE,
  byteLength,
  cacheKey,
  selectEvictions,
  type StorageKind,
  type StorageOptions,
  type StorageStrategy,
  type StoredRecord,
} from './types';
export { createMemoryStorage, defaultStorage } from './memory';
export { createIndexedDbStorage, isIndexedDbAvailable } from './indexeddb';
export { createOpfsStorage, isOpfsAvailable, type OpfsOptions } from './opfs';

import type { StorageKind, StorageOptions, StorageStrategy } from './types';
import { createMemoryStorage } from './memory';
import { createIndexedDbStorage, isIndexedDbAvailable } from './indexeddb';
import { createOpfsStorage, isOpfsAvailable } from './opfs';

/**
 * Порядок предпочтения по умолчанию.
 *
 * Это НАСТРОЙКА, а не архитектурное решение: порядок подтверждается замером на реальных схемах
 * (68 КБ у кредитной заявки) и меняется одной строкой, не трогая ни одного потребителя.
 */
export const DEFAULT_STORAGE_ORDER: readonly StorageKind[] = ['opfs', 'indexeddb', 'memory'];

/**
 * Первая доступная стратегия из списка.
 *
 * Проверяется не только наличие API, но и работоспособность: в приватном режиме части движков
 * `indexedDB` объявлен, а открытие БД падает. Поэтому кандидат проверяется пробной операцией —
 * иначе отказ всплыл бы при первой записи схемы, далеко от места выбора.
 */
export async function pickStorage(
  order: readonly StorageKind[] = DEFAULT_STORAGE_ORDER,
  opts: StorageOptions = {}
): Promise<StorageStrategy> {
  for (const kind of order) {
    try {
      if (kind === 'opfs') {
        if (!isOpfsAvailable()) continue;
        const s = createOpfsStorage(opts);
        await s.keys();
        return s;
      }
      if (kind === 'indexeddb') {
        if (!isIndexedDbAvailable()) continue;
        const s = createIndexedDbStorage(opts);
        await s.keys();
        return s;
      }
      if (kind === 'memory') return createMemoryStorage(opts);
    } catch {
      // Кандидат объявлен, но не работает — берём следующий.
    }
  }
  // Память доступна всегда: «кэша нет» — не то состояние, в которое стоит попадать.
  return createMemoryStorage(opts);
}
