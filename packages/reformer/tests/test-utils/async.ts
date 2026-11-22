/**
 * Ожидания для асинхронных тестов ядра.
 *
 * Поведение формы пишет часть значений отложенно: `defer` / `runOutsideEffect` — на микротаске,
 * `onChange` с `debounce` — на таймере. Тест дожидается их явно, а не «на всякий случай».
 *
 * @module test-utils/async
 */

import { vi } from 'vitest';

/** Макротаск (`setTimeout`): к его концу отработали все микротаски и таймеры с меньшей задержкой. */
export const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** `count` микротасков подряд — для цепочек `await` без таймеров. */
export async function flushMicrotasks(count = 3): Promise<void> {
  for (let i = 0; i < count; i++) await Promise.resolve();
}

/**
 * Дождаться цепочки «микротаск → макротаск → микротаск»: отложенная запись поведения (`defer`),
 * реакция на неё (`onChange` без задержки) и её собственная отложенная запись.
 */
export async function settle(): Promise<void> {
  await flushMicrotasks();
  await tick();
  await flushMicrotasks();
}

/** Ручной промис: тест сам решает, когда и чем завершится async-правило или загрузка. */
export interface Deferred<V> {
  readonly promise: Promise<V>;
  resolve(value: V): void;
  reject(error: unknown): void;
}

export function deferred<V>(): Deferred<V> {
  let resolve!: (value: V) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<V>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Фейковые часы: таймеры и `Date`, но не микротаски — отложенные записи поведения
 * (`queueMicrotask` / `Promise`) идут как обычно. Снимать — `vi.useRealTimers()` в `afterEach`.
 *
 * @param now - Текущее время часов (по умолчанию — реальное на момент вызова).
 */
export function useFakeClock(now?: Date | number): void {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    ...(now !== undefined ? { now } : {}),
  });
}

/** Продвинуть фейковые часы и дождаться промисов, которые разбудили таймеры. */
export async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}
