/**
 * Создание формы по заказу у хозяина: пустая форма и место — ответы двойника стека. Со стеком
 * ReFormer — `../cross/create-for.test`.
 *
 * @module plugins/forms/templates/content/create-for.test
 */

import { describe, expect, it } from 'vitest';
import type { TemplateStack } from '@reformer/builder-plugin-api';
import type { FormTemplate, TemplateStore } from '../contract';
import { createFakeTemplateStack, createFakeTemplatesHost, FAKE_DOCUMENT } from '../testing';
import { createFormFor, templateSummaries, type CreateFormRequest } from './create-for';

const CREDIT: FormTemplate = {
  id: 'credit',
  name: 'Кредит',
  description: 'Заявка на кредит',
  source: 'project',
  files: [
    { path: FAKE_DOCUMENT, content: '{}' },
    { path: 'model.ts', content: 'export const __formName__Model = 1;' },
  ],
};

const store: TemplateStore = {
  source: 'project',
  available: () => true,
  list: async () => [CREDIT],
};

/** Двойник стека: пустая форма — один документ в `doc/`, документ модуля — в его папке `doc/`. */
const stack = createFakeTemplateStack({
  empty: () => ({
    id: 'empty',
    name: 'empty',
    source: 'builtin',
    files: [{ path: `doc/${FAKE_DOCUMENT}`, content: '{"empty":true}' }],
  }),
  moduleDepthOf: (path) => (path.endsWith(`/doc/${FAKE_DOCUMENT}`) ? 1 : null),
});

function create(
  request: CreateFormRequest,
  files: Record<string, string> = {},
  options: { readonly root?: null; readonly stacks?: readonly TemplateStack[] } = {}
) {
  const host = createFakeTemplatesHost({
    files,
    stacks: options.stacks ?? [stack],
    ...(options.root === null ? { projectRoot: null } : {}),
  });
  const deps = {
    host,
    stores: () => [store],
    translate: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key} ${JSON.stringify(params)}`,
  };
  return { host, report: createFormFor(deps, request) };
}

describe('создание формы по заказу', () => {
  it('без шаблона — пустая форма стека, в корне проекта', async () => {
    const { host, report } = create({ formName: 'credit' });
    expect(await report).toEqual({
      ok: true,
      documentId: `project/credit/doc/${FAKE_DOCUMENT}`,
      path: `project/credit/doc/${FAKE_DOCUMENT}`,
      template: null,
    });
    expect([...host.files.entries()]).toEqual([
      [`project/credit/doc/${FAKE_DOCUMENT}`, '{"empty":true}'],
    ]);
  });

  it('стека с пустой формой нет — создавать без шаблона нечем, и это отказ', async () => {
    const { host, report } = create({ formName: 'credit' }, {}, { stacks: [] });
    expect(await report).toMatchObject({ ok: false, error: 'error.no-empty-form' });
    expect(host.files.size).toBe(0);
  });

  it('каталог форм проекта — место по умолчанию', async () => {
    const { report } = create({ formName: 'credit' }, { 'project/forms/README.md': '' });
    expect(await report).toMatchObject({ documentId: `project/forms/credit/doc/${FAKE_DOCUMENT}` });
  });

  it('рядом с открытым документом — рядом с его модулем, на глубину, названную стеком', async () => {
    const near = `project/src/forms/contact/doc/${FAKE_DOCUMENT}`;
    const { report } = create(
      { formName: 'credit', near: near as never },
      { [near]: '{}', 'project/forms/README.md': '' }
    );
    expect(await report).toMatchObject({
      documentId: `project/src/forms/credit/doc/${FAKE_DOCUMENT}`,
    });
  });

  it('названный каталог — от корня проекта', async () => {
    const { report } = create({ formName: 'credit', folder: 'src/pages/' });
    expect(await report).toMatchObject({
      documentId: `project/src/pages/credit/doc/${FAKE_DOCUMENT}`,
    });
  });

  it('шаблон ищется по идентификатору и по имени, кладутся все его файлы', async () => {
    const byName = create({ formName: 'loan', template: 'кредит' });
    expect(await byName.report).toMatchObject({ ok: true, template: 'Кредит' });
    expect(byName.host.files.get('project/loan/model.ts')).toBe('export const loanModel = 1;');

    const byId = create({ formName: 'loan', template: 'credit' });
    expect(await byId.report).toMatchObject({ ok: true, template: 'Кредит' });
  });

  it('неизвестный шаблон, пустое имя, нет проекта — отказ ключом и текстом', async () => {
    expect(await create({ formName: 'loan', template: 'нет такого' }).report).toEqual({
      ok: false,
      error: 'error.unknown-template',
      message: 'error.unknown-template {"template":"нет такого"}',
    });
    expect(await create({ formName: ' !' }).report).toMatchObject({ error: 'error.no-form-name' });
    expect(await create({ formName: 'loan' }, {}, { root: null }).report).toMatchObject({
      error: 'error.no-project',
    });
  });
});

describe('сводка шаблонов', () => {
  it('без файлов — только то, по чему шаблон выбирают', async () => {
    expect(await templateSummaries([store])).toEqual([
      { id: 'credit', name: 'Кредит', description: 'Заявка на кредит', source: 'project' },
    ]);
  });
});
