/**
 * Отчёты `report_issue` на диске.
 *
 * Куда пишем: `REFORMER_ISSUE_REPORTS_DIR`, если задан (относительные значения резолвятся от
 * cwd), иначе `<корень проекта>/.reformer/issue_reports`. Корень проекта — ближайший вверх
 * `package.json` с зависимостями, причём поиск начинается ВНЕ `node_modules`: сервер, запущенный
 * через npx из `<app>/node_modules/@reformer/mcp`, иначе писал бы в собственный пакет, и отчёты
 * стирал бы следующий `npm ci`. Если такого `package.json` нет — сам cwd (тоже вне
 * `node_modules`), чтобы отчёты не оказались там, где вызывающий их не найдёт.
 *
 * В каталоге по умолчанию `.reformer/` лежит свой `.gitignore` (`*`): у потребителя нет
 * записи о нём в корневом `.gitignore`, и отчёты агента попадали бы в его коммиты. Каталог из
 * переменной окружения выбран вызывающим — его не трогаем.
 *
 * @module reformer-mcp/platform/cli/issue-sink
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import type { IssueSink } from '../../core/issues/sink.js';
import { detectProjectStack, outsideNodeModules } from './project-detector.js';

/** Имя переменной окружения, переопределяющей каталог отчётов. */
export const ISSUE_REPORTS_DIR_ENV = 'REFORMER_ISSUE_REPORTS_DIR';

const DEFAULT_DIR_SEGMENTS = ['.reformer', 'issue_reports'] as const;

/** См. докстринг модуля. Пересчитывается на каждый вызов: env может измениться между тестами. */
export function resolveIssueReportsDir(): string {
  const fromEnv = process.env[ISSUE_REPORTS_DIR_ENV]?.trim();
  if (fromEnv) return resolve(fromEnv);

  const root = detectProjectStack().projectRoot ?? outsideNodeModules(process.cwd());
  return join(root, ...DEFAULT_DIR_SEGMENTS);
}

/** `.gitignore` в `.reformer/`, если отчёты пишутся в каталог по умолчанию (см. докстринг). */
function ignoreDefaultDir(dir: string): void {
  if (process.env[ISSUE_REPORTS_DIR_ENV]?.trim()) return;
  const ignore = join(dirname(dir), '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n', 'utf-8');
}

export function createCliIssueSink(): IssueSink {
  return {
    location: () => resolveIssueReportsDir(),

    write(baseName, payload) {
      const dir = resolveIssueReportsDir();
      mkdirSync(dir, { recursive: true });
      ignoreDefaultDir(dir);

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
