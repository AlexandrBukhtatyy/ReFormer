/**
 * Отчёты `report_issue` на диске.
 *
 * Куда пишем: `REFORMER_ISSUE_REPORTS_DIR`, если задан (относительные значения резолвятся от
 * cwd), иначе `<корень проекта>/.reformer/issue_reports`. Корень проекта — ближайший вверх
 * `package.json` с зависимостями; если такого нет — сам cwd, чтобы отчёты не оказались там,
 * где вызывающий их не найдёт.
 *
 * @module reformer-mcp/platform/cli/issue-sink
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import type { IssueSink } from '../../core/issues/sink.js';
import { detectProjectStack } from './project-detector.js';

/** Имя переменной окружения, переопределяющей каталог отчётов. */
export const ISSUE_REPORTS_DIR_ENV = 'REFORMER_ISSUE_REPORTS_DIR';

const DEFAULT_DIR_SEGMENTS = ['.reformer', 'issue_reports'] as const;

/** См. докстринг модуля. Пересчитывается на каждый вызов: env может измениться между тестами. */
export function resolveIssueReportsDir(): string {
  const fromEnv = process.env[ISSUE_REPORTS_DIR_ENV]?.trim();
  if (fromEnv) return resolve(fromEnv);

  const root = detectProjectStack().projectRoot ?? process.cwd();
  return join(root, ...DEFAULT_DIR_SEGMENTS);
}

export function createCliIssueSink(): IssueSink {
  return {
    location: () => resolveIssueReportsDir(),

    write(baseName, payload) {
      const dir = resolveIssueReportsDir();
      mkdirSync(dir, { recursive: true });

      // `wx` fails on an existing file, so two reports filed in the same millisecond with the
      // same slug get distinct names instead of one overwriting the other.
      for (let attempt = 1; ; attempt++) {
        const file = join(dir, attempt === 1 ? `${baseName}.json` : `${baseName}-${attempt}.json`);
        try {
          writeFileSync(file, payload, { encoding: 'utf-8', flag: 'wx' });
          return file;
        } catch (err) {
          if ((err as NodeJS.ErrnoException)?.code === 'EEXIST' && attempt < 100) continue;
          throw err;
        }
      }
    },
  };
}
