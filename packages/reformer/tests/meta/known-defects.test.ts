/**
 * Мета-тест известных дефектов: каждый `it.fails` в тестах ядра и каждая метка дефекта типов
 * закреплены за ОТКРЫТОЙ задачей beads.
 *
 * Политика (`docs/plans/core-tests-coverage.md`): тест, вскрывший крупный или спорный дефект,
 * пишется как `it.fails('… [ReFormer-xxxx]')` с одним утверждением — он покраснеет, когда дефект
 * починят. В type-тестах (`*.type-test.ts`) ту же роль играет комментарий с меткой:
 * `// @ts-expect-error [ReFormer-xxxx] …` над кодом, который обязан компилироваться (после
 * исправления директива станет лишней), либо `// [ReFormer-xxxx] сейчас компилируется, а не
 * должно: …` (после исправления строка станет ошибкой) — об исправлении сообщит `tsc`.
 *
 * Обратную сторону ловит этот файл: `it.fails` без задачи, временная метка исполнителя
 * `[DEFECT-…]` вместо id и задача, закрытая без исправления (метка осталась — значит, дефект жив).
 * Статус берётся из `.beads/issues.jsonl` корня репозитория — без него проверка статуса
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
/** Метка дефекта типов: комментарий начинается с id задачи (после `@ts-expect-error`, если он есть). */
const TYPE_DEFECT = /\/\/\s*(?:@ts-expect-error\s+)?\[(ReFormer-[a-z0-9]+(?:\.\d+)*)\]/g;

/** Файлы пакета по имени (рекурсивно), кроме этого: его тексты — примеры, а не дефекты. */
function filesOf(dir: string, name: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : filesOf(path, name);
    return name.test(entry.name) && path !== SELF ? [path] : [];
  });
}

const packageFiles = (name: RegExp): string[] => [
  ...filesOf(join(PACKAGE, 'tests'), name),
  ...filesOf(join(PACKAGE, 'src'), name),
];
const testFiles = (): string[] => packageFiles(/\.test\.tsx?$/);
const typeTestFiles = (): string[] => packageFiles(/\.type-test\.ts$/);
const relativePath = (path: string): string => relative(PACKAGE, path).replace(/\\/g, '/');

/** Запись «дефект закреплён за задачей»: где он размечен и какой задачей. */
interface Pinned {
  readonly file: string;
  readonly id: string;
}

/** `it.fails(…)` в исходнике: название теста (первый строковый аргумент) и id задач в нём. */
function failingTestsIn(source: string): Array<{ title: string; ids: string[] }> {
  return [...source.matchAll(/\bit\.fails\(\s*(['"`])([\s\S]*?)\1/g)].map((match) => ({
    title: match[2],
    ids: [...match[2].matchAll(ISSUE_ID)].map((id) => id[1]),
  }));
}

/** Id задач в метках дефектов типов исходника, без повторов. */
function typeDefectIdsIn(source: string): string[] {
  return [...new Set([...source.matchAll(TYPE_DEFECT)].map((match) => match[1]))];
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

/** Задачи, которых нет в выгрузке или которые закрыты: «файл: id (причина)». */
function staleIssues(pinned: readonly Pinned[]): string[] {
  const statuses = issueStatuses();
  return pinned
    .filter(({ id }) => statuses.get(id) === undefined || statuses.get(id) === 'closed')
    .map(({ file, id }) => `${file}: ${id} (${statuses.get(id) ?? 'нет в выгрузке'})`);
}

describe('известные дефекты — разбор разметки', () => {
  it('it.fails: название теста и id задач в нём, в том числе с переносом после скобки', () => {
    const source = [
      "it.fails('сброс возвращает ставку [ReFormer-ab12]', () => {});",
      'it.fails(',
      "  'две задачи [ReFormer-cd34] и [ReFormer-9981.14]',",
      '  async () => {}',
      ');',
      "it.fails('без задачи', () => {});",
      "it('обычный тест [ReFormer-ef56]', () => {});",
    ].join('\n');

    expect(failingTestsIn(source)).toEqual([
      { title: 'сброс возвращает ставку [ReFormer-ab12]', ids: ['ReFormer-ab12'] },
      {
        title: 'две задачи [ReFormer-cd34] и [ReFormer-9981.14]',
        ids: ['ReFormer-cd34', 'ReFormer-9981.14'],
      },
      { title: 'без задачи', ids: [] },
    ]);
  });

  it('метки дефектов типов: оба вида комментария, без повторов; id в тексте — не метка', () => {
    const source = [
      '// @ts-expect-error [ReFormer-ab12] должно компилироваться',
      'model.files = null;',
      '  // [ReFormer-cd34] сейчас компилируется, а не должно: фасада у поля нет',
      '// [ReFormer-ab12] сейчас компилируется, а не должно: тот же дефект',
      '// @ts-expect-error — обычная отрицательная проверка, см. [ReFormer-ef56]',
      ' * Дефекты типов размечены `[ReFormer-xxxx]`',
    ].join('\n');

    expect(typeDefectIdsIn(source)).toEqual(['ReFormer-ab12', 'ReFormer-cd34']);
  });
});

describe('известные дефекты — it.fails закреплены за задачами', () => {
  const failing = testFiles().flatMap((path) =>
    failingTestsIn(readFileSync(path, 'utf8')).map((test) => ({
      file: relativePath(path),
      ...test,
    }))
  );

  it('в названии каждого it.fails — id задачи [ReFormer-xxxx]', () => {
    expect(failing.filter((test) => test.ids.length === 0)).toEqual([]);
  });

  it('временных меток исполнителей [DEFECT-…] в тестах и type-тестах нет', () => {
    const labelled = [...testFiles(), ...typeTestFiles()]
      .filter((path) => /\[DEFECT-/.test(readFileSync(path, 'utf8')))
      .map(relativePath);
    expect(labelled).toEqual([]);
  });

  it.skipIf(!existsSync(ISSUES))('задачи it.fails есть в beads и не закрыты', () => {
    const pinned = failing.flatMap((test) => test.ids.map((id) => ({ file: test.file, id })));
    expect(staleIssues(pinned)).toEqual([]);
  });
});

describe('известные дефекты типов — метки type-тестов закреплены за задачами', () => {
  it.skipIf(!existsSync(ISSUES))('задачи меток есть в beads и не закрыты', () => {
    const pinned = typeTestFiles().flatMap((path) =>
      typeDefectIdsIn(readFileSync(path, 'utf8')).map((id) => ({ file: relativePath(path), id }))
    );
    expect(staleIssues(pinned)).toEqual([]);
  });
});
