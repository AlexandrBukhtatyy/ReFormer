/**
 * Мета-тест известных дефектов: каждый `it.fails` в тестах ядра закреплён за ОТКРЫТОЙ задачей beads.
 *
 * Политика (`docs/plans/core-tests-coverage.md`): тест, вскрывший крупный или спорный дефект,
 * пишется как `it.fails('… [ReFormer-xxxx]')` с одним утверждением — он покраснеет, когда дефект
 * починят. Обратную сторону ловит этот файл: `it.fails` без задачи, временная метка исполнителя
 * `[DEFECT-…]` вместо id и задача, закрытая без исправления (`it.fails` остался — значит, дефект
 * жив). Статус берётся из `.beads/issues.jsonl` корня репозитория — без него проверка статуса
 * пропускается.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE = fileURLToPath(new URL('../..', import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const ISSUES = join(PACKAGE, '../../.beads/issues.jsonl');
const ISSUE_ID = /\[(ReFormer-[a-z0-9]+(?:\.\d+)*)\]/g;

/** Тестовые файлы каталога (рекурсивно), кроме этого: его тексты — примеры, а не дефекты. */
function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : testFiles(path);
    return /\.test\.tsx?$/.test(entry.name) && path !== SELF ? [path] : [];
  });
}

interface KnownDefect {
  readonly file: string;
  readonly title: string;
  readonly ids: readonly string[];
}

/** `it.fails(…)` — название теста и id задач в нём. Название — первый строковый аргумент. */
function knownDefects(): KnownDefect[] {
  const found: KnownDefect[] = [];
  for (const path of [...testFiles(join(PACKAGE, 'tests')), ...testFiles(join(PACKAGE, 'src'))]) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/\bit\.fails\(\s*(['"`])([\s\S]*?)\1/g)) {
      const title = match[2];
      found.push({
        file: relative(PACKAGE, path).replace(/\\/g, '/'),
        title,
        ids: [...title.matchAll(ISSUE_ID)].map((id) => id[1]),
      });
    }
  }
  return found;
}

/** Статус задач из выгрузки beads: id → status. */
function issueStatuses(): Map<string, string> {
  const statuses = new Map<string, string>();
  for (const line of readFileSync(ISSUES, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    const issue = JSON.parse(line) as { id: string; status: string };
    statuses.set(issue.id, issue.status);
  }
  return statuses;
}

describe('известные дефекты — it.fails закреплены за задачами', () => {
  const defects = knownDefects();

  it('находит it.fails в тестах пакета', () => {
    expect(defects.length).toBeGreaterThan(0);
  });

  it('в названии каждого it.fails — id задачи [ReFormer-xxxx]', () => {
    expect(defects.filter((defect) => defect.ids.length === 0)).toEqual([]);
  });

  it('временных меток исполнителей [DEFECT-…] в тестах нет', () => {
    const labelled = [...testFiles(join(PACKAGE, 'tests')), ...testFiles(join(PACKAGE, 'src'))]
      .filter((path) => /\[DEFECT-/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(PACKAGE, path).replace(/\\/g, '/'));
    expect(labelled).toEqual([]);
  });

  it.skipIf(!existsSync(ISSUES))('задачи it.fails есть в beads и не закрыты', () => {
    const statuses = issueStatuses();
    const stale = defects.flatMap((defect) =>
      defect.ids
        .filter((id) => statuses.get(id) === undefined || statuses.get(id) === 'closed')
        .map((id) => `${defect.file}: ${id} (${statuses.get(id) ?? 'нет в выгрузке'})`)
    );
    expect(stale).toEqual([]);
  });
});
