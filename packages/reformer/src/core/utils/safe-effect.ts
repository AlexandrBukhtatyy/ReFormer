/**
 * Утилиты для безопасной работы с сигналами в effect контексте
 *
 * Эти утилиты решают проблему "Cycle detected" в @preact/signals-core,
 * которая возникает при модификации сигналов внутри effect.
 *
 * @group Utils
 * @module utils/safe-effect
 */

/**
 * Создает callback, который выполняется вне контекста effect
 *
 * Использует queueMicrotask для отложенного выполнения,
 * что позволяет модифицировать сигналы без вызова "Cycle detected"
 *
 * @param callback - Функция для выполнения
 * @returns Обёрнутая функция, безопасная для вызова внутри effect
 *
 * @example
 * ```typescript
 * // Вместо:
 * effect(() => {
 *   queueMicrotask(() => {
 *     callback(value, context);
 *   });
 * });
 *
 * // Используем:
 * effect(() => {
 *   safeCallback(callback)(value, context);
 * });
 * ```
 */
export function safeCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void | Promise<void>
): (...args: TArgs) => void {
  return (...args: TArgs) => {
    queueMicrotask(() => callback(...args));
  };
}

/**
 * Выполняет функцию вне контекста effect
 *
 * Более простой вариант для одиночного вызова
 *
 * @param fn - Функция для выполнения
 *
 * @example
 * ```typescript
 * effect(() => {
 *   const value = signal.value;
 *   runOutsideEffect(() => {
 *     otherSignal.value = transform(value);
 *   });
 * });
 * ```
 */
export function runOutsideEffect(fn: () => void | Promise<void>): void {
  queueMicrotask(fn);
}

/**
 * Создает версию callback с поддержкой debounce, безопасную для effect
 *
 * Комбинирует debounce логику с выходом из effect контекста
 *
 * @param callback - Функция для выполнения
 * @param withDebounce - Функция debounce обёртки из BehaviorRegistry
 * @returns Обёрнутая функция
 *
 * @example
 * ```typescript
 * return effect(() => {
 *   const value = node.value.value;
 *   safeDebouncedCallback(
 *     () => callback(value, context),
 *     withDebounce
 *   )();
 * });
 * ```
 */
export function safeDebouncedCallback(
  callback: () => void | Promise<void>,
  withDebounce: (fn: () => void) => void
): () => void {
  return () => {
    withDebounce(() => {
      queueMicrotask(callback);
    });
  };
}
