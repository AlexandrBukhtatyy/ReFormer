/**
 * Меры запуска: кто сколько занял до первого кадра.
 *
 * Запуск оболочки — цепочка из десятка шагов, и половина из них принадлежит не ей: настройки,
 * словарь, встроенные плагины, слой плагинов приложения (у каждого — чтение, прогрев модулей,
 * линковка, активация, стили). «Запуск стал медленнее» без разбивки не чинится: общая цифра
 * не говорит, читали ли мы лишнее, разбирали ли CSS или ждали сети по одному запросу.
 *
 * Меры ставятся всегда, а не по флагу. `performance.measure` стоит микросекунды, зато запись
 * видна в DevTools (Performance → Timings) у любого человека, пришедшего с жалобой, без
 * пересборки и без перезапуска «в режиме замера». По флагу только ПЕЧАТЬ сводки в консоль.
 *
 * Модуль не знает ни фаз, ни плагинов: имена называет тот, кто меряет. Соглашение одно —
 * `<область>.<фаза>` и, если мера про конкретный плагин, `:<id>` в конце
 * (`plugin.read:reformer.editor-monaco`). Сводка складывает по части до двоеточия.
 *
 * Отказ замера не роняет запуск: среда без `performance` (или с урезанным) получает пустые
 * функции.
 *
 * @module shell/platform/primitives/trace
 */

/** Приставка мер оболочки: по ней сводка отбирает свои и не трогает чужие. */
export const TRACE_PREFIX = 'rb:';

function clock(): Performance | undefined {
  return typeof performance === 'undefined' ? undefined : performance;
}

function record(name: string, start: number, end: number): void {
  try {
    clock()?.measure(TRACE_PREFIX + name, { start, end });
  } catch {
    // Замер — наблюдение, а не часть работы: его отказ запуска не касается.
  }
}

/** Открывает меру; возвращённая функция закрывает её. Повторный вызов ничего не делает. */
export function traceSpan(name: string): () => void {
  const perf = clock();
  if (perf === undefined) return () => {};
  const start = perf.now();
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    record(name, start, perf.now());
  };
}

/** Мера от начала навигации до этого мгновения: «сколько прошло к такому-то событию». */
export function traceSinceStart(name: string): void {
  const perf = clock();
  if (perf === undefined) return;
  record(name, 0, perf.now());
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Мера вокруг вызова — синхронного или отдающего обещание.
 *
 * Закрывается, когда работа кончилась, успехом или отказом: шаг, упавший через три секунды,
 * стоил эти три секунды, и из сводки он пропадать не должен.
 */
export function traced<T>(name: string, run: () => T): T {
  const end = traceSpan(name);
  let result: T;
  try {
    result = run();
  } catch (error) {
    end();
    throw error;
  }
  if (!isThenable(result)) {
    end();
    return result;
  }
  return Promise.resolve(result).then(
    (value) => {
      end();
      return value;
    },
    (error: unknown) => {
      end();
      throw error;
    }
  ) as T;
}

export interface TracePhase {
  /** Имя меры без приставки. */
  readonly name: string;
  /** Начало от начала навигации, мс. */
  readonly start: number;
  readonly duration: number;
}

export interface TraceResources {
  readonly group: string;
  readonly files: number;
  /** Байты по сети; 0 у ответа из кэша и у 304. */
  readonly transferred: number;
  /** Байты после распаковки — то, что оболочка разбирает. */
  readonly decoded: number;
}

export interface StartupSummary {
  readonly phases: readonly TracePhase[];
  /** Те же меры, сложенные по фазе (часть имени до двоеточия): число мер и суммарное время. */
  readonly totals: ReadonlyArray<{ phase: string; count: number; duration: number }>;
  readonly resources: readonly TraceResources[];
}

export interface StartupSummaryOptions {
  /** Учитывать только то, что началось не позже этой отметки, мс. Без неё — всё. */
  readonly until?: number;
  /** Группы ресурсов: имя → подстрока адреса. */
  readonly groups?: Readonly<Record<string, string>>;
}

/** Что оболочка запрашивает сама: её чанки и файлы плагинов приложения. */
const DEFAULT_GROUPS: Readonly<Record<string, string>> = {
  plugins: '/plugins/',
  assets: '/assets/',
};

/** Сводка мер и запросов. Чистое чтение: ничего не сбрасывает, звать можно сколько угодно раз. */
export function startupSummary(options: StartupSummaryOptions = {}): StartupSummary {
  const perf = clock();
  if (perf === undefined || typeof perf.getEntriesByType !== 'function') {
    return { phases: [], totals: [], resources: [] };
  }
  const until = options.until ?? Number.POSITIVE_INFINITY;

  const phases = perf
    .getEntriesByType('measure')
    .filter((entry) => entry.name.startsWith(TRACE_PREFIX) && entry.startTime <= until)
    .map((entry) => ({
      name: entry.name.slice(TRACE_PREFIX.length),
      start: entry.startTime,
      duration: entry.duration,
    }))
    .sort((a, b) => a.start - b.start);

  const byPhase = new Map<string, { count: number; duration: number }>();
  for (const { name, duration } of phases) {
    const at = name.indexOf(':');
    const phase = at < 0 ? name : name.slice(0, at);
    const total = byPhase.get(phase) ?? { count: 0, duration: 0 };
    byPhase.set(phase, { count: total.count + 1, duration: total.duration + duration });
  }

  const groups = Object.entries(options.groups ?? DEFAULT_GROUPS);
  const resources = groups.map(([group, marker]) => {
    const entries = (perf.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
      (entry) => entry.startTime <= until && new URL(entry.name).pathname.includes(marker)
    );
    return {
      group,
      files: entries.length,
      transferred: entries.reduce((sum, entry) => sum + (entry.transferSize ?? 0), 0),
      decoded: entries.reduce((sum, entry) => sum + (entry.decodedBodySize ?? 0), 0),
    };
  });

  return {
    phases,
    totals: [...byPhase].map(([phase, total]) => ({ phase, ...total })),
    resources,
  };
}

/** Печатает сводку в консоль — для человека, открывшего приложение с флагом замера. */
export function printStartupSummary(options: StartupSummaryOptions = {}): void {
  const summary = startupSummary(options);
  const ms = (value: number): number => Math.round(value * 10) / 10;
  console.groupCollapsed('[trace] запуск оболочки');
  console.table(
    summary.totals.map((total) => ({ ...total, duration: ms(total.duration) })),
    ['phase', 'count', 'duration']
  );
  console.table(
    summary.phases.map((phase) => ({
      name: phase.name,
      start: ms(phase.start),
      duration: ms(phase.duration),
    }))
  );
  console.table(summary.resources);
  console.groupEnd();
}
