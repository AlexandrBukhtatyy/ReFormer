/**
 * Создание формы по шаблону с настоящим стеком ReFormer: модуль «папки по ролям», имена модуля,
 * место новой формы рядом с модулем, перевод схемы прежнего формата.
 *
 * Тест обеих сторон: запись и выбор места — хозяин, документ, токены модуля, глубина модуля и
 * каталог фикстуры — стек.
 *
 * @module plugins/reformer/integration/templates-operations.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { FormTemplate } from '../../forms/templates/src/contract';
import {
  generateFormFromTemplate,
  suggestedFolderOf,
} from '../../forms/templates/src/content/operations';
import { reformerStack } from '../templates/src/testing';
import { createProjectStore, TEMPLATES_DIR } from '../../forms/templates/src/stores/project';
import { createFakeTemplatesHost } from '../../forms/templates/src/testing';

const PARENT = 'src/forms' as ResourceId;

/** Стек ReFormer у хозяина. */
const STACKS = [reformerStack()];

describe('форма по шаблону в раскладке «папки по ролям»', () => {
  // Так выглядит встроенный шаблон: документ формы в `schema/`, шаги рядом с ним, страница и
  // файлы ролей названы именами модуля, фикстура идёт сверх модуля.
  const moduleTemplate: FormTemplate = {
    id: 'module',
    name: 'Модуль',
    source: 'builtin',
    files: [
      {
        path: 'schema/form.schema.json',
        content: JSON.stringify({
          format: 2,
          root: {
            component: '$component(Wizard)',
            children: [{ $ref: './steps/dannye/form.schema.json' }],
          },
        }),
      },
      {
        path: 'schema/steps/dannye/form.schema.json',
        content: '{"node":{"component":"$component(Step)","children":[]}}',
      },
      { path: '__FormType__.tsx', content: 'export default function __FormType__() {}' },
      { path: 'types/__form-dir__.ts', content: 'export type __FormType__ = {};' },
      { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' },
    ],
  };
  const all = moduleTemplate.files.map((file) => file.path);

  it('каталог формы — каталог модуля; открывается документ из `schema/`', async () => {
    const host = createFakeTemplatesHost({ stacks: STACKS });

    const result = await generateFormFromTemplate(
      host,
      PARENT,
      'loan request',
      moduleTemplate,
      all
    );

    expect(result.ok).toBe(true);
    // Открывается корневой документ формы, а не первый попавшийся файл шага.
    expect(result.openId).toBe('src/forms/loan request/schema/form.schema.json');
    expect([...host.files.keys()].sort()).toEqual(
      [
        'src/forms/loan request/schema/form.schema.json',
        'src/forms/loan request/schema/steps/dannye/form.schema.json',
        // Имена файлов — те, что кодоген напечатал бы для этой формы: тип и kebab-каталог.
        'src/forms/loan request/LoanRequestForm.tsx',
        'src/forms/loan request/types/loan-request.ts',
        'src/forms/loan request/fixture.ts',
      ].sort()
    );
  });

  it('фикстура ложится в корень модуля, а не рядом со схемой в `schema/`', async () => {
    const host = createFakeTemplatesHost({ stacks: STACKS });

    await generateFormFromTemplate(host, PARENT, 'loan', moduleTemplate, all);

    // Там её и ищет превью: корень модуля — родитель папки `schema/`.
    expect(host.files.has('src/forms/loan/fixture.ts')).toBe(true);
    expect(host.files.has('src/forms/loan/schema/fixture.ts')).toBe(false);
  });

  it('имя подставляется по каталогу формы: занятое имя не разводит каталог и файлы', async () => {
    // Билдер называет форму именем каталога её модуля. Каталог `loan-2` с файлами под имя
    // `loan` дал бы после первой же генерации из билдера второй набор файлов рядом с первым.
    const host = createFakeTemplatesHost({
      stacks: STACKS,
      files: { 'src/forms/loan/чужое.ts': 'чужое' },
    });

    const result = await generateFormFromTemplate(host, PARENT, 'loan', moduleTemplate, all);

    expect(result.params?.folder).toBe('loan-2');
    expect(host.files.get('src/forms/loan-2/Loan2Form.tsx')).toBe(
      'export default function Loan2Form() {}'
    );
    expect(host.files.has('src/forms/loan-2/types/loan-2.ts')).toBe(true);
    expect(host.files.has('src/forms/loan-2/LoanForm.tsx')).toBe(false);
  });

  it('шаблон, который печатается, ложится текстом печати — под имя каталога формы', async () => {
    // Встроенный шаблон: раскладка строк модуля зависит от имён, поэтому на диск уходит не
    // подстановка в текст шаблона, а модуль, напечатанный под имя формы. Имя — каталог: занятое
    // `loan` даёт `loan-2`, и печататься обязан модуль `loan-2`.
    const names: string[] = [];
    const printing: FormTemplate = {
      ...moduleTemplate,
      print: async (formName) => {
        names.push(formName);
        return [
          { path: 'Loan2Form.tsx', content: 'export default function Loan2Form(\n) {}' },
          { path: 'types/loan-2.ts', content: 'export type Loan2Form =\n  {};' },
        ];
      },
    };
    const host = createFakeTemplatesHost({
      stacks: STACKS,
      files: { 'src/forms/loan/чужое.ts': 'чужое' },
    });

    const result = await generateFormFromTemplate(host, PARENT, 'loan', printing, all);

    expect(result.ok).toBe(true);
    expect(names).toEqual(['loan-2']);
    expect(host.files.get('src/forms/loan-2/Loan2Form.tsx')).toBe(
      'export default function Loan2Form(\n) {}'
    );
    expect(host.files.get('src/forms/loan-2/types/loan-2.ts')).toBe(
      'export type Loan2Form =\n  {};'
    );
    // Чего печать не дала (схема, шаг, фикстура), то легло подстановкой: набор файлов — шаблона.
    expect(host.files.has('src/forms/loan-2/schema/form.schema.json')).toBe(true);
    expect(host.files.get('src/forms/loan-2/fixture.ts')).toBe('export const fixture = {};');
    expect(result.openId).toBe('src/forms/loan-2/schema/form.schema.json');
  });
});

describe('куда предложить новую форму', () => {
  const host = createFakeTemplatesHost({
    stacks: STACKS,
    files: {
      'project/forms/old.json': '{}',
      'project/forms/loan/schema/form.schema.json': '{}',
      'project/forms/contact/form.schema.json': '{}',
      'project/schema/form.schema.json': '{}',
      'project/form.schema.json': '{}',
    },
  });
  const at = (path: string): ResourceId => suggestedFolderOf(host, path as ResourceId);

  it('свободно названный документ — его каталог: он лежит среди форм', () => {
    expect(at('project/forms/old.json')).toBe('project/forms');
  });

  it('документ модуля в `schema/` — каталог рядом с МОДУЛЕМ, а не внутри `schema/`', () => {
    // Форма, созданная в `loan/schema/`, стала бы частью чужого модуля.
    expect(at('project/forms/loan/schema/form.schema.json')).toBe('project/forms');
  });

  it('документ модуля прежней раскладки — тоже рядом с модулем', () => {
    expect(at('project/forms/contact/form.schema.json')).toBe('project/forms');
  });

  it('модуль в корне проекта — сам корень: подниматься выше некуда', () => {
    expect(at('project/schema/form.schema.json')).toBe('project');
    expect(at('project/form.schema.json')).toBe('project');
  });

  it('документ, пути которого порт не знает, — его каталог', () => {
    expect(at('project/forms/loan/schema/unknown.json')).toBe('project/forms/loan/schema');
  });
});

describe('шаблон проекта со схемой прежнего формата', () => {
  // Шаблон лежит в каталоге проекта файлами, и схема в нём могла быть написана до формата 2:
  // привязка в `value`, шаги визарда в `componentProps.steps`. Форма по такому шаблону —
  // новый документ билдера, и на диск он обязан лечь форматом 2.
  const TEMPLATE = `project/${TEMPLATES_DIR}/anketa`;
  const FORM = 'src/forms/Профиль';

  const legacyStep = (title: string, model: string) => ({
    component: '$component(Step)',
    componentProps: { title },
    children: [{ value: `$model(${model})`, component: '$component(Input)' }],
  });
  const step = (title: string, model: string) => ({
    component: '$component(Step)',
    componentProps: { title },
    children: [{ model: `$model(${model})`, component: '$component(Input)' }],
  });

  /** Применить единственный шаблон проекта целиком и отдать записанное. */
  async function apply(files: Record<string, unknown>) {
    const stored = Object.fromEntries(
      Object.entries(files).map(([path, json]) => [`${TEMPLATE}/${path}`, JSON.stringify(json)])
    );
    const host = createFakeTemplatesHost({ stacks: STACKS, files: stored });
    const [found] = await createProjectStore(host).list();
    const result = await generateFormFromTemplate(
      host,
      PARENT,
      'Профиль',
      found,
      found.files.map((f) => f.path)
    );
    const written = (path: string): unknown => JSON.parse(host.files.get(`${FORM}/${path}`) ?? '');
    return { host, stored, result, written };
  }

  it('применяется, а записанная схема — формата 2', async () => {
    const { host, stored, result, written } = await apply({
      'form.schema.json': {
        version: '1.0',
        root: {
          component: '$component(Wizard)',
          componentProps: { steps: [legacyStep('Данные', 'lastName')] },
        },
      },
    });

    expect(result).toMatchObject({ ok: true, openId: `${FORM}/form.schema.json` });
    expect(written('form.schema.json')).toEqual({
      format: 2,
      version: '1.0',
      root: { component: '$component(Wizard)', children: [step('Данные', 'lastName')] },
    });
    // Сам шаблон остаётся как лежал: переводится созданная форма, а не чужой файл проекта.
    for (const [path, text] of Object.entries(stored)) expect(host.files.get(path)).toBe(text);
  });

  it('разбитая по шагам — тоже: и корень со ссылками, и файлы шагов', async () => {
    const { result, written } = await apply({
      'form.schema.json': {
        version: '1.0',
        root: {
          component: '$component(Wizard)',
          componentProps: {
            steps: [
              { $ref: './steps/dannye/form.schema.json' },
              { $ref: './steps/kontakty/form.schema.json' },
            ],
          },
        },
      },
      'steps/dannye/form.schema.json': { node: legacyStep('Данные', 'lastName') },
      'steps/kontakty/form.schema.json': { node: legacyStep('Контакты', 'email') },
    });

    // Открывается корневая схема, а не первый попавшийся файл шага.
    expect(result).toMatchObject({ ok: true, openId: `${FORM}/form.schema.json` });
    expect(written('form.schema.json')).toEqual({
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Wizard)',
        children: [
          { $ref: './steps/dannye/form.schema.json' },
          { $ref: './steps/kontakty/form.schema.json' },
        ],
      },
    });
    expect(written('steps/dannye/form.schema.json')).toEqual({ node: step('Данные', 'lastName') });
    expect(written('steps/kontakty/form.schema.json')).toEqual({ node: step('Контакты', 'email') });
  });
});
