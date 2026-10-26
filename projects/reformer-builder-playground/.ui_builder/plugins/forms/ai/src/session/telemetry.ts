/**
 * Замер хода: запросы к модели и фазы обвязки — чего стоил ход и где ушло время.
 *
 * Ход ассистента на локальной модели идёт минутами, и «долго» без разбивки не чинится: время уходит
 * и на модель (чтение контекста сервером, рассуждение, вывод), и на обвязку (шаблоны, создание
 * формы, чтение модуля, запись, генерация кода). Поэтому ход меряется целиком:
 *
 * - **запросы** — из статистики попыток (`../loop/drive`): время, время до первого куска, токены;
 * - **фазы** — отрезками вокруг работы моста; каждый отрезок заодно ставит меру
 *   `performance.measure('rb:ai.<фаза>')` — её видно в DevTools (Performance → Timings) без
 *   пересборки, с тем же префиксом, что у мер запуска оболочки.
 *
 * Сводка печатается одной строкой в консоль на ход; с `?rb-trace` в адресе — ещё и таблицами.
 * Тот же объект уходит наблюдателю моста (`BridgeDeps.telemetry`) — замер на живой модели пишет
 * его в отчёт.
 *
 * @module plugins/forms/ai/session/telemetry
 */

import type { AiStop } from '../providers/types';
import type { Clock, RequestStats, TurnStats } from '../loop/drive';

/** Приставка мер: та же, что у мер запуска оболочки, — сводка `?rb-trace` отбирает по ней. */
const TRACE_PREFIX = 'rb:ai.';

/** Попытка хода: её запросы и чем она кончилась. */
export interface AttemptTelemetry {
  readonly steps: number;
  readonly requests: readonly RequestStats[];
  readonly stop?: AiStop;
}

/** Замер хода целиком. */
export interface TurnTelemetry {
  /** От начала хода до его конца, мс. */
  readonly totalMs: number;
  /** Сумма времени запросов к модели, мс. */
  readonly modelMs: number;
  readonly attempts: readonly AttemptTelemetry[];
  /** Все запросы хода по порядку — сквозь попытки. */
  readonly requests: readonly RequestStats[];
  /** Фазы обвязки: имя → сумма мс и сколько раз. */
  readonly phases: Readonly<Record<string, { readonly ms: number; readonly count: number }>>;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly reasoningChars: number;
}

/** Замер одного хода. */
export interface TurnClock {
  /** Открыть отрезок фазы; возвращённая функция закрывает его. Повторный вызов — пустой. */
  span(name: string): () => void;
  /** Провести работу отрезком фазы. */
  time<T>(name: string, work: () => Promise<T>): Promise<T>;
  /** Учесть попытку хода. */
  attempt(stats: TurnStats, stop?: AiStop): void;
  /** Закончить замер. */
  finish(): TurnTelemetry;
}

const defaultClock: Clock = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

function measure(name: string, start: number, end: number): void {
  try {
    if (typeof performance !== 'undefined') {
      performance.measure(TRACE_PREFIX + name, { start, end });
    }
  } catch {
    // Замер — наблюдение, а не часть хода: его отказ ход не задевает.
  }
}

/** Завести замер хода. `clock` — часы; `measured` — ставить ли меры `performance` (не в тестах). */
export function createTurnClock(
  clock: Clock = defaultClock,
  measured = clock === defaultClock
): TurnClock {
  const started = clock();
  const phases = new Map<string, { ms: number; count: number }>();
  const attempts: AttemptTelemetry[] = [];

  const span = (name: string): (() => void) => {
    const start = clock();
    let open = true;
    return () => {
      if (!open) return;
      open = false;
      const end = clock();
      const phase = phases.get(name) ?? { ms: 0, count: 0 };
      phase.ms += end - start;
      phase.count += 1;
      phases.set(name, phase);
      if (measured) measure(name, start, end);
    };
  };

  const turnClock: TurnClock = {
    span,
    async time(name, work) {
      const close = span(name);
      try {
        return await work();
      } finally {
        close();
      }
    },
    attempt(stats, stop) {
      attempts.push({
        steps: stats.steps,
        requests: [...stats.requests],
        ...(stop === undefined ? {} : { stop }),
      });
    },
    finish() {
      const requests = attempts.flatMap((attempt) => attempt.requests);
      const sum = (pick: (request: RequestStats) => number | undefined): number =>
        requests.reduce((total, request) => total + (pick(request) ?? 0), 0);
      return {
        totalMs: clock() - started,
        modelMs: sum((request) => request.ms),
        attempts,
        requests,
        phases: Object.fromEntries(phases),
        inputTokens: sum((request) => request.inputTokens),
        cachedInputTokens: sum((request) => request.cachedInputTokens),
        outputTokens: sum((request) => request.outputTokens),
        reasoningTokens: sum((request) => request.reasoningTokens),
        reasoningChars: sum((request) => request.reasoningChars),
      };
    },
  };
  return turnClock;
}

/** Секунды с одним знаком: «1,2 с» читается быстрее, чем «1234 мс». */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} с`;
}

/** Почему кончилась попытка — для строки сводки. */
function stopOf(stop: AiStop | undefined): string {
  if (stop === undefined) return '';
  const parts = [
    stop.reason === undefined ? '' : `${stop.reason}${stop.raw ? ` (${stop.raw})` : ''}`,
    stop.truncatedCall === undefined ? '' : `оборван вызов ${stop.truncatedCall}`,
    stop.textualCall === undefined ? '' : `вызов ${stop.textualCall} написан текстом`,
  ].filter((part) => part !== '');
  return parts.join(', ');
}

/**
 * Сводка хода одной строкой — в консоль.
 *
 * Цифры, по которым видно, куда ушло время: запросы и их сумма, первый кусок (чтение контекста
 * сервером), рассуждение и вывод, самые долгие фазы обвязки и причины остановки попыток.
 */
export function formatTurn(telemetry: TurnTelemetry): string {
  const { requests } = telemetry;
  const firsts = requests
    .map((request) => request.firstChunkMs)
    .filter((ms): ms is number => ms !== undefined);
  const firstChunk =
    firsts.length === 0
      ? ''
      : `, до первого куска ${seconds(firsts.reduce((a, b) => a + b, 0) / firsts.length)} в среднем`;
  const tokens =
    telemetry.inputTokens > 0
      ? `, вход ${telemetry.inputTokens} (из кэша ${telemetry.cachedInputTokens}), выход ` +
        `${telemetry.outputTokens}`
      : '';
  const reasoning =
    telemetry.reasoningTokens > 0
      ? `, рассуждение ${telemetry.reasoningTokens} ток.`
      : telemetry.reasoningChars > 0
        ? `, рассуждение ${telemetry.reasoningChars} симв.`
        : '';
  const cut = requests.filter((request) => request.cut).length;
  const phases = Object.entries(telemetry.phases)
    .filter(([, phase]) => phase.ms >= 50)
    .sort(([, a], [, b]) => b.ms - a.ms)
    .map(
      ([name, phase]) => `${name} ${seconds(phase.ms)}${phase.count > 1 ? ` ×${phase.count}` : ''}`
    );
  const stops = telemetry.attempts.map((attempt) => stopOf(attempt.stop)).filter(Boolean);
  return (
    `[plugins/forms/ai] ход ${seconds(telemetry.totalMs)}: запросов ${requests.length}` +
    `${cut > 0 ? ` (оборвано ${cut})` : ''}, модель ${seconds(telemetry.modelMs)}${firstChunk}` +
    `${tokens}${reasoning}` +
    `${phases.length > 0 ? `; обвязка: ${phases.join(', ')}` : ''}` +
    `${stops.length > 0 ? `; остановка: ${stops.join(' | ')}` : ''}`
  );
}

/** Включена ли подробная сводка (`?rb-trace` в адресе страницы). */
export function traceRequested(): boolean {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('rb-trace');
  } catch {
    return false;
  }
}

/** Подробная сводка — таблицами запросов и фаз, для `?rb-trace`. */
export function printTurnTables(telemetry: TurnTelemetry): void {
  console.table(
    telemetry.requests.map((request, index) => ({
      '№': index + 1,
      с: +(request.ms / 1000).toFixed(1),
      'до 1-го куска, с':
        request.firstChunkMs === undefined ? '' : +(request.firstChunkMs / 1000).toFixed(1),
      вход: request.inputTokens ?? '',
      'из кэша': request.cachedInputTokens ?? '',
      выход: request.outputTokens ?? '',
      рассуждение: request.reasoningTokens ?? `${request.reasoningChars} симв.`,
      оборван: request.cut === true ? 'да' : '',
    }))
  );
  console.table(
    Object.entries(telemetry.phases).map(([name, phase]) => ({
      фаза: name,
      с: +(phase.ms / 1000).toFixed(2),
      раз: phase.count,
    }))
  );
}
