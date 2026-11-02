/**
 * Запуск Playwright стендом качества и разбор его JSON-отчёта.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const E2E_DIRECTORY = path.join(repoRoot, 'projects/react-playground-e2e');

/** Запустить тесты; отчёт ложится в `reportFile`. */
export function runPlaywright(args, env, reportFile) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, ['playwright', 'test', ...args, '--reporter=json'], {
    cwd: E2E_DIRECTORY,
    env: { ...process.env, ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile },
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 256 * 1024 * 1024,
    timeout: 60 * 60 * 1000,
  });
  return { status: result.status, stderr: (result.stderr ?? '').slice(-4000) };
}

/** JSON-отчёт playwright → список `{ project, file, title, status, error }`. */
export function flattenReport(report) {
  const out = [];
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const last = test.results?.at(-1);
        out.push({
          project: test.projectName,
          file: path.basename(suite.file ?? file ?? ''),
          title: spec.title,
          status: last?.status ?? 'skipped',
          error: (last?.error?.message ?? '')
            // eslint-disable-next-line no-control-regex -- снимаются ANSI-коды из вывода playwright
            .replace(/\u001b\[[0-9;]*m/g, '')
            .split('\n')[0]
            .slice(0, 240),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, suite.file ?? file);
  };
  for (const suite of report.suites ?? []) walk(suite, suite.file);
  return out;
}
