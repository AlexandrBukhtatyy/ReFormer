/**
 * Примитивы ожидания на стороне страницы. Единственный способ e2e дождаться результата внутри окна
 * замера — один промис отсюда, без поллинга из Node.
 */
import { serverControl } from '../api/server';

/** Конец работы main thread в следующем кадре: rAF → MessageChannel. */
export function frameEnd(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => resolve(performance.now());
      ch.port2.postMessage(null);
    });
  });
}

function idleCallback(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function')
      requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 0);
  });
}

export interface IdleOptions {
  /** Ждать завершения запросов и debounce-таймеров API (по умолчанию да). */
  network?: boolean;
  /** Предел ожидания, мс. */
  timeout?: number;
}

/**
 * Покой страницы: нет запросов/таймеров API, прошли два кадра и idle-callback. Возвращает момент
 * покоя (`performance.now()`). Бросает по таймауту — сломанная реализация не должна висеть вечно.
 */
export async function idle({
  network = true,
  timeout = 10_000,
}: IdleOptions = {}): Promise<number> {
  const start = performance.now();
  for (;;) {
    if (performance.now() - start > timeout) throw new Error(`idle: timeout ${timeout}ms`);
    await frameEnd();
    if (network && serverControl.pending() > 0) continue;
    await frameEnd();
    await idleCallback(100);
    if (!network || serverControl.pending() === 0) return performance.now();
  }
}

/** Ждать условия по кадрам; возвращает момент конца кадра, в котором условие выполнилось. */
export async function untilFrame(cond: () => boolean, timeout = 10_000): Promise<number> {
  const start = performance.now();
  for (;;) {
    const t = await frameEnd();
    if (cond()) return t;
    if (t - start > timeout) throw new Error(`untilFrame: timeout ${timeout}ms`);
  }
}
