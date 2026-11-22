import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Reporter } from '@playwright/test/reporter';
import { isPerfEnabled, PERF_RESULTS_DIR, type PerformanceRecord } from './performance-collector';

interface ActionAggregate {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
}

interface PerfSummary {
  generatedAt: string;
  totalTests: number;
  tests: PerformanceRecord[];
  actionAggregates: Record<string, ActionAggregate & { avgMs: number }>;
}

/**
 * Playwright Reporter: в onBegin чистит старые NDJSON-файлы,
 * в onEnd читает все worker-*.jsonl и пишет перезаписывающий summary.
 *
 * Активен только при PERF_ENABLED=true. Иначе no-op — ничего не пишет,
 * чтобы обычные прогоны оставались быстрыми и детерминированными.
 */
export default class PerformanceReporter implements Reporter {
  private readonly enabled: boolean;

  constructor() {
    this.enabled = isPerfEnabled();
  }

  async onBegin(): Promise<void> {
    if (!this.enabled) return;
    // Чистим предыдущие jsonl, чтобы не склеить записи из разных прогонов.
    await fs.promises.mkdir(PERF_RESULTS_DIR, { recursive: true });
    const files = await fs.promises.readdir(PERF_RESULTS_DIR);
    await Promise.all(
      files
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => fs.promises.unlink(path.join(PERF_RESULTS_DIR, f)).catch(() => {}))
    );
  }

  async onEnd(): Promise<void> {
    if (!this.enabled) return;
    const records = await this.readAllRecords();
    const summary = this.aggregate(records);
    const summaryPath = path.resolve(PERF_RESULTS_DIR, '..', 'perf-summary.json');
    await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\n[perf] Сводка сохранена: ${summaryPath} (тестов: ${summary.totalTests})`);
  }

  private async readAllRecords(): Promise<PerformanceRecord[]> {
    const exists = await fs.promises
      .stat(PERF_RESULTS_DIR)
      .then(() => true)
      .catch(() => false);
    if (!exists) return [];

    const files = await fs.promises.readdir(PERF_RESULTS_DIR);
    const records: PerformanceRecord[] = [];
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const content = await fs.promises.readFile(path.join(PERF_RESULTS_DIR, file), 'utf8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          records.push(JSON.parse(line) as PerformanceRecord);
        } catch {
          // Битые строки игнорируем — агрегат продолжается.
        }
      }
    }
    records.sort((a, b) => a.timestamp - b.timestamp);
    return records;
  }

  private aggregate(records: PerformanceRecord[]): PerfSummary {
    const aggregates: Record<string, ActionAggregate> = {};
    for (const rec of records) {
      for (const action of rec.actions) {
        const agg = aggregates[action.name] ?? {
          count: 0,
          totalMs: 0,
          minMs: Number.POSITIVE_INFINITY,
          maxMs: 0,
        };
        agg.count += 1;
        agg.totalMs += action.duration;
        agg.minMs = Math.min(agg.minMs, action.duration);
        agg.maxMs = Math.max(agg.maxMs, action.duration);
        aggregates[action.name] = agg;
      }
    }

    const actionAggregates: PerfSummary['actionAggregates'] = {};
    for (const [name, agg] of Object.entries(aggregates)) {
      actionAggregates[name] = {
        ...agg,
        avgMs: agg.count > 0 ? agg.totalMs / agg.count : 0,
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      totalTests: records.length,
      tests: records,
      actionAggregates,
    };
  }
}
