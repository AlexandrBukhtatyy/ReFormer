/**
 * Утилиты для безопасной работы с сигналами в effect контексте
 *
 * Эти утилиты решают проблему "Cycle detected" в @preact/signals-core,
 * которая возникает при модификации сигналов внутри effect.
 *
 * Отложенная запись ({@link runOutsideEffect}) откладывается на микротаск и при этом:
 * - маршрутизирует синхронные throws и async-rejection dev-логгером (logDeferError) вместо того,
 *   чтобы они всплывали неперехваченными в точке микротаска / тонули как unhandledRejection;
 * - возвращает отменитель (canceller) для liveness — вызывающий может отменить ещё не выполненную
 *   запись при dispose, чтобы она не сработала против снесённого узла/формы.
 *
 * NB: намеренно НЕ оборачиваем записи в `batch()`. Реципрокные guard'ы слоя данных (например
 * `syncFields` в модуле state/behaviors-value) держат флаг «идёт синхронизация» и сбрасывают его
 * в `finally` ПОСЛЕ записи, полагаясь на то, что встречный эффект флашится СИНХРОННО во время записи
 * (вне batch). `batch()` отложил бы встречный флаш за пределы сброса флага и сломал бы эту защиту
 * (сходимость осталась бы за peek-guard'ом, но появились бы лишние круги). Коалесинг записей в один
 * batch — законная оптимизация, но она требует, чтобы эти guard'ы стали batch-aware, поэтому делается
 * не здесь. См. также `aggregateInto`, где коалесинг реализован на уровне самого оператора.
 *
 * @group Utils
 * @module model/safe-effect
 */

const DEFER_CONTEXT = 'runOutsideEffect';

/**
 * Dev-логирование сбоя отложенной записи (state-слой не зависит от слоя формы).
 * В проде вырезается бандлером консумента (process.env.NODE_ENV), сама ошибка проглатывается —
 * отложенная запись «best-effort» и не должна ронять микротаск/всплывать как unhandledRejection.
 */
function logDeferError(error: unknown, context: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${context}]`, error);
  }
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Выполнить fn, маршрутизируя сбои dev-логгером (logDeferError) (LOG): синхронный throw
 * логируется и проглатывается (не всплывает неперехваченным из микротаска), а возвращённый промис —
 * его rejection тоже уходит в обработчик, а не тонет как unhandledRejection.
 */
function runSafely(fn: () => void | Promise<void>, context: string): void {
  try {
    const result = fn();
    if (isPromiseLike(result)) {
      result.then(undefined, (error) => logDeferError(error, context));
    }
  } catch (error) {
    logDeferError(error, context);
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
 * Сбои fn (синхронный throw и async-rejection) маршрутизируются dev-логгером (logDeferError), а не
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
  if (assemblyQueue !== null) {
    const entry: AssemblyWrite = { fn, cancelled: false };
    assemblyQueue.push(entry);
    return () => {
      entry.cancelled = true;
    };
  }
  let cancelled = false;
  scheduled++;
  queueMicrotask(() => {
    scheduled--;
    if (cancelled) return;
    runSafely(fn, DEFER_CONTEXT);
  });
  return () => {
    cancelled = true;
  };
}

/** Сколько отложенных записей поставлено и ещё не дошло до своего микротаска. */
let scheduled = 0;

interface AssemblyWrite {
  fn: () => void | Promise<void>;
  cancelled: boolean;
}

/** Записи, отложенные во время сборки ({@link runAssemblyWrites}); `null` — сборка не идёт. */
let assemblyQueue: AssemblyWrite[] | null = null;

/**
 * Предел записей сборки: дальше очередь уходит на микротаски, как без сборки. Поведения, которые
 * пишут друг другу без конца, так не подвешивают `createForm` — они крутятся там же, где и раньше.
 */
const ASSEMBLY_WRITES_LIMIT = 1000;

/**
 * Выполнить сборку так, чтобы записи, отложенные ею, выполнились до возврата, — вместе с теми, что
 * они породили (копия `syncFields`, нормализация `transformValue`, сброс выключенного поля).
 *
 * Без этого первые записи поведения приходили бы на микротаске, уже после сборки, и точка отсчёта
 * модели, снятая в конце сборки, их бы не видела: пара `syncFields` попала бы в неё рассогласованной,
 * и `form.reset()` вернул бы её не к собранному состоянию, а к полусобранному.
 *
 * Записи выполняются вне `batch()` — как на микротаске: встречные эффекты флашатся синхронно (см.
 * комментарий модуля). Вложенная сборка своих записей не выполняет — это сделает внешняя.
 *
 * @param build - Сборка: подключение поведения.
 * @returns То, что вернула сборка.
 * @internal
 */
export function runAssemblyWrites<R>(build: () => R): R {
  if (assemblyQueue !== null) return build();
  const queue: AssemblyWrite[] = [];
  assemblyQueue = queue;
  let done = 0;
  try {
    const result = build();
    while (done < queue.length && done < ASSEMBLY_WRITES_LIMIT) {
      const entry = queue[done++]!;
      if (!entry.cancelled) runSafely(entry.fn, DEFER_CONTEXT);
    }
    return result;
  } finally {
    assemblyQueue = null;
    // Сборка упала или упёрлась в предел — оставшиеся записи идут обычным путём, на микротаске.
    // Отменитель, выданный при постановке, продолжает действовать: флаг проверяется при запуске.
    for (const entry of queue.slice(done)) {
      if (!entry.cancelled) runOutsideEffect(() => (entry.cancelled ? undefined : entry.fn()));
    }
  }
}

/**
 * Дождаться, пока отработают отложенные записи текущего тика — вместе с теми, что они породили
 * (цепочка расчётов: каждая запись будит следующий расчёт, а тот снова пишет отложенно).
 *
 * Ждёт только микротаски: запись после таймера (debounce) или после `await` в async-callback сюда не
 * входит — это уже не «тот же тик».
 *
 * Счётчик общий для рантайма, а не для одной модели: отложенные записи ставит {@link runOutsideEffect},
 * а он моделей не различает. Нужен проверкам «по действию» — отправке и переходу шага: правила должны
 * увидеть модель после записей поведения того же тика (колбэк `onChange`, сброс `resetOnDisable`).
 *
 * @returns Промис ожидания; `undefined` — отложенных записей сейчас нет, ждать нечего.
 *
 * @example
 * ```typescript
 * model.loanType = 'mortgage'; // поведение допишет зависимые поля на микротаске
 * await deferredWritesSettled();
 * const values = model.get(); // уже с записями поведения
 * ```
 */
export function deferredWritesSettled(): Promise<void> | undefined {
  if (scheduled === 0) return undefined;
  return new Promise((resolve) => {
    const check = (): void => {
      if (scheduled > 0) queueMicrotask(check);
      else resolve();
    };
    queueMicrotask(check);
  });
}

/**
 * Отложенные записи одной операции: задание выполняется на микротаске ({@link runOutsideEffect}),
 * а `cancelAll` отменяет все ещё не выполненные — при снятии операции (запись после cleanup не
 * случится) или когда новое задание делает ожидающие устаревшими (побеждает последнее).
 *
 * @internal
 */
export function deferredWrites(): { schedule(job: () => void): void; cancelAll(): void } {
  const pending = new Set<() => void>();
  return {
    schedule(job) {
      const cancel = runOutsideEffect(() => {
        pending.delete(cancel);
        job();
      });
      pending.add(cancel);
    },
    cancelAll() {
      pending.forEach((cancel) => cancel());
      pending.clear();
    },
  };
}

/**
 * Создает версию callback с поддержкой debounce, безопасную для effect
 *
 * `withDebounce` уже откладывает вызов (таймер) — этого достаточно для выхода из effect-контекста,
 * поэтому дополнительного `queueMicrotask` нет (устранён двойной defer). Сбои callback (в т.ч.
 * async-rejection) маршрутизируются dev-логгером (logDeferError).
 *
 * @param callback - Функция для выполнения
 * @param withDebounce - Обёртка, откладывающая вызов (debounce)
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
