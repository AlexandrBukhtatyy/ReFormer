/**
 * Init-скрипты страницы (page.addInitScript) — ставятся до загрузки приложения.
 *
 * Функции сериализуются Playwright'ом в исходник, поэтому самодостаточны: никаких импортов и
 * замыканий на модуль. Типы ниже описывают то, что они кладут в `window`.
 */

export interface KeySample {
  type: string;
  key: string;
  /** event.timeStamp — начало взаимодействия. */
  start: number;
  /** Конец задачи, в которой обработано событие (MessageChannel из capture-слушателя). */
  taskEnd?: number;
  /** Конец работы main thread в следующем кадре (rAF → MessageChannel). */
  frameEnd?: number;
}

export interface EventTimingSample {
  name: string;
  start: number;
  duration: number;
  processing: number;
  interactionId: number;
}

export interface ProbeSnapshot {
  label: string;
  samples: KeySample[];
  events: EventTimingSample[];
  longTasks: number[];
  loafs: Array<{ duration: number; blocking: number }>;
  /** Момент последней DOM-мутации за время записи (`performance.now()`), null — мутаций не было. */
  lastMutation: number | null;
  mutations: number;
  /** Момент `start()` — отсчёт «UI затих», если в фазе нет доверенных событий ввода. */
  startedAt: number;
}

export interface RenderSnapshot {
  bundleType: number | null;
  commits: number;
  components: number;
  primitives: number;
  other: number;
  byPrimitive: Record<string, number>;
  /** Исполнения примитивов (счётчик внутри примитивов; ловит bailout после вызова). */
  primitiveExecutions: Record<string, number>;
}

/**
 * Зонд задержек: `__probe.start(label)` / `__probe.stop()`. Запись идёт с момента установки под
 * меткой `load` — первый `stop()` отдаёт то, что случилось при загрузке страницы.
 */
export function installLatencyProbe(): void {
  type W = Window & { __probe?: unknown };
  const state = {
    label: 'load',
    recording: true,
    samples: [] as KeySample[],
    events: [] as EventTimingSample[],
    longTasks: [] as number[],
    loafs: [] as Array<{ duration: number; blocking: number }>,
    lastMutation: null as number | null,
    startedAt: 0,
    mutations: 0,
  };

  // Последняя DOM-мутация — «UI затих». Наблюдатель на documentElement ставится, как только он есть.
  const mutationObserver = new MutationObserver((records) => {
    if (!state.recording) return;
    state.mutations += records.length;
    state.lastMutation = performance.now();
  });
  const watchDom = () =>
    mutationObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  if (document.documentElement) watchDom();
  else document.addEventListener('readystatechange', watchDom, { once: true });

  const onInteraction = (e: Event) => {
    if (!state.recording) return;
    const sample: KeySample = {
      type: e.type,
      key: e instanceof KeyboardEvent ? e.key : '',
      start: e.timeStamp,
    };
    state.samples.push(sample);
    const task = new MessageChannel();
    task.port1.onmessage = () => {
      sample.taskEnd = performance.now();
    };
    task.port2.postMessage(null);
    requestAnimationFrame(() => {
      const frame = new MessageChannel();
      frame.port1.onmessage = () => {
        sample.frameEnd = performance.now();
      };
      frame.port2.postMessage(null);
    });
  };
  window.addEventListener('keydown', onInteraction, { capture: true });
  window.addEventListener('pointerdown', onInteraction, { capture: true });
  // click — отдельная задача после pointerup; на нём срабатывают отправка и кнопки.
  window.addEventListener('click', onInteraction, { capture: true });

  const observers: PerformanceObserver[] = [];
  const observe = (type: string, cb: (entries: PerformanceEntryList) => void, extra = {}) => {
    try {
      const o = new PerformanceObserver((list) => cb(list.getEntries()));
      o.observe({ type, buffered: false, ...extra } as PerformanceObserverInit);
      observers.push(o);
      return o;
    } catch {
      return null;
    }
  };
  const take = (entries: PerformanceEntryList, kind: string) => {
    if (!state.recording) return;
    for (const entry of entries) {
      if (kind === 'event') {
        const ev = entry as PerformanceEventTiming;
        state.events.push({
          name: ev.name,
          start: ev.startTime,
          duration: ev.duration,
          processing: ev.processingEnd - ev.processingStart,
          interactionId: (ev as unknown as { interactionId?: number }).interactionId ?? 0,
        });
      } else if (kind === 'longtask') {
        state.longTasks.push(entry.duration);
      } else {
        const loaf = entry as PerformanceEntry & { blockingDuration?: number };
        state.loafs.push({ duration: loaf.duration, blocking: loaf.blockingDuration ?? 0 });
      }
    }
  };
  const eventObs = observe('event', (l) => take(l, 'event'), { durationThreshold: 16 });
  const longObs = observe('longtask', (l) => take(l, 'longtask'));
  const loafObs = observe('long-animation-frame', (l) => take(l, 'loaf'));

  (window as W).__probe = {
    start(label: string) {
      state.label = label;
      state.samples = [];
      state.events = [];
      state.longTasks = [];
      state.loafs = [];
      state.lastMutation = null;
      state.mutations = 0;
      state.startedAt = performance.now();
      for (const o of observers) o.takeRecords();
      mutationObserver.takeRecords();
      state.recording = true;
    },
    stop(): ProbeSnapshot {
      if (eventObs) take(eventObs.takeRecords(), 'event');
      if (longObs) take(longObs.takeRecords(), 'longtask');
      if (loafObs) take(loafObs.takeRecords(), 'loaf');
      const pending = mutationObserver.takeRecords();
      if (pending.length) {
        state.mutations += pending.length;
        state.lastMutation = performance.now();
      }
      state.recording = false;
      return {
        label: state.label,
        samples: state.samples,
        events: state.events,
        longTasks: state.longTasks,
        loafs: state.loafs,
        lastMutation: state.lastMutation,
        mutations: state.mutations,
        startedAt: state.startedAt,
      };
    },
  };
}

/**
 * Счётчик рендеров: свой `__REACT_DEVTOOLS_GLOBAL_HOOK__`. На каждый commit обходит дерево, как
 * React DevTools (`updateFiberRecursively`): спускается только туда, где `child` сменился, и
 * считает компонентные fiber'ы с флагом PerformedWork; новые поддеревья — целиком (mount).
 * Примитивы распознаются по идентичности `fiber.type` (реестр `__benchPrimitiveTypes`), а не по
 * именам. Заодно включает счётчик исполнений внутри примитивов (`__benchPrimitiveRenders`).
 */
export function installRenderCounter(): void {
  type Fiber = {
    tag: number;
    type: unknown;
    flags: number;
    child: Fiber | null;
    sibling: Fiber | null;
    alternate: Fiber | null;
  };
  type G = Window & {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
    __benchPrimitiveRenders?: Record<string, number>;
    __benchPrimitiveTypes?: Map<unknown, string>;
    __renders?: unknown;
  };
  const w = window as G;
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]); // Function, Class, ForwardRef, Memo, SimpleMemo
  const PERFORMED_WORK = 1;

  const counts = {
    bundleType: null as number | null,
    commits: 0,
    components: 0,
    primitives: 0,
    other: 0,
    byPrimitive: {} as Record<string, number>,
  };
  w.__benchPrimitiveRenders = {};

  const primitiveName = (fiber: Fiber): string | undefined => {
    const registry = w.__benchPrimitiveTypes;
    if (!registry) return undefined;
    return (
      registry.get(fiber.type) ??
      registry.get((fiber.type as { type?: unknown } | null)?.type) ??
      registry.get((fiber.type as { render?: unknown } | null)?.render)
    );
  };
  const record = (fiber: Fiber) => {
    counts.components++;
    const name = primitiveName(fiber);
    if (name) {
      counts.primitives++;
      counts.byPrimitive[name] = (counts.byPrimitive[name] ?? 0) + 1;
    } else counts.other++;
  };
  const mountSubtree = (fiber: Fiber) => {
    if (COMPONENT_TAGS.has(fiber.tag)) record(fiber);
    for (let c = fiber.child; c; c = c.sibling) mountSubtree(c);
  };
  const updateFiber = (next: Fiber, prev: Fiber) => {
    if (COMPONENT_TAGS.has(next.tag) && (next.flags & PERFORMED_WORK) === PERFORMED_WORK) {
      record(next);
    }
    if (next.child === prev.child) return;
    for (let c = next.child; c; c = c.sibling) {
      if (c.alternate) updateFiber(c, c.alternate);
      else mountSubtree(c);
    }
  };

  const renderers = new Map<number, unknown>();
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers,
    inject(internals: { bundleType?: number }) {
      const id = renderers.size + 1;
      renderers.set(id, internals);
      counts.bundleType = internals.bundleType ?? null;
      return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
    onCommitFiberRoot(_id: number, root: { current: Fiber }) {
      counts.commits++;
      const current = root.current;
      if (current.alternate) updateFiber(current, current.alternate);
      else mountSubtree(current);
    },
  };

  w.__renders = {
    snapshot() {
      return {
        ...counts,
        byPrimitive: { ...counts.byPrimitive },
        primitiveExecutions: { ...w.__benchPrimitiveRenders },
      };
    },
    reset() {
      counts.commits = 0;
      counts.components = 0;
      counts.primitives = 0;
      counts.other = 0;
      counts.byPrimitive = {};
      w.__benchPrimitiveRenders = {};
    },
  };
}
