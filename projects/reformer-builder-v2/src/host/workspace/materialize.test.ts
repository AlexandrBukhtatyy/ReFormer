/**
 * Тесты догрузки замыкания.
 *
 * Главное здесь — не «оно обошло дерево», а два свойства, из-за которых модуль и написан:
 * бэйр-спецификаторы не догружаются ВОВСЕ (иначе рядом с оболочкой окажется второй рантайм),
 * и превышение бюджета останавливает обход СО СЛОВАМИ — с указанием, на чём встали и сколько
 * осталось. Молчаливое усечение выглядит как «всё загрузилось», и его отсутствие проверяется
 * тем, что диагностика есть и несёт `at` и `pending`.
 *
 * @module host/workspace/materialize.test
 */

import { describe, expect, it } from 'vitest';

import {
  CLOSURE_DIAGNOSTIC_SOURCE,
  DEFAULT_CLOSURE_BUDGET,
  extractRelativeImports,
  materializeClosure,
  resolveRelative,
  type ClosureHost,
} from './materialize';

const encoder = new TextEncoder();

/** Двойник Workspace для обхода: плоская карта «путь → текст» и журнал материализаций. */
function hostFor(files: Readonly<Record<string, string>>): {
  host: ClosureHost;
  materialized: string[];
} {
  const materialized: string[] = [];
  const seen = new Set<string>();
  const host: ClosureHost = {
    async materialize(path) {
      const text = files[path];
      if (text === undefined) return null;
      materialized.push(path);
      const fresh = !seen.has(path);
      seen.add(path);
      return { path, bytes: encoder.encode(text).length, fresh };
    },
    async textOf(path) {
      return files[path] ?? null;
    },
    async resolves(path) {
      return Object.prototype.hasOwnProperty.call(files, path);
    },
  };
  return { host, materialized };
}

describe('extractRelativeImports', () => {
  it('находит все виды спецификаторов и отбрасывает бэйр', () => {
    const text = [
      "import React from 'react';",
      "import { rules } from './rules';",
      "export { schema } from '../shared/schema';",
      "import './styles.css';",
      "const lazy = await import('./lazy');",
      "const cjs = require('./legacy');",
      "import { core } from '@reformer/core';",
    ].join('\n');

    expect(extractRelativeImports('src/a.ts', text)).toEqual([
      './rules',
      '../shared/schema',
      './styles.css',
      './lazy',
      './legacy',
    ]);
  });

  it('находит JSON-ссылки: `$ref` — стандартный ключ, а не знание про формы', () => {
    const text = '{ "validation": { "$ref": "./validation.json" }, "x": { "$ref": "#/defs/y" } }';

    expect(extractRelativeImports('src/schema.json', text)).toEqual(['./validation.json']);
  });

  it('даёт тот же ответ при повторном вызове: `lastIndex` глобальной регулярки сброшен', () => {
    const text = "import a from './a';\nimport b from './b';";

    expect(extractRelativeImports('x.ts', text)).toEqual(extractRelativeImports('x.ts', text));
    expect(extractRelativeImports('x.ts', text)).toEqual(['./a', './b']);
  });

  it('не повторяет один и тот же спецификатор', () => {
    const text = "import { a } from './x';\nimport { b } from './x';";

    expect(extractRelativeImports('y.ts', text)).toEqual(['./x']);
  });
});

describe('resolveRelative', () => {
  const exists = (files: readonly string[]) => async (path: string) => files.includes(path);

  it('дописывает расширение', async () => {
    const found = await resolveRelative(
      'src/form/schema.ts',
      './validation',
      exists(['src/form/validation.ts'])
    );

    expect(found).toBe('src/form/validation.ts');
  });

  it('падает на барель каталога только после файла', async () => {
    const both = ['src/form/rules.ts', 'src/form/rules/index.ts'];

    expect(await resolveRelative('src/form/a.ts', './rules', exists(both))).toBe(
      'src/form/rules.ts'
    );
    expect(
      await resolveRelative('src/form/a.ts', './rules', exists(['src/form/rules/index.ts']))
    ).toBe('src/form/rules/index.ts');
  });

  it('переводит `.js` в соседний `.ts` — соглашение NodeNext', async () => {
    const found = await resolveRelative(
      'src/form/a.ts',
      './helper.js',
      exists(['src/form/helper.ts'])
    );

    expect(found).toBe('src/form/helper.ts');
  });

  it('считает базой каталог ФАЙЛА, а не сам файл', async () => {
    const found = await resolveRelative(
      'src/forms/credit/schema.json',
      '../shared/rules.ts',
      exists(['src/forms/shared/rules.ts'])
    );

    expect(found).toBe('src/forms/shared/rules.ts');
  });

  it('побег за корень источника не резолвится и не бросает', async () => {
    expect(await resolveRelative('a.ts', '../../etc/hosts', exists(['etc/hosts']))).toBeNull();
  });

  it('несуществующий сосед — null, а не догадка', async () => {
    expect(await resolveRelative('src/a.ts', './nope', exists(['src/a.ts']))).toBeNull();
  });
});

describe('materializeClosure', () => {
  it('тянет относительных соседей и не трогает бэйр-спецификаторы', async () => {
    const { host, materialized } = hostFor({
      'src/form/schema.ts':
        "import { rules } from './rules';\nimport React from 'react';\nimport { core } from '@reformer/core';",
      'src/form/rules.ts': "import { shared } from '../shared/base';",
      'src/shared/base.ts': 'export const shared = 1;',
    });

    const result = await materializeClosure('src/form/schema.ts', host);

    expect(result.files).toEqual(['src/form/schema.ts', 'src/form/rules.ts', 'src/shared/base.ts']);
    expect(materialized).not.toContain('react');
    expect(materialized).not.toContain('@reformer/core');
    expect(result.stopped).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
  });

  it('цикл через барель не зацикливает обход', async () => {
    const { host } = hostFor({
      'a.ts': "export * from './b';",
      'b.ts': "export * from './a';",
    });

    const result = await materializeClosure('a.ts', host);

    expect(result.files).toEqual(['a.ts', 'b.ts']);
    expect(result.depth).toBe(1);
  });

  it('останавливается на глубине и говорит, где именно', async () => {
    const { host } = hostFor({
      'f0.ts': "import './f1';",
      'f1.ts': "import './f2';",
      'f2.ts': "import './f3';",
      'f3.ts': "import './f4';",
      'f4.ts': 'export const end = 1;',
    });

    const result = await materializeClosure('f0.ts', host, {
      budget: { ...DEFAULT_CLOSURE_BUDGET, depth: 2 },
    });

    expect(result.files).toEqual(['f0.ts', 'f1.ts', 'f2.ts']);
    expect(result.stopped).toMatchObject({ reason: 'depth', at: 'f2.ts', limit: 2 });

    const [diagnostic] = result.diagnostics;
    expect(diagnostic.code).toBe('workspace.closure-budget-depth');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.source).toBe(CLOSURE_DIAGNOSTIC_SOURCE);
    expect(diagnostic.params).toMatchObject({ at: 'f2.ts', limit: 2, materialized: 3 });
  });

  it('останавливается на числе файлов и перечисляет, сколько осталось', async () => {
    const { host, materialized } = hostFor({
      'root.ts': "import './d1';\nimport './d2';\nimport './d3';\nimport './d4';",
      'd1.ts': 'export const a = 1;',
      'd2.ts': 'export const b = 2;',
      'd3.ts': 'export const c = 3;',
      'd4.ts': 'export const d = 4;',
    });

    const result = await materializeClosure('root.ts', host, {
      budget: { ...DEFAULT_CLOSURE_BUDGET, files: 3 },
    });

    expect(result.files).toHaveLength(3);
    expect(materialized).toHaveLength(3);
    expect(result.stopped?.reason).toBe('files');
    expect(result.stopped?.pending).toEqual(['d3.ts', 'd4.ts']);

    // Именно это отличает «остановились и сказали» от молчаливого усечения.
    expect(result.diagnostics[0].code).toBe('workspace.closure-budget-files');
    expect(result.diagnostics[0].params).toMatchObject({
      at: 'd3.ts',
      limit: 3,
      materialized: 3,
      pending: 2,
    });
  });

  it('останавливается на объёме, не записав файл, который в бюджет не влез', async () => {
    const { host, materialized } = hostFor({
      'root.ts': "import './huge';",
      'huge.ts': 'x'.repeat(1_000),
    });

    const result = await materializeClosure('root.ts', host, {
      budget: { ...DEFAULT_CLOSURE_BUDGET, bytes: 100 },
    });

    expect(result.files).toEqual(['root.ts']);
    expect(result.stopped).toMatchObject({ reason: 'bytes', at: 'huge.ts', limit: 100 });
    expect(result.stopped?.pending).toContain('huge.ts');
    // Материализация случилась, но в замыкание файл не зачтён — иначе бюджет по объёму
    // проверялся бы после того, как объём уже занят.
    expect(materialized).toEqual(['root.ts', 'huge.ts']);
  });

  it('бюджет считается по посещённым, а не по свежим: повтор даёт тот же ответ', async () => {
    const files = {
      'root.ts': "import './d1';\nimport './d2';\nimport './d3';",
      'd1.ts': 'a',
      'd2.ts': 'b',
      'd3.ts': 'c',
    };
    const { host } = hostFor(files);
    const budget = { ...DEFAULT_CLOSURE_BUDGET, files: 2 };

    const first = await materializeClosure('root.ts', host, { budget });
    const second = await materializeClosure('root.ts', host, { budget });

    expect(second.files).toEqual(first.files);
    expect(second.stopped?.reason).toBe('files');
  });

  it('нерезолвнутый импорт — предупреждение, а не тишина и не отказ', async () => {
    const { host } = hostFor({ 'a.ts': "import './gone';" });

    const result = await materializeClosure('a.ts', host);

    expect(result.files).toEqual(['a.ts']);
    expect(result.unresolved).toEqual([{ from: 'a.ts', specifier: './gone' }]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'workspace.import-unresolved',
      severity: 'warning',
      params: { from: 'a.ts', specifier: './gone' },
    });
  });

  it('идёт по ссылкам JSON так же, как по импортам', async () => {
    const { host } = hostFor({
      'form/schema.json': '{ "validation": { "$ref": "./validation.json" } }',
      'form/validation.json': '{ "rules": [] }',
    });

    const result = await materializeClosure('form/schema.json', host);

    expect(result.files).toEqual(['form/schema.json', 'form/validation.json']);
  });

  it('отсутствующий корень не роняет обход, а попадает в нерезолвнутое', async () => {
    const { host } = hostFor({});

    const result = await materializeClosure('nope.ts', host);

    expect(result.files).toEqual([]);
    expect(result.unresolved).toHaveLength(1);
  });
});
