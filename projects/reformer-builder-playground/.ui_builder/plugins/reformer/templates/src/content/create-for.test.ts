import { describe, expect, it } from 'vitest';
import type { FormTemplate, TemplateStore } from '../contract';
import { createFakeTemplatesHost } from '../testing';
import { createFormFor, templateSummaries, type CreateFormRequest } from './create-for';

const CREDIT: FormTemplate = {
  id: 'credit',
  name: 'Кредит',
  description: 'Заявка на кредит',
  source: 'project',
  files: [
    { path: 'schema/form.schema.json', content: '{"format":2,"root":{"component":"$html(div)"}}' },
    { path: 'model.ts', content: 'export const __formName__Model = 1;' },
  ],
};

const store: TemplateStore = {
  source: 'project',
  available: () => true,
  list: async () => [CREDIT],
};

function create(request: CreateFormRequest, files: Record<string, string> = {}, root?: null) {
  const host = createFakeTemplatesHost({ files, ...(root === null ? { projectRoot: null } : {}) });
  const deps = {
    host,
    stores: () => [store],
    translate: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key} ${JSON.stringify(params)}`,
  };
  return { host, report: createFormFor(deps, request) };
}

describe('создание формы по заказу', () => {
  it('без шаблона — пустая форма: один документ в schema/, в корне проекта', async () => {
    const { host, report } = create({ formName: 'credit' });
    expect(await report).toEqual({
      ok: true,
      documentId: 'project/credit/schema/form.schema.json',
      path: 'project/credit/schema/form.schema.json',
      template: null,
    });
    expect([...host.files.keys()]).toEqual(['project/credit/schema/form.schema.json']);
    const schema = JSON.parse(host.files.get('project/credit/schema/form.schema.json') ?? '');
    expect(schema).toMatchObject({ format: 2, root: { children: [] } });
  });

  it('каталог форм проекта — место по умолчанию', async () => {
    const { report } = create({ formName: 'credit' }, { 'project/forms/README.md': '' });
    expect(await report).toMatchObject({
      documentId: 'project/forms/credit/schema/form.schema.json',
    });
  });

  it('рядом с открытым документом — рядом с его модулем, а не внутри', async () => {
    const near = 'project/src/forms/contact/schema/form.schema.json';
    const { report } = create(
      { formName: 'credit', near: near as never },
      { [near]: '{}', 'project/forms/README.md': '' }
    );
    expect(await report).toMatchObject({
      documentId: 'project/src/forms/credit/schema/form.schema.json',
    });
  });

  it('названный каталог — от корня проекта', async () => {
    const { report } = create({ formName: 'credit', folder: 'src/pages/' });
    expect(await report).toMatchObject({
      documentId: 'project/src/pages/credit/schema/form.schema.json',
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
    expect(await create({ formName: 'loan' }, {}, null).report).toMatchObject({
      error: 'error.no-project',
    });
  });

  it('занятое имя не перезаписывается — форма ложится рядом', async () => {
    const { report } = create(
      { formName: 'credit' },
      { 'project/credit/schema/form.schema.json': 'old' }
    );
    expect(await report).toMatchObject({ documentId: 'project/credit-2/schema/form.schema.json' });
  });
});

describe('сводка шаблонов', () => {
  it('без файлов — только то, по чему шаблон выбирают', async () => {
    expect(await templateSummaries([store])).toEqual([
      { id: 'credit', name: 'Кредит', description: 'Заявка на кредит', source: 'project' },
    ]);
  });
});
