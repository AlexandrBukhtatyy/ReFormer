/**
 * Запись результатов прогона: `results/<runId>/` (в .gitignore).
 * - `env.json` — окружение и конфигурация (воспроизводимость), пред-проверка фоновой нагрузки
 *   (`background.preflight`); в конце теста дописываются сводки калибровки скорости машины
 *   (`calibration.summary`) и фоновой нагрузки (`background.summary`);
 * - `phases.ndjson` — строка на фазу прогона; пишется сразу, сбой дальше не теряет данные;
 * - `runs.ndjson` — строка на прогон (успех / ошибка) с калибровкой в начале и в конце
 *   (`calibration`, см. lib/calibration.ts) и фоновой нагрузкой за прогон (`background`, см.
 *   lib/background.ts);
 * - `traces/` — трассы DevTools.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import type { Browser } from '@playwright/test';
import { buildInfo } from './participants';
import { SUITE_ID, suite } from './suite';
import type { BenchConfig } from './config';
import { CALIBRATION, calibrationValue, type CalibrationRecord } from './calibration';
import { BACKGROUND_THRESHOLDS, type BackgroundSample } from './background';
import { median, round } from './stats';

/** Прогоны набора: `results/` у набора библиотек, `results/<набор>/` у остальных (suites/<id>.json). */
export const RESULTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../results',
  suite.resultsSubdir
);

function shortSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'nogit';
  }
}

interface RunRecord {
  mode: string;
  cpu: number;
  warmup: boolean;
  calibration?: CalibrationRecord;
  background?: BackgroundSample | null;
}

export class ResultsWriter {
  readonly dir: string;
  private env: Record<string, unknown> = {};
  private readonly calibrations: RunRecord[] = [];
  private readonly backgrounds: BackgroundSample[] = [];

  constructor(readonly runId: string) {
    this.dir = path.join(RESULTS_DIR, runId);
    mkdirSync(path.join(this.dir, 'traces'), { recursive: true });
  }

  static create(form: string): ResultsWriter {
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace(/-\d{3}Z$/, 'Z');
    return new ResultsWriter(`${stamp}_${form}_${shortSha()}`);
  }

  async writeEnv(
    browser: Browser,
    config: BenchConfig,
    form: string,
    preflight: BackgroundSample | null = null
  ): Promise<void> {
    const cpus = os.cpus();
    const env = {
      runId: this.runId,
      suite: SUITE_ID,
      form,
      startedAt: new Date().toISOString(),
      machine: {
        platform: `${os.platform()} ${os.release()}`,
        arch: os.arch(),
        cpu: cpus[0]?.model ?? 'unknown',
        cores: cpus.length,
        memoryGb: Math.round(os.totalmem() / 2 ** 30),
        loadavg: os.loadavg(),
      },
      runtime: {
        node: process.version,
        browser: `chromium ${browser.version()}`,
        headless: process.env.BENCH_HEADED === '1' ? 'headed' : 'new headless (channel: chromium)',
      },
      config,
      build: buildInfo(),
      calibration: { workload: CALIBRATION },
      background: { thresholds: BACKGROUND_THRESHOLDS, preflight },
    };
    this.env = env;
    writeFileSync(path.join(this.dir, 'env.json'), JSON.stringify(env, null, 2));
  }

  /**
   * Конец теста: в env.json дописываются время окончания и сводка калибровки по режиму и профилю
   * CPU (прогоны без прогрева). Это справка для беглого взгляда; отчёт считает калибровку сам из
   * runs.ndjson.
   */
  finish(): void {
    const groups = new Map<string, RunRecord[]>();
    for (const r of this.calibrations) {
      const key = `${r.mode}@${r.cpu}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const summary: Record<string, Record<string, object>> = {};
    for (const [key, list] of groups) {
      const [mode, cpu] = key.split('@');
      const pick = (get: (c: CalibrationRecord) => number | null) =>
        list.map((r) => get(r.calibration!)).filter((v): v is number => v !== null);
      const values = pick(calibrationValue);
      const starts = pick((c) => c.startMs);
      const ends = pick((c) => c.endMs);
      const drifts = pick((c) => c.driftPct);
      (summary[mode] ??= {})[`${cpu}x`] = {
        runs: list.length,
        medianMs: round(median(values), 2),
        minMs: values.length ? round(Math.min(...values), 2) : null,
        maxMs: values.length ? round(Math.max(...values), 2) : null,
        startMedianMs: round(median(starts), 2),
        endMedianMs: round(median(ends), 2),
        driftMedianPct: round(median(drifts), 2),
        driftMaxAbsPct: drifts.length ? round(Math.max(...drifts.map(Math.abs)), 2) : null,
      };
    }
    const env = {
      ...this.env,
      finishedAt: new Date().toISOString(),
      calibration: { workload: CALIBRATION, summary },
      background: {
        ...(this.env.background as object),
        summary: this.backgroundSummary(),
      },
    };
    writeFileSync(path.join(this.dir, 'env.json'), JSON.stringify(env, null, 2));
  }

  phase(record: object): void {
    appendFileSync(path.join(this.dir, 'phases.ndjson'), `${JSON.stringify(record)}\n`);
  }

  run(record: object): void {
    appendFileSync(path.join(this.dir, 'runs.ndjson'), `${JSON.stringify(record)}\n`);
    const r = record as RunRecord;
    if (r.calibration && !r.warmup) this.calibrations.push(r);
    if (r.background && !r.warmup) this.backgrounds.push(r.background);
  }

  /** Сводка фоновой нагрузки по прогонам без прогрева (все режимы); null — замеров нет. */
  private backgroundSummary(): object | null {
    const list = this.backgrounds;
    if (!list.length) return null;
    const cores = list.map((b) => b.foreignCores);
    const neighbours: Record<string, { runs: number; cpuPct: number[] }> = {};
    for (const b of list) {
      for (const n of b.neighbours.filter((x) => x.busy)) {
        const e = (neighbours[n.label] ??= { runs: 0, cpuPct: [] });
        e.runs += 1;
        e.cpuPct.push(n.kind === 'gpu' ? (n.gpuPct ?? 0) : (n.cpuPct ?? 0));
      }
    }
    return {
      runs: list.length,
      dirtyRuns: list.filter((b) => b.dirty).length,
      foreignCoresMedian: round(median(cores), 2),
      foreignCoresMax: round(Math.max(...cores), 2),
      neighbours: Object.fromEntries(
        Object.entries(neighbours).map(([label, e]) => [
          label,
          { runs: e.runs, medianPct: round(median(e.cpuPct), 1) },
        ])
      ),
    };
  }

  tracePath(name: string): string {
    return path.join(this.dir, 'traces', `${name}.json`);
  }
}
