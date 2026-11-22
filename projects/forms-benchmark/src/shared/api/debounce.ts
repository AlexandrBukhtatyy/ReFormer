/**
 * Debounce + кэш запросов клиента (BENCH-CONTRACT §3) — одна реализация на все эндпоинты с
 * задержкой: проверки регистрации, модели авто, код из СМС.
 */
import { trackTimer } from './server';

export const ASYNC_CHECK_DEBOUNCE_MS = 300;

/**
 * Пауза ввода пользователя: момент последнего события `input` в документе. Debounce отсчитывается от
 * него, а не от вызова проверки — запрос уходит, когда пользователь 300 мс ничего не вводит. Проверка,
 * вызванная после паузы (например, при отправке формы), выполняется сразу: иначе библиотеки, которые
 * до отправки проверок не делают, платили бы на отправке искусственные 300 мс.
 */
let lastInputAt = Number.NEGATIVE_INFINITY;
if (typeof document !== 'undefined') {
  document.addEventListener('input', () => (lastInputAt = performance.now()), { capture: true });
}

/**
 * Debounce по КЛЮЧУ значения, а не по вызову: повторный вызов с тем же ключом присоединяется к
 * ожидающему (тот же промис, таймер не сбрасывается), новый ключ вытесняет ожидающий — тот отвечает
 * `undefined` («устарело»). Так библиотеки, которые на каждое изменение перепроверяют всю схему (и
 * вызывают проверку неизменённого поля снова), не теряют его результат. Готовые ответы — из кэша
 * сразу; ошибка запроса из кэша удаляется и даёт `undefined`. Задержка — до конца паузы ввода
 * (`lastInputAt + 300 мс`); если пауза уже прошла, запрос уходит без задержки.
 */
export function debouncedByKey<T, R>(
  key: (value: T) => string,
  run: (value: T) => Promise<R>
): (value: T) => Promise<R | undefined> {
  const cache = new Map<string, Promise<R>>();
  let pending: {
    key: string;
    promise: Promise<R | undefined>;
    timer: ReturnType<typeof setTimeout>;
    settle: () => void;
    supersede: () => void;
  } | null = null;

  const supersedePending = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.settle();
    pending.supersede();
    pending = null;
  };

  return (value) => {
    const k = key(value);
    if (pending?.key === k) return pending.promise;
    supersedePending();

    const cached = cache.get(k);
    if (cached) return cached;

    const execute = (): Promise<R> => {
      let request = cache.get(k);
      if (!request) {
        request = run(value);
        cache.set(k, request);
        request.catch(() => cache.delete(k));
      }
      return request;
    };

    const delay = lastInputAt + ASYNC_CHECK_DEBOUNCE_MS - performance.now();
    if (delay <= 0) return execute().catch(() => undefined);

    let resolveFn!: (v: R | undefined) => void;
    const promise = new Promise<R | undefined>((resolve) => (resolveFn = resolve));
    const settle = trackTimer();
    const timer = setTimeout(() => {
      pending = null;
      settle();
      execute().then(resolveFn, () => resolveFn(undefined));
    }, delay);
    pending = { key: k, promise, timer, settle, supersede: () => resolveFn(undefined) };
    return promise;
  };
}
