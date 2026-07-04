/**
 * Утилиты для безопасной работы с сигналами в effect контексте
 *
 * Эти утилиты решают проблему "Cycle detected" в @preact/signals-core,
 * которая возникает при модификации сигналов внутри effect.
 *
 * Отложенная запись ({@link runOutsideEffect}) откладывается на микротаск и при этом:
 * - маршрутизирует синхронные throws и async-rejection через {@link FormErrorHandler} вместо того,
 *   чтобы они всплывали неперехваченными в точке микротаска / тонули как unhandledRejection;
 * - возвращает отменитель (canceller) для liveness — вызывающий может отменить ещё не выполненную
 *   запись при dispose, чтобы она не сработала против снесённого узла/формы.
 *
 * NB: намеренно НЕ оборачиваем записи в `batch()`. Реципрокные guard'ы слоя данных (например
 * `syncFields` в {@link module:core/model/behaviors}) держат флаг «идёт синхронизация» и сбрасывают его
 * в `finally` ПОСЛЕ записи, полагаясь на то, что встречный эффект флашится СИНХРОННО во время записи
 * (вне batch). `batch()` отложил бы встречный флаш за пределы сброса флага и сломал бы эту защиту
 * (сходимость осталась бы за peek-guard'ом, но появились бы лишние круги). Коалесинг записей в один
 * batch — законная оптимизация, но она требует, чтобы эти guard'ы стали batch-aware, поэтому делается
 * не здесь. См. также `aggregateInto`, где коалесинг реализован на уровне самого оператора.
 *
 * @group Utils
 * @module utils/safe-effect
 */

import { ErrorStrategy, FormErrorHandler } from './error-handler';

const DEFER_CONTEXT = 'runOutsideEffect';

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Выполнить fn, маршрутизируя сбои через {@link FormErrorHandler} (LOG): синхронный throw
 * логируется и проглатывается (не всплывает неперехваченным из микротаска), а возвращённый промис —
 * его rejection тоже уходит в обработчик, а не тонет как unhandledRejection.
 */
function runSafely(fn: () => void | Promise<void>, context: string): void {
  try {
    const result = fn();
    if (isPromiseLike(result)) {
      result.then(undefined, (error) => FormErrorHandler.handle(error, context, ErrorStrategy.LOG));
    }
  } catch (error) {
    FormErrorHandler.handle(error, context, ErrorStrategy.LOG);
  }
}

/**
 * Создает callback, который выполняется вне контекста effect
 *
 * Откладывает вызов через {@link runOutsideEffect} — то есть получает маршрутизацию ошибок и
 * обработку async-rejection «бесплатно».
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
    runOutsideEffect(() => callback(...args));
  };
}

/**
 * Выполняет функцию вне контекста effect (отложенная запись на микротаск).
 *
 * Сбои fn (синхронный throw и async-rejection) маршрутизируются через {@link FormErrorHandler}, а не
 * всплывают неперехваченными. Возвращает отменитель: вызов до срабатывания микротаска отменяет запись
 * (liveness-охрана — не писать против снесённого узла при dispose в том же тике).
 *
 * @param fn - Функция для выполнения
 * @returns Отменитель ещё не выполненной записи (no-op, если запись уже выполнена)
 *
 * @example
 * ```typescript
 * effect(() => {
 *   const value = signal.value;
 *   const cancel = runOutsideEffect(() => {
 *     otherSignal.value = transform(value);
 *   });
 *   onDispose(cancel); // отменить ожидающую запись, если узел снесут в этом же тике
 * });
 * ```
 */
export function runOutsideEffect(fn: () => void | Promise<void>): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (cancelled) return;
    runSafely(fn, DEFER_CONTEXT);
  });
  return () => {
    cancelled = true;
  };
}

/**
 * Создает версию callback с поддержкой debounce, безопасную для effect
 *
 * `withDebounce` уже откладывает вызов (таймер) — этого достаточно для выхода из effect-контекста,
 * поэтому дополнительного `queueMicrotask` нет (устранён двойной defer). Сбои callback (в т.ч.
 * async-rejection) маршрутизируются через {@link FormErrorHandler}.
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
    withDebounce(() => runSafely(callback, 'safeDebouncedCallback'));
  };
}
