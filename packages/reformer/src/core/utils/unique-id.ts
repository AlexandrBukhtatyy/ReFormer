/**
 * Генератор уникальных идентификаторов
 *
 * Использует атомный счётчик для генерации гарантированно уникальных ключей.
 * Решает проблему возможного дублирования ключей при использовании
 * Date.now() + Math.random() в быстрых последовательных вызовах.
 *
 * @example
 * ```typescript
 * const key1 = uniqueId(SubscriptionKey.Watch); // "watch-1"
 * const key2 = uniqueId(SubscriptionKey.Watch); // "watch-2"
 * const key3 = uniqueId(SubscriptionKey.ComputeFrom); // "computeFrom-3"
 * ```
 */

/**
 * Типобезопасные ключи для подписок
 * Используются с uniqueId() для генерации уникальных идентификаторов
 */
export const SubscriptionKey = {
  /** FieldNode.watch() */
  Watch: 'watch',
  /** FieldNode.computeFrom() */
  ComputeFrom: 'computeFrom',
  /** GroupNode.linkFields() */
  LinkFields: 'linkFields',
  /** GroupNode.watchField() */
  WatchField: 'watchField',
  /** ArrayNode.watchItems() */
  WatchItems: 'watchItems',
  /** ArrayNode.watchLength() */
  WatchLength: 'watchLength',
} as const;

export type SubscriptionKeyType = (typeof SubscriptionKey)[keyof typeof SubscriptionKey];

let counter = 0;

/**
 * Генерирует уникальный идентификатор с указанным префиксом.
 *
 * @param prefix - Префикс для идентификатора (используйте {@link SubscriptionKey}).
 * @returns Уникальный идентификатор в формате `${prefix}-${counter}`.
 *
 * @example
 * ```typescript
 * import { uniqueId, SubscriptionKey } from '@reformer/core';
 *
 * uniqueId(SubscriptionKey.WatchField); // → 'watchField-1'
 * uniqueId(SubscriptionKey.WatchField); // → 'watchField-2'
 * ```
 */
export function uniqueId(prefix: SubscriptionKeyType): string {
  return `${prefix}-${++counter}`;
}

/**
 * Сбросить счётчик (только для тестов)
 * @internal
 */
export function resetUniqueIdCounter(): void {
  counter = 0;
}
