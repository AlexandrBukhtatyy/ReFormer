/**
 * In-memory «сервер» бенчмарка: латентность, ручной flush, счётчики вызовов (BENCH-CONTRACT §5).
 *
 * Ответ вычисляется в момент запроса (как сессия на реальном сервере), а доставляется после
 * задержки `latency` мс или по `flush()` в режиме `latency=manual`.
 */

export type Latency = number | 'manual';

const params = new URLSearchParams(globalThis.location?.search ?? '');

function readLatency(): Latency {
  const raw = params.get('latency');
  if (raw === 'manual') return 'manual';
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

export const serverConfig = {
  latency: readLatency(),
  seed: Number(params.get('seed') ?? 1) || 1,
  invite: params.get('invite'),
  /** Кредит: id сохранённой заявки (`?application=1`) — данные заявки = исходное состояние. */
  application: params.get('application'),
};

const calls: Record<string, number> = {};
const queue: Array<() => void> = [];
let inflight = 0;
let timers = 0;

export function request<T>(endpoint: string, handler: () => T): Promise<T> {
  calls[endpoint] = (calls[endpoint] ?? 0) + 1;
  inflight++;
  let result: T;
  let error: unknown;
  try {
    result = handler();
  } catch (e) {
    error = e;
  }
  return new Promise<T>((resolve, reject) => {
    const deliver = () => {
      inflight--;
      if (error !== undefined) reject(error);
      else resolve(result);
    };
    if (serverConfig.latency === 'manual') queue.push(deliver);
    else setTimeout(deliver, serverConfig.latency);
  });
}

/** Отложенные таймеры клиента (debounce) тоже считаются незавершённой сетевой работой. */
export function trackTimer(): () => void {
  timers++;
  let done = false;
  return () => {
    if (!done) {
      done = true;
      timers--;
    }
  };
}

export const serverControl = {
  calls,
  /** Доставить все ответы, ждущие в режиме `manual`. Возвращает их число. */
  flush(): number {
    const n = queue.length;
    queue.splice(0).forEach((deliver) => deliver());
    return n;
  },
  /** Запросы в полёте + ждущие debounce-таймеры. */
  pending(): number {
    return inflight + timers;
  },
  resetCalls(): void {
    for (const key of Object.keys(calls)) delete calls[key];
  },
};
