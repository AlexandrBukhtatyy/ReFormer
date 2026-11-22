/**
 * CDP-обвязка для замеров: метрики рендерера, троттлинг CPU, сборка мусора, DOM-счётчики, снимки
 * кучи.
 */
import type { CDPSession, Page } from '@playwright/test';
import { takeHeapSnapshot, type HeapSnapshot } from './heap';

/** Метрики `Performance.getMetrics`, которые берём в дельты фаз. */
export const METRIC_KEYS = [
  'ScriptDuration',
  'TaskDuration',
  'LayoutDuration',
  'RecalcStyleDuration',
  'V8CompileDuration',
  'ThreadTime',
  'LayoutCount',
  'RecalcStyleCount',
  'JSHeapUsedSize',
  'Nodes',
  'JSEventListeners',
  'DevToolsCommandDuration',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];
export type Metrics = Record<MetricKey, number>;

/** Длительности в CDP — секунды; переводим в мс. */
const SECONDS = new Set<MetricKey>([
  'ScriptDuration',
  'TaskDuration',
  'LayoutDuration',
  'RecalcStyleDuration',
  'V8CompileDuration',
  'ThreadTime',
  'DevToolsCommandDuration',
]);

export class Cdp {
  private constructor(readonly session: CDPSession) {}

  static async attach(page: Page, cpuRate: number): Promise<Cdp> {
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable');
    if (cpuRate > 1) await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    return new Cdp(session);
  }

  async metrics(): Promise<Metrics> {
    const { metrics } = await this.session.send('Performance.getMetrics');
    const out = {} as Metrics;
    for (const key of METRIC_KEYS) {
      const raw = metrics.find((m) => m.name === key)?.value ?? 0;
      out[key] = SECONDS.has(key) ? raw * 1000 : raw;
    }
    return out;
  }

  async gc(): Promise<void> {
    await this.session.send('HeapProfiler.collectGarbage');
  }

  async domCounters(): Promise<{ documents: number; nodes: number; jsEventListeners: number }> {
    return this.session.send('Memory.getDOMCounters');
  }

  /** Снимок кучи (с полной сборкой мусора) — для удержания объектов, см. `lib/heap.ts`. */
  heapSnapshot(): Promise<HeapSnapshot> {
    return takeHeapSnapshot(this.session);
  }

  async detach(): Promise<void> {
    await this.session.detach().catch(() => {});
  }
}

export function delta(after: Metrics, before: Metrics): Metrics {
  const out = {} as Metrics;
  for (const key of METRIC_KEYS) out[key] = after[key] - before[key];
  return out;
}
