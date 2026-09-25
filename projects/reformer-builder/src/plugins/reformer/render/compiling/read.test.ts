/**
 * Чтение сайдкаров: имена для компилятора, адреса для свода диагностик.
 *
 * @module plugins/reformer/render/compiling/read.test
 */

import { describe, expect, it } from 'vitest';
import { createFakeHost, fakeRef } from '../testing';
import { attributeProblems, readSidecars } from './read';

const DOC = 'fake:form/form.json';

describe('readSidecars', () => {
  it('отдаёт и исходники по именам, и адреса по именам', async () => {
    const host = createFakeHost({
      siblings: { 'validation.ts': 'export const formValidation = {};', 'model.ts': 'export {};' },
    });
    const sources = await readSidecars(host, DOC);
    expect([...sources.files.keys()].sort()).toEqual(['model.ts', 'validation.ts']);
    expect(sources.resources.get('validation.ts')).toBe('fake:form/validation.ts');
    expect(sources.problems).toEqual([]);
  });

  it('отказ чтения одного файла адресуется этим файлом и не отменяет остальных', async () => {
    const host = createFakeHost({ siblings: { 'validation.ts': 'ok', 'model.ts': 'ok' } });
    const broken = {
      ...host,
      readText: (id: string) =>
        id.endsWith('model.ts') ? Promise.reject(new Error('нет доступа')) : host.readText(id),
    };
    const sources = await readSidecars(broken, DOC);
    expect([...sources.files.keys()]).toEqual(['validation.ts']);
    expect(sources.problems).toEqual([
      {
        file: 'model.ts',
        phase: 'resolve',
        message: 'нет доступа',
        resource: 'fake:form/model.ts',
      },
    ]);
  });
});

describe('readSidecars — обход папок шагов', () => {
  /** Порт с листингом: плоская карта «путь от каталога формы → текст». */
  function treeHost(tree: Record<string, string>, failing: readonly string[] = []) {
    const base = createFakeHost();
    const ROOT = 'fake:form';
    const list = async (dir: string) => {
      if (failing.includes(dir)) throw new Error(`нет доступа: ${dir}`);
      const prefix = dir === ROOT ? '' : `${dir.slice(ROOT.length + 1)}/`;
      const names = new Map<string, 'file' | 'directory'>();
      for (const path of Object.keys(tree)) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const cut = rest.indexOf('/');
        names.set(cut === -1 ? rest : rest.slice(0, cut), cut === -1 ? 'file' : 'directory');
      }
      return [...names].map(([name, kind]) => fakeRef(`${dir}/${name}`, { kind }));
    };
    return {
      ...base,
      list,
      parentOf: (id: string) => id.slice(0, id.lastIndexOf('/')),
      readText: async (id: string) => {
        const text = tree[id.slice(ROOT.length + 1)];
        if (text === undefined) throw new Error(`нет файла ${id}`);
        return text;
      },
    };
  }

  it('ключи — пути от каталога формы; steps/index.ts на месте, корневой index — нет', async () => {
    const host = treeHost({
      'index.tsx': 'страница',
      'validation.ts': 'x',
      'steps/index.ts': 'x',
      'steps/kontakty/validation.ts': 'x',
      'steps/kontakty/form.render.ts': 'x',
      'steps/kontakty/validation.test.ts': 'x',
    });
    const sources = await readSidecars(host, DOC);
    expect([...sources.files.keys()]).toEqual([
      'steps/index.ts',
      'steps/kontakty/form.render.ts',
      'steps/kontakty/validation.ts',
      'validation.ts',
    ]);
    expect(sources.resources.get('steps/kontakty/validation.ts')).toBe(
      'fake:form/steps/kontakty/validation.ts'
    );
  });

  it('не спускается в node_modules, .ui_builder, скрытые папки и глубже трёх уровней', async () => {
    const host = treeHost({
      'model.ts': 'x',
      'node_modules/pkg/index.ts': 'x',
      '.ui_builder/codegen/a.ts': 'x',
      '.hidden/b.ts': 'x',
      'a/b/c/ok.ts': 'x',
      'a/b/c/d/deep.ts': 'x',
    });
    const sources = await readSidecars(host, DOC);
    expect([...sources.files.keys()]).toEqual(['a/b/c/ok.ts', 'model.ts']);
  });

  it('отказ листинга вложенной папки — находка, а не конец чтения', async () => {
    const host = treeHost({ 'model.ts': 'x', 'steps/a/validation.ts': 'x' }, ['fake:form/steps']);
    const sources = await readSidecars(host, DOC);
    expect([...sources.files.keys()]).toEqual(['model.ts']);
    expect(sources.problems).toEqual([
      expect.objectContaining({ file: 'steps/', phase: 'resolve', resource: 'fake:form/steps' }),
    ]);
  });
});

describe('attributeProblems', () => {
  const resources = new Map([['validation.ts', 'fake:form/validation.ts']]);

  it('находка, названная именем сайдкара, получает его адрес', () => {
    const [problem] = attributeProblems(
      [{ file: 'validation.ts', phase: 'transpile', message: 'x' }],
      resources
    );
    expect(problem.resource).toBe('fake:form/validation.ts');
  });

  it('уже адресованная находка и находка без файла остаются как есть', () => {
    const input = [
      { file: 'validation.ts', phase: 'transpile' as const, message: 'x', resource: 'own' },
      { file: '', phase: 'render' as const, message: 'y' },
    ];
    const out = attributeProblems(input, resources);
    expect(out[0]).toBe(input[0]);
    expect(out[1]).toBe(input[1]);
  });

  it('имя, которого среди сайдкаров нет, адреса не получает', () => {
    const [problem] = attributeProblems(
      [{ file: '__preview-entry__.js', phase: 'evaluate', message: 'x' }],
      resources
    );
    expect(problem.resource).toBeUndefined();
  });
});
