import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import {
  createPerformanceReport,
  getMemoryUsage,
  getPerformanceTiming,
  measurePerformance,
  type MemoryUsage,
  type PerformanceTiming,
  type WebVitalsMetrics,
} from './performance';

export interface CollectedAction {
  name: string;
  duration: number;
  startTime: number;
}

/**
 * Запись в per-worker NDJSON-файле. Одна строка — один тест.
 * Формат стабилен и используется `performance-reporter.ts` для агрегации.
 */
export interface PerformanceRecord {
  testId: string;
  testTitle: string;
  projectName: string;
  workerIndex: number;
  timestamp: number;
  status: 'passed' | 'failed' | 'timedOut' | 'interrupted' | 'skipped' | 'unknown';
  actions: CollectedAction[];
  webVitals: WebVitalsMetrics | null;
  timing: PerformanceTiming | null;
  memory: MemoryUsage | null;
}

// Относительно cwd npm-скрипта — при запуске из projects/react-playground-e2e
// это projects/react-playground-e2e/test-results/perf. Используем относительный
// путь, чтобы не зависеть от того, откуда вызван playwright.
export const PERF_RESULTS_DIR = path.resolve(process.cwd(), 'test-results/perf');

export function isPerfEnabled(): boolean {
  return process.env.PERF_ENABLED === 'true';
}

/**
 * Коллектор метрик производительности одного теста.
 *
 * В disabled-режиме (PERF_ENABLED !== 'true') — все методы no-op,
 * overhead нулевой. В enabled-режиме — оборачивает действия через
 * measureAction, собирает Web Vitals в конце теста и пишет NDJSON-запись
 * в test-results/perf/worker-${workerIndex}.jsonl, плюс печатает
 * краткий отчёт через createPerformanceReport.
 */
export class PerformanceCollector {
  readonly enabled: boolean;
  private readonly page: Page;
  private readonly testInfo: TestInfo;
  private readonly actions: CollectedAction[] = [];

  constructor(page: Page, testInfo: TestInfo) {
    this.page = page;
    this.testInfo = testInfo;
    this.enabled = isPerfEnabled();
  }

  /**
   * Замеряет продолжительность действия. В disabled-режиме сразу вызывает
   * `action()` без обёртки — проверка флага гарантирует нулевой overhead.
   *
   * Намеренно не используем `measureAction` из shared/performance.ts —
   * тот вызывает `performance.mark` в браузере через page.evaluate, что
   * ломается на навигационных действиях (goto): mark теряется после
   * перезагрузки страницы, и `performance.measure(...)` падает с
   * "The mark 'goto-start' does not exist". В Node-side замере через
   * Date.now() этой проблемы нет.
   */
  async measure<T>(name: string, action: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return action();
    }
    const startTime = Date.now();
    try {
      return await action();
    } finally {
      const duration = Date.now() - startTime;
      this.actions.push({ name, duration, startTime });
    }
  }

  /**
   * Вызывается автоматически в fixture-teardown.
   * Собирает Web Vitals/timing/memory, пишет в NDJSON и печатает отчёт.
   */
  async flush(): Promise<void> {
    if (!this.enabled) return;

    let webVitals: WebVitalsMetrics | null = null;
    let timing: PerformanceTiming | null = null;
    let memory: MemoryUsage | null = null;

    try {
      webVitals = await measurePerformance(this.page);
    } catch {
      // Страница могла быть уже закрыта (например, при падении теста) — метрики опциональны.
    }
    try {
      timing = await getPerformanceTiming(this.page);
    } catch {
      /* noop */
    }
    try {
      memory = await getMemoryUsage(this.page);
    } catch {
      /* noop */
    }

    const record: PerformanceRecord = {
      testId: this.testInfo.testId,
      testTitle: this.testInfo.title,
      projectName: this.testInfo.project.name,
      workerIndex: this.testInfo.workerIndex,
      timestamp: Date.now(),
      status: this.testInfo.status ?? 'unknown',
      actions: this.actions,
      webVitals,
      timing,
      memory,
    };

    await this.writeRecord(record);
    this.printReport(record);
  }

  private async writeRecord(record: PerformanceRecord): Promise<void> {
    await fs.promises.mkdir(PERF_RESULTS_DIR, { recursive: true });
    const fileName = `worker-${record.workerIndex}.jsonl`;
    const filePath = path.join(PERF_RESULTS_DIR, fileName);
    await fs.promises.appendFile(filePath, JSON.stringify(record) + '\n', 'utf8');
  }

  private printReport(record: PerformanceRecord): void {
    const report = createPerformanceReport({
      webVitals: record.webVitals ?? {
        lcp: null,
        fid: null,
        cls: null,
        fcp: null,
        ttfb: null,
        inp: null,
      },
      timing: record.timing ?? {
        navigationStart: 0,
        domContentLoaded: 0,
        loadEvent: 0,
        firstPaint: null,
        firstContentfulPaint: null,
      },
      memory: record.memory,
      actions: record.actions.map((a) => ({
        name: a.name,
        duration: a.duration,
        startTime: a.startTime,
        endTime: a.startTime + a.duration,
      })),
    });
    console.log(`\n[perf] ${record.projectName} · ${record.testTitle}\n${report}`);
  }
}
