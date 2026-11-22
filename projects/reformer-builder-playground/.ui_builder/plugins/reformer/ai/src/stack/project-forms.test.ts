/**
 * Формы проекта и форма файла: подъём от файла модуля и обход проекта на списке путей.
 *
 * @module plugins/reformer/ai/stack/project-forms.test
 */

import { describe, expect, it } from 'vitest';
import { formPathOf, projectFormPaths, type ProjectFilesView } from './project-forms';

const FORM = '{"root":{"children":[]}}';

/** Файлы проекта: путь → текст; каталоги выводятся из путей. */
function view(files: Readonly<Record<string, string>>): ProjectFilesView & { listed: string[] } {
  const listed: string[] = [];
  return {
    listed,
    list(dir) {
      listed.push(dir);
      const prefix = dir === '' ? '' : `${dir}/`;
      const names = new Map<string, string>();
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf('/');
        names.set(slash < 0 ? rest : rest.slice(0, slash), slash < 0 ? 'file' : 'directory');
      }
      return Promise.resolve([...names].map(([name, kind]) => ({ name, kind })));
    },
    exists: (path) => Promise.resolve(path in files),
    read: (path) => Promise.resolve(files[path] ?? null),
  };
}

const recognizes = (text: string): boolean => {
  try {
    return typeof (JSON.parse(text) as { root?: unknown }).root === 'object';
  } catch {
    return false;
  }
};

const PROJECT = view({
  'README.md': '# проект',
  'forms/order/schema/form.schema.json': FORM,
  'forms/order/schema/steps/contacts/form.schema.json': '{"node":{}}',
  'forms/order/validation/form.ts': '',
  'forms/order/application/create.ts': '',
  'forms/contact/form.schema.json': FORM,
  'forms/contact/steps/main/form.schema.json': '{"node":{}}',
  'forms/contact/validation/form.ts': '',
  'forms/credit.schema.json': FORM,
  'forms/notes.md': '',
  'config/app.schema.json': '{"type":"object"}',
  'node_modules/pkg/forms/x/schema/form.schema.json': FORM,
  '.cache/forms/y/form.schema.json': FORM,
});

describe('formPathOf — форма файла', () => {
  it.each([
    ['forms/order/validation/form.ts', 'forms/order/schema/form.schema.json'],
    ['forms/order/application/create.ts', 'forms/order/schema/form.schema.json'],
    ['forms/contact/validation/form.ts', 'forms/contact/form.schema.json'],
    ['forms/order/schema/form.schema.json', 'forms/order/schema/form.schema.json'],
  ])('%s → %s', async (file, form) => {
    expect(await formPathOf(file, PROJECT)).toBe(form);
  });

  it('файл шага ведёт к корню формы, а не к себе — и во вложенной, и в плоской раскладке', async () => {
    expect(await formPathOf('forms/order/schema/steps/contacts/form.schema.json', PROJECT)).toBe(
      'forms/order/schema/form.schema.json'
    );
    expect(await formPathOf('forms/contact/steps/main/form.schema.json', PROJECT)).toBe(
      'forms/contact/form.schema.json'
    );
  });

  it('файл вне модуля формы ей не принадлежит', async () => {
    expect(await formPathOf('README.md', PROJECT)).toBeNull();
    expect(await formPathOf('forms/notes.md', PROJECT)).toBeNull();
  });
});

describe('projectFormPaths — формы проекта', () => {
  it('вложенная, плоская и со свободным именем; без шагов, чужих схем и служебных каталогов', async () => {
    expect(await projectFormPaths(PROJECT, recognizes)).toEqual([
      'forms/contact/form.schema.json',
      'forms/credit.schema.json',
      'forms/order/schema/form.schema.json',
    ]);
  });

  it('в модуль найденной формы обход не спускается', async () => {
    const project = view({
      'forms/order/schema/form.schema.json': FORM,
      'forms/order/validation/form.ts': '',
    });
    await projectFormPaths(project, recognizes);
    expect(project.listed).not.toContain('forms/order/validation');
    expect(project.listed).not.toContain('forms/order/schema');
  });
});
