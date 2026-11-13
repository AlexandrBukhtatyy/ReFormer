/**
 * Запись результатов прогона: `results/<runId>/` (в .gitignore).
 * - `env.json` — окружение и конфигурация (воспроизводимость);
 * - `phases.ndjson` — строка на фазу прогона; пишется сразу, сбой дальше не теряет данные;
 * - `runs.ndjson` — строка на прогон (успех / ошибка);
 * - `traces/` — трассы DevTools.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import type { Browser } from '@playwright/test';
import { buildInfo } from './participants';
import type { BenchConfig } from './config';

export const RESULTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../results');

function shortSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'nogit';
  }
}

export class ResultsWriter {
  readonly dir: string;

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

  async writeEnv(browser: Browser, config: BenchConfig, form: string): Promise<void> {
    const cpus = os.cpus();
    const env = {
      runId: this.runId,
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
    };
    writeFileSync(path.join(this.dir, 'env.json'), JSON.stringify(env, null, 2));
  }

  phase(record: object): void {
    appendFileSync(path.join(this.dir, 'phases.ndjson'), `${JSON.stringify(record)}\n`);
  }

  run(record: object): void {
    appendFileSync(path.join(this.dir, 'runs.ndjson'), `${JSON.stringify(record)}\n`);
  }

  tracePath(name: string): string {
    return path.join(this.dir, 'traces', `${name}.json`);
  }
}
