/**
 * Генератор уникальных идентификаторов
 *
 * Использует атомный счётчик для генерации гарантированно уникальных ключей.
 * Решает проблему возможного дублирования ключей при использовании
 * Date.now() + Math.random() в быстрых последовательных вызовах.
 *
 * @example
 * ```typescript
 * const key1 = uniqueId('watch'); // "watch-1"
 * const key2 = uniqueId('watch'); // "watch-2"
 * const key3 = uniqueId('effect'); // "effect-3"
 * ```
 */

let counter = 0;

/**
 * Генерирует уникальный идентификатор с указанным префиксом
 *
 * @param prefix - Префикс для идентификатора
 * @returns Уникальный идентификатор в формате `${prefix}-${counter}`
 */
export function uniqueId(prefix: string): string {
  return `${prefix}-${++counter}`;
}

/**
 * Сбросить счётчик (только для тестов)
 * @internal
 */
export function resetUniqueIdCounter(): void {
  counter = 0;
}
