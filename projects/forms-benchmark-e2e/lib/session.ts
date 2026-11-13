/**
 * Сессия замера: один участник × одна форма × один прогон. Новый browser context, CDP с
 * троттлингом, init-скрипты зонда (и счётчика рендеров в режиме `renders`).
 *
 * Окно замера фазы: `__probe.start` → снимок CDP → действие (только сырой ввод) → один in-page
 * промис `__bench.idle()` → снимок CDP → `__probe.stop`. Проверки (`gate`) — после окна.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { Cdp, delta, type Metrics } from './cdp';
import {
  installLatencyProbe,
  installRenderCounter,
  type ProbeSnapshot,
  type RenderSnapshot,
} from './probes';
import type { Participant, FormId } from './participants';
import type { ResultsWriter } from './results';
import { benchConfig } from './config';
import { CALIBRATION, calibrationWorkload, sampleOf, type CalibrationSample } from './calibration';
import { round, sum } from './stats';

export type Mode = 'timing' | 'renders' | 'trace';

export interface SessionInfo {
  lib: Participant;
  form: FormId;
  cpu: number;
  mode: Mode;
  iteration: number;
  warmup: boolean;
}

interface BenchGlobals {
  __bench: {
    ready: Promise<number>;
    readyAt: number | null;
    idle(opts?: { network?: boolean }): Promise<number>;
    mount(): Promise<{ sync: number; ready: number }>;
    unmount(): Promise<void>;
    api: { calls: Record<string, number> };
  };
  __probe: { start(label: string): void; stop(): ProbeSnapshot };
  __renders: { snapshot(): RenderSnapshot; reset(): void };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function summarizeProbe(p: ProbeSnapshot) {
  const keys = p.samples.filter((s) => s.type === 'keydown' && s.key.length === 1);
  const clicks = p.samples.filter((s) => s.type === 'click');
  const lat = (list: typeof keys, field: 'taskEnd' | 'frameEnd') =>
    list.filter((s) => s[field] !== undefined).map((s) => round(s[field]! - s.start, 1)!);
  const first = p.samples.length ? Math.min(...p.samples.map((s) => s.start)) : p.startedAt;
  const longTasks = p.longTasks;
  return {
    keys: { proc: lat(keys, 'taskEnd'), frame: lat(keys, 'frameEnd') },
    clicks: { proc: lat(clicks, 'taskEnd'), frame: lat(clicks, 'frameEnd') },
    uiSettleMs: first !== null && p.lastMutation !== null ? round(p.lastMutation - first, 1) : null,
    mutations: p.mutations,
    eventTiming: {
      count16: p.events.length,
      max: p.events.length ? round(Math.max(...p.events.map((e) => e.duration)), 1) : 0,
      maxProcessing: p.events.length ? round(Math.max(...p.events.map((e) => e.processing)), 1) : 0,
    },
    longTasks: {
      count: longTasks.length,
      total: round(sum(longTasks), 1),
      tbt: round(sum(longTasks.map((d) => Math.max(0, d - 50))), 1),
    },
    loaf: {
      count: p.loafs.length,
      blocking: round(sum(p.loafs.map((l) => l.blocking)), 1),
    },
  };
}

function pickMetrics(m: Metrics) {
  return {
    script: round(m.ScriptDuration, 2),
    task: round(m.TaskDuration, 2),
    layout: round(m.LayoutDuration, 2),
    style: round(m.RecalcStyleDuration, 2),
    compile: round(m.V8CompileDuration, 2),
    thread: round(m.ThreadTime, 2),
    layoutCount: m.LayoutCount,
    styleCount: m.RecalcStyleCount,
    devtools: round(m.DevToolsCommandDuration, 2),
  };
}

export class BenchSession {
  private constructor(
    readonly info: SessionInfo,
    readonly context: BrowserContext,
    readonly page: Page,
    readonly cdp: Cdp,
    private readonly writer: ResultsWriter | null
  ) {}

  static async open(
    browser: Browser,
    info: SessionInfo,
    writer: ResultsWriter | null,
    baseURL: string
  ): Promise<BenchSession> {
    // Те же параметры, что `use` в playwright.config.ts (newContext их не наследует).
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 1600 },
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'UTC',
    });
    const page = await context.newPage();
    await page.addInitScript(installLatencyProbe);
    if (info.mode === 'renders') await page.addInitScript(installRenderCounter);
    const cdp = await Cdp.attach(page, info.cpu);
    return new BenchSession(info, context, page, cdp, writer);
  }

  private record(phase: string, data: object): void {
    if (!this.writer || this.info.warmup) return;
    const { lib, form, cpu, mode, iteration } = this.info;
    this.writer.phase({ lib: lib.id, role: lib.role, form, cpu, mode, iteration, phase, ...data });
  }

  /**
   * Центры элементов по testid (координаты viewport) — считаются ДО окна замера. Элемент вне
   * видимой области сначала прокручивается к центру: фокус на кнопке или длинный массив сдвигают
   * прокрутку, и старые координаты ушли бы за край экрана. Прокрутка — тоже вне окна; следующий
   * кадр дожидается `__bench.frame()`.
   */
  async centers(testIds: string[]): Promise<Record<string, { x: number; y: number }>> {
    const scrolled = await this.page.evaluate((ids) => {
      let moved = false;
      for (const id of ids) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el) throw new Error(`нет элемента ${id}`);
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
          moved = true;
        }
      }
      return moved;
    }, testIds);
    if (scrolled) {
      await this.page.evaluate(() => (window as unknown as BenchGlobals).__bench.idle());
    }
    return this.page.evaluate((ids) => {
      const out: Record<string, { x: number; y: number }> = {};
      for (const id of ids) {
        const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        out[id] = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return out;
    }, testIds);
  }

  // ── Сырой ввод (внутри окна замера) ──────────────────────────────────────
  async click(at: { x: number; y: number }): Promise<void> {
    await this.page.mouse.click(at.x, at.y);
  }

  async type(text: string, cadenceMs: number): Promise<void> {
    for (const ch of text) {
      await this.page.keyboard.press(ch);
      await sleep(cadenceMs);
    }
  }

  async press(key: string, cadenceMs = 0): Promise<void> {
    await this.page.keyboard.press(key);
    if (cadenceMs) await sleep(cadenceMs);
  }

  // ── Калибровка скорости машины (вне фаз) ─────────────────────────────────
  /**
   * Калибровочная нагрузка ({@link CALIBRATION}) на пустой странице этой вкладки, под троттлингом
   * сессии. `start` — до первой фазы (новая вкладка и так на about:blank), `end` — после последней:
   * вкладка сначала уходит на about:blank, чтобы условия совпадали с началом. До нагрузки и после —
   * GC; после — пауза, чтобы фоновая работа (GC, компиляция) не попала в первую фазу.
   */
  async calibrate(at: 'start' | 'end'): Promise<CalibrationSample> {
    if (at === 'end') await this.page.goto('about:blank');
    await this.cdp.gc();
    const { times, checksum } = await this.page.evaluate(calibrationWorkload, {
      units: CALIBRATION.units,
      reps: CALIBRATION.reps,
      warmup: CALIBRATION.warmup,
    });
    if (checksum !== CALIBRATION.checksum) {
      throw new Error(
        `калибровка: контрольная сумма ${checksum}, ожидалась ${CALIBRATION.checksum} — нагрузку поменяли без смены id?`
      );
    }
    await this.cdp.gc();
    await sleep(CALIBRATION.settleMs);
    return sampleOf(times);
  }

  // ── Фазы ─────────────────────────────────────────────────────────────────
  async load(phase: string, url: string): Promise<{ readyAt: number }> {
    // Счётчики CDP накопительные и навигацией не сбрасываются, а до перехода на этой вкладке
    // работала калибровка (она — команда DevTools, её время целиком в DevToolsCommandDuration и
    // TaskDuration): берётся дельта от момента перед переходом. Если навигация всё же сменила процесс
    // рендерера и счётчики пошли заново (они меньше стартовых), берутся абсолютные значения.
    const start = await this.cdp.metrics();
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    const readyAt = await this.page.evaluate(
      () => (window as unknown as BenchGlobals).__bench.ready
    );
    await this.page.evaluate(() => (window as unknown as BenchGlobals).__bench.idle());
    const end = await this.cdp.metrics();
    const reset =
      end.DevToolsCommandDuration < start.DevToolsCommandDuration ||
      end.TaskDuration < start.TaskDuration;
    const metrics = reset ? end : delta(end, start);
    const probe = await this.page.evaluate(() =>
      (window as unknown as BenchGlobals).__probe.stop()
    );
    const nav = await this.page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const mark = (name: string) => performance.getEntriesByName(name)[0]?.startTime ?? null;
      const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter((r) => /\.(js|css)$/.test(new URL(r.name).pathname))
        .map((r) => ({
          file: new URL(r.name).pathname.split('/').pop(),
          encoded: r.encodedBodySize,
          decoded: r.decodedBodySize,
          duration: Math.round(r.duration * 10) / 10,
        }));
      return {
        responseEnd: n.responseEnd,
        domContentLoaded: n.domContentLoadedEventEnd,
        loadEvent: n.loadEventEnd,
        fcp: mark('first-contentful-paint'),
        html: mark('bench:html'),
        prefill: mark('bench:prefill'),
        resources,
      };
    });
    const renders =
      this.info.mode === 'renders'
        ? await this.page.evaluate(() => (window as unknown as BenchGlobals).__renders.snapshot())
        : null;
    await this.cdp.gc();
    const after = await this.cdp.metrics();
    const dom = await this.cdp.domCounters();
    const p = summarizeProbe(probe);
    this.record(phase, {
      readyMs: round(readyAt, 1),
      fcpMs: round(nav.fcp, 1),
      htmlMs: round(nav.html, 1),
      domContentLoadedMs: round(nav.domContentLoaded, 1),
      // Гидратация: от доставки префилла до готовой формы (только для загрузки с приглашением).
      hydrateMs: nav.prefill !== null ? round(readyAt - nav.prefill, 1) : null,
      jsDecodedBytes: sum(
        nav.resources.filter((r) => r.file?.endsWith('.js')).map((r) => r.decoded)
      ),
      resources: nav.resources,
      cdp: pickMetrics(metrics),
      heap: after.JSHeapUsedSize,
      nodes: dom.nodes,
      listeners: dom.jsEventListeners,
      longTasks: p.longTasks,
      loaf: p.loaf,
      renders,
    });
    return { readyAt };
  }

  async phase(
    name: string,
    action: () => Promise<void>,
    gate?: () => Promise<void>
  ): Promise<void> {
    const page = this.page;
    await sleep(benchConfig.thinkMs);
    await page.evaluate(() => (window as unknown as BenchGlobals).__bench.idle());
    await this.cdp.gc();
    if (this.info.mode === 'renders')
      await page.evaluate(() => (window as unknown as BenchGlobals).__renders.reset());
    const calls0 = await page.evaluate(() => ({
      ...(window as unknown as BenchGlobals).__bench.api.calls,
    }));
    await page.evaluate((label) => (window as unknown as BenchGlobals).__probe.start(label), name);
    const before = await this.cdp.metrics();

    await action();
    await page.evaluate(() => (window as unknown as BenchGlobals).__bench.idle());

    const after = await this.cdp.metrics();
    const probe = await page.evaluate(() => (window as unknown as BenchGlobals).__probe.stop());
    const renders =
      this.info.mode === 'renders'
        ? await page.evaluate(() => (window as unknown as BenchGlobals).__renders.snapshot())
        : null;
    const calls1 = await page.evaluate(() => ({
      ...(window as unknown as BenchGlobals).__bench.api.calls,
    }));
    await this.cdp.gc();
    const settled = await this.cdp.metrics();
    const dom = await this.cdp.domCounters();
    if (gate) await gate();

    const apiCalls: Record<string, number> = {};
    for (const [k, v] of Object.entries(calls1))
      if (v - (calls0[k] ?? 0)) apiCalls[k] = v - (calls0[k] ?? 0);
    this.record(name, {
      ...summarizeProbe(probe),
      cdp: pickMetrics(delta(after, before)),
      heap: settled.JSHeapUsedSize,
      nodes: dom.nodes,
      listeners: dom.jsEventListeners,
      apiCalls,
      renders,
    });
  }

  /** Перемонтирования: длительность каждого (in-page), наклон heap и DOM-узлов по контрольным точкам. */
  async remount(name: string, count: number): Promise<void> {
    const page = this.page;
    await page.evaluate(() => (window as unknown as BenchGlobals).__bench.idle());
    await page.evaluate(() => (window as unknown as BenchGlobals).__bench.unmount());
    await this.cdp.gc();
    const base = await this.cdp.metrics();
    const baseDom = await this.cdp.domCounters();
    if (this.info.mode === 'renders')
      await page.evaluate(() => (window as unknown as BenchGlobals).__renders.reset());
    const syncMs: number[] = [];
    const readyMs: number[] = [];
    const checkpoints: Array<{ i: number; heap: number; nodes: number; listeners: number }> = [];
    let cdpTotals = delta(base, base);
    for (let i = 1; i <= count; i++) {
      const before = await this.cdp.metrics();
      const mounted = await page.evaluate(() =>
        (window as unknown as BenchGlobals).__bench.mount()
      );
      syncMs.push(round(mounted.sync, 2)!);
      readyMs.push(round(mounted.ready, 2)!);
      await page.evaluate(() => (window as unknown as BenchGlobals).__bench.unmount());
      const after = await this.cdp.metrics();
      const d = delta(after, before);
      for (const k of Object.keys(d) as Array<keyof Metrics>) cdpTotals[k] += d[k];
      if (i % 5 === 0) {
        await this.cdp.gc();
        const m = await this.cdp.metrics();
        const dom = await this.cdp.domCounters();
        checkpoints.push({
          i,
          heap: m.JSHeapUsedSize,
          nodes: dom.nodes,
          listeners: dom.jsEventListeners,
        });
      }
    }
    const renders =
      this.info.mode === 'renders'
        ? await page.evaluate(() => (window as unknown as BenchGlobals).__renders.snapshot())
        : null;
    // Средние CDP-дельты на один цикл mount+unmount.
    const perCycle = {} as Metrics;
    for (const k of Object.keys(cdpTotals) as Array<keyof Metrics>)
      perCycle[k] = cdpTotals[k] / count;
    cdpTotals = perCycle;
    this.record(name, {
      count,
      mountSyncMs: syncMs,
      mountReadyMs: readyMs,
      cdp: pickMetrics(cdpTotals),
      baseHeap: base.JSHeapUsedSize,
      baseNodes: baseDom.nodes,
      checkpoints,
      renders,
    });
  }

  async close(): Promise<void> {
    await this.cdp.detach();
    await this.context.close();
  }
}
