/**
 * Сторож тишины потока — свой, а не `timeout.chunkMs` AI SDK.
 *
 * ## Зачем свой
 *
 * Таймер SDK взводится на каждом выходном фрагменте и гасится только в конце шага — ПОСЛЕ
 * результатов инструментов. То есть он идёт и пока инструмент исполняется. Обычным инструментам
 * это не мешает: они отвечают за миллисекунды. Но `ask_user` ждёт человека, и минута раздумий над
 * вопросом обрывала бы ход «сервер замолчал». Остановить таймер SDK на время ожидания нечем,
 * поэтому сторож свой: он умеет паузу.
 *
 * ## Что он ловит
 *
 * Ровно то же, что ловил таймер SDK: сервер замолчал посреди ответа. Взводится на выходных частях
 * потока (и на начале шага — ответ пошёл), снимается на конце шага: пока сервер разбирает запрос
 * следующего шага, таймера нет, как нет его и до первого фрагмента хода (`firstChunkMs` не задавался
 * и прежде — крупная модель честно думает над длинным промптом минуту и больше).
 *
 * @module plugins/forms/ai/providers/watchdog
 */

/** Части потока, на которых сторож взводится заново: ответ идёт. */
const ARMING_PARTS: ReadonlySet<string> = new Set([
  'start-step',
  'text-delta',
  'reasoning-delta',
  'tool-input-start',
  'tool-input-delta',
  'tool-call',
]);

export interface Watchdog {
  /** Срабатывает, когда поток молчит дольше предела. */
  readonly signal: AbortSignal;
  /** Сработал ли сторож — по этому отличают его обрыв от кнопки «Остановить». */
  readonly fired: boolean;
  /** Пришла часть потока: взвести таймер заново, а на конце шага — снять. */
  observe(partType: string): void;
  /** Инструмент ждёт человека: таймер стоит, пока не вернутся все такие инструменты. */
  suspend(): void;
  resume(): void;
  dispose(): void;
}

/**
 * @param ms - Предел тишины; `null` — сторожа нет (локальный канал: его молчание — работа).
 */
export function createWatchdog(ms: number | null): Watchdog {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = 0;
  let running = false;
  let fired = false;

  const clear = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const arm = (): void => {
    clear();
    if (ms === null || paused > 0 || fired) return;
    timer = setTimeout(() => {
      fired = true;
      controller.abort(new Error('поток молчит дольше предела'));
    }, ms);
  };

  return {
    signal: controller.signal,
    get fired() {
      return fired;
    },
    observe(partType) {
      if (ARMING_PARTS.has(partType)) {
        running = true;
        arm();
      } else if (partType === 'finish-step') {
        running = false;
        clear();
      }
    },
    suspend() {
      paused += 1;
      clear();
    },
    resume() {
      paused = Math.max(0, paused - 1);
      if (paused === 0 && running) arm();
    },
    dispose: clear,
  };
}

/** Сигнал, срабатывающий от любого из данных. Свой — чтобы не зависеть от `AbortSignal.any`. */
export function anySignal(...signals: readonly (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal === undefined) continue;
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
