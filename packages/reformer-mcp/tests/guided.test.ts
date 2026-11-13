/**
 * Профиль guided: признаки задачи, план, плоские правки и сквозной путь form_start → form_edit →
 * «Done» настоящей сборкой (с проверкой типов: разметку core, которую пишет сервер, должен принять
 * компилятор).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { applyEdits, type EditContext } from '../src/core/guided/edits';
import { featuresFromText } from '../src/core/guided/features';
import { MARKUP_MARK } from '../src/core/guided/markup';
import { stageExample, stagesFor } from '../src/core/guided/plan';
import { readIntent } from '../src/core/generate/form-intent';
import type { Knowledge } from '../src/core/knowledge';
import { formEditTool, formStartTool, formStatusTool } from '../src/core/tools/guided';
import { createCliFormWorkspace, TYPECHECK_ROOT_ENV } from '../src/platform/cli/form-workspace';
import { cliKnowledge } from '../src/platform/cli/knowledge';

const repoRoot = resolve(__dirname, '../../..');
const SLOW = 180_000;

const ctx = (target: EditContext['target'] = 'renderer-react'): EditContext => ({
  uiKit: CATALOGS.uiKit,
  rules: new Set(CATALOGS.core.rules.keys()),
  target,
});
type Rec = Record<string, unknown>;
const fields = (file: Rec) => file.fields as Rec[];

describe('признаки задачи и этапы', () => {
  it('слова задания дают этапы; разметка — только на core', () => {
    const features = featuresFromText(
      'Форма заказа: цена, количество, скидка от 0 до 50 %. Итог считается автоматически.'
    );
    expect(features).toMatchObject({
      validation: true,
      behavior: true,
      arrays: false,
      wizard: false,
    });
    expect(stagesFor(features, 'core')).toEqual(['fields', 'validation', 'behavior', 'markup']);
    expect(
      stagesFor(featuresFromText('Мастер из трёх шагов, список контактов'), 'renderer-react')
    ).toEqual(['fields', 'arrays', 'wizard']);
  });
});

describe('плоские правки', () => {
  it('поле: компонент по типу и вариантам, свойства — из плоских ключей', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'email', label: 'Email', placeholder: 'you@mail' },
        { op: 'add_field', name: 'age', type: 'number', label: 'Age' },
        {
          op: 'add_field',
          name: 'city',
          label: 'City',
          options: ['Moscow', { value: 'kzn', label: 'Kazan' }],
        },
        { op: 'add_field', name: 'total', type: 'number', readonly: true },
        { op: 'add_field', name: 'phone', mask: '+7 (999) 999-99-99' },
      ],
      ctx()
    );
    expect(outcomes.every((o) => o.ok)).toBe(true);
    const [email, age, city, total, phone] = fields(file);
    expect(email).toMatchObject({
      component: 'Input',
      initialValue: '',
      componentProps: { placeholder: 'you@mail' },
    });
    expect(age).toMatchObject({ component: 'InputNumber', initialValue: null });
    expect(city).toMatchObject({
      component: 'Select',
      componentProps: {
        options: [
          { value: 'Moscow', label: 'Moscow' },
          { value: 'kzn', label: 'Kazan' },
        ],
      },
    });
    expect(total.componentProps).toEqual({ readOnly: true });
    expect(phone).toMatchObject({
      component: 'InputMask',
      componentProps: { mask: '+7 (999) 999-99-99' },
    });
    expect((file.layoutRoot as Rec).children).toEqual(['email', 'age', 'city', 'total', 'phone']);
  });

  it('отказ называет, что исправить, а остальные правки вызова применяются', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'email' },
        { op: 'add_field', name: 'email' },
        { op: 'add_field', name: 'name', component: 'TextInput' },
        { op: 'add_rule', field: 'emial', required: true },
        { op: 'add_fild', name: 'x' },
        { op: 'add_field', name: 'имя' },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, false, false, false, false, false]);
    expect(outcomes[1].message).toMatch(/already exists/);
    expect(outcomes[2].message).toMatch(/did you mean/);
    expect(outcomes[3].message).toMatch(/did you mean `email`/);
    expect(outcomes[4].message).toMatch(/did you mean `add_field`/);
    expect(outcomes[5].message).toMatch(/latin camelCase/);
    expect(fields(file)).toHaveLength(1);
  });

  it('правило: флаги и числа — валидаторами, при тексте — коды; неизвестный валидатор — отказ', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'age', type: 'number' },
        {
          op: 'add_rule',
          field: 'age',
          required: true,
          min: 18,
          max: 120,
          message: 'Age 18 to 120',
        },
        { op: 'add_rule', field: 'age', rule: 'between(1, 2)' },
        { op: 'add_rule', field: 'age', required: true, when: 'model.age !== null' },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, false, true]);
    expect(outcomes[2].message).toMatch(/no validator `between`/);
    const [coded, conditional] = file.validation as Rec[];
    expect(coded).toEqual({
      target: 'age',
      rules: [
        "required({ code: 'age.required' })",
        "min(18, { code: 'age.min' })",
        "max(120, { code: 'age.max' })",
      ],
      message: 'Age 18 to 120',
    });
    expect(conditional).toEqual({
      target: 'age',
      when: 'model.age !== null',
      rules: ['required()'],
    });
  });

  it('поведение: источники — из выражения, compute не читает сам себя', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'price', type: 'number' },
        { op: 'add_field', name: 'quantity', type: 'number' },
        { op: 'add_field', name: 'total', type: 'number', readonly: true },
        {
          op: 'add_behavior',
          kind: 'compute',
          target: 'total',
          expr: '(model.price ?? 0) * (model.quantity ?? 0) + model.total * 0',
        },
        {
          op: 'add_behavior',
          kind: 'enableWhen',
          target: 'total',
          expr: 'model.price > 0',
          resetOnDisable: true,
        },
        { op: 'add_behavior', kind: 'hideWhen', target: 'total', expr: 'true' },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, true, true, false]);
    expect(outcomes[5].message).toMatch(/add_visibility/);
    const [compute, enable] = file.behavior as Rec[];
    expect(compute.sources).toEqual(['price', 'quantity']);
    expect(enable).toMatchObject({ sources: ['price'], options: { resetOnDisable: true } });
  });

  it('видимость: showWhen — отрицанием условия скрытия; на core — отказ с маршрутом', () => {
    const edits = [
      { op: 'add_field', name: 'method' },
      { op: 'add_field', name: 'address' },
      { op: 'add_visibility', field: 'address', showWhen: "model.method === 'delivery'" },
    ];
    expect(applyEdits({}, edits, ctx()).file.visibility).toEqual([
      { selector: 'address', condition: "!(model.method === 'delivery')" },
    ]);
    expect(applyEdits({}, edits, ctx('core')).outcomes[2].message).toMatch(/enableWhen/);
  });

  it('массив: строки по минимуму, ключ нового поля строки — в начальных строках', () => {
    const { file } = applyEdits(
      {},
      [
        { op: 'add_array', name: 'contacts', label: 'Contacts', minItems: 1, maxItems: 5 },
        { op: 'add_item_field', array: 'contacts', name: 'phone', label: 'Phone' },
        { op: 'add_rule', field: 'phone', array: 'contacts', required: true },
      ],
      ctx()
    );
    const [contacts] = file.arrays as Rec[];
    expect(contacts).toMatchObject({
      itemInterfaceName: 'ContactsItem',
      initialValue: [{ phone: '' }],
      componentProps: { title: 'Contacts', addButtonLabel: '+ Contacts', minItems: 1, maxItems: 5 },
    });
    expect(file.validation).toEqual([
      { target: 'contacts.phone', each: 'contacts', rules: ['required()'] },
    ]);
    expect((file.layoutRoot as Rec).children).toEqual([{ kind: 'array', ref: 'contacts' }]);
  });

  it('шаги: первый забирает всё из корня, следующие — свои поля; новое поле — в последний шаг', () => {
    const { file } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'a' },
        { op: 'add_field', name: 'b' },
        { op: 'add_field', name: 'c' },
        { op: 'add_step', title: 'One', fields: ['a'] },
        { op: 'add_step', title: 'Two', fields: ['c'] },
        { op: 'add_field', name: 'd' },
        { op: 'place', name: 'b', step: '2' },
      ],
      ctx()
    );
    expect(file.layoutRoot).toBeUndefined();
    expect(file.steps).toEqual([
      { title: 'One', fields: ['a'] },
      { title: 'Two', fields: ['c', 'd', 'b'] },
    ]);
  });

  it('удаление поля уносит его правила', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'a' },
        { op: 'add_rule', field: 'a', required: true },
        { op: 'remove_field', name: 'a' },
      ],
      ctx()
    );
    expect(outcomes[2].message).toMatch(/with 1 rules/);
    expect(file.fields).toEqual([]);
    expect(file.validation).toEqual([]);
  });
});

describe('пример следующего шага', () => {
  it('строится на полях формы: правила, вычисление, условие по первому варианту выбора', () => {
    const { intent } = readIntent({
      target: 'renderer-react',
      fields: [
        {
          name: 'method',
          type: 'string',
          component: 'Select',
          componentProps: { options: [{ value: 'courier', label: 'Курьер' }] },
        },
        { name: 'address', type: 'string', component: 'Input' },
        { name: 'price', type: 'number', component: 'InputNumber' },
        {
          name: 'total',
          type: 'number',
          component: 'InputNumber',
          componentProps: { readOnly: true },
        },
      ],
    });
    expect(JSON.parse(stageExample('validation', 'renderer-react', intent))).toEqual([
      { op: 'add_rule', field: 'method', required: true },
      { op: 'add_rule', field: 'address', required: true },
    ]);
    expect(JSON.parse(stageExample('behavior', 'renderer-react', intent))).toEqual([
      { op: 'add_behavior', kind: 'compute', target: 'total', expr: '(model.price ?? 0)' },
      { op: 'add_visibility', field: 'address', showWhen: "model.method === 'courier'" },
    ]);
    expect(stageExample('behavior', 'core', intent)).toContain(
      '"kind":"enableWhen","target":"address"'
    );
  });
});

describe('поверхность guided', () => {
  it('четыре инструмента, справочных нет', () => {
    const catalog = createToolCatalog(() => cliKnowledge(), { profile: 'node', guided: true });
    expect(catalog.list().map((tool) => tool.name)).toEqual([
      'form_start',
      'form_edit',
      'form_status',
      'form_build',
    ]);
  });
});

describe('сквозной путь', () => {
  let project: string;
  let knowledge: Knowledge;
  const previousRoot = process.env[TYPECHECK_ROOT_ENV];
  const text = (result: { content: Array<{ text: string }> }) => result.content[0].text;
  const file = (name: string) => readFileSync(join(project, 'form', name), 'utf8');

  beforeAll(() => {
    process.env[TYPECHECK_ROOT_ENV] = repoRoot;
  });
  afterAll(() => {
    if (previousRoot === undefined) delete process.env[TYPECHECK_ROOT_ENV];
    else process.env[TYPECHECK_ROOT_ENV] = previousRoot;
  });
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'guided-'));
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({ name: 'consumer', dependencies: { '@reformer/core': '*' } })
    );
    knowledge = { ...cliKnowledge(), forms: createCliFormWorkspace(project) };
  });
  afterEach(() => rmSync(project, { recursive: true, force: true }));

  it('без плана form_edit ведёт к form_start', async () => {
    const result = await formEditTool({ dir: 'form', edits: [] }, knowledge);
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/Next: form_start/);
  });

  it(
    'renderer-react: поля → правила → Done; лишний этап пропускается',
    async () => {
      const start = await formStartTool(
        {
          dir: 'form',
          target: 'renderer-react',
          task: 'Обратная связь: имя и email, оба обязательны. Итог не нужен.',
        },
        knowledge
      );
      expect(text(start)).toMatch(/1\. fields/);
      expect(text(start)).toMatch(/Next — fields/);

      const first = await formEditTool(
        {
          dir: 'form',
          edits: [
            { op: 'add_field', name: 'name', label: 'Имя' },
            { op: 'add_field', name: 'email', label: 'Email' },
          ],
        },
        knowledge
      );
      expect(text(first)).toMatch(/✓ form_build: written/);
      expect(text(first)).toMatch(/Next — validation/);

      const second = await formEditTool(
        {
          dir: 'form',
          edits: [
            { op: 'add_rule', field: 'name', required: true, message: 'Введите имя' },
            {
              op: 'add_rule',
              field: 'email',
              required: true,
              email: true,
              message: 'Введите email',
            },
          ],
        },
        knowledge
      );
      expect(second.isError).toBeUndefined();
      // Слово «Итог» дало этап behavior: модель его пропускает, и план завершается.
      const status = await formStatusTool({ dir: 'form', skip: 'behavior' }, knowledge);
      expect(text(status)).toMatch(/Done: the form is built/);
      expect(JSON.parse(file('form.intent.json')).target).toBe('renderer-react');
    },
    SLOW
  );

  it(
    'core: массив, шаги, вычисление и разметка сервера проходят проверку типов',
    async () => {
      await formStartTool(
        {
          dir: 'form',
          target: 'core',
          task: 'Заказ из двух шагов: позиции списком, итог считается автоматически',
        },
        knowledge
      );
      const built = await formEditTool(
        {
          dir: 'form',
          edits: [
            { op: 'add_field', name: 'customer', label: 'Покупатель' },
            { op: 'add_field', name: 'price', type: 'number', label: 'Цена' },
            { op: 'add_field', name: 'quantity', type: 'number', label: 'Количество' },
            { op: 'add_field', name: 'total', type: 'number', label: 'Итого', readonly: true },
            { op: 'add_array', name: 'items', label: 'Позиции', minItems: 1 },
            { op: 'add_item_field', array: 'items', name: 'title', label: 'Название' },
            { op: 'add_step', title: 'Покупатель', fields: ['customer'] },
            { op: 'add_step', title: 'Заказ', fields: ['price', 'quantity', 'total', 'items'] },
            { op: 'add_rule', field: 'customer', required: true, message: 'Укажите покупателя' },
            {
              op: 'add_behavior',
              kind: 'compute',
              target: 'total',
              expr: '(model.price ?? 0) * (model.quantity ?? 0)',
            },
            { op: 'markup' },
          ],
        },
        knowledge
      );
      const answer = text(built);
      expect(answer).toMatch(/11 of 11 edits applied/);
      expect(answer).toMatch(/Types checked, no errors\./);
      expect(answer).toMatch(/Done: the form is built/);
      const index = file('index.tsx');
      expect(index).toContain(MARKUP_MARK);
      expect(index).toContain('<FieldArraySection control={bundle.form.items}');
      expect(index).toContain('<Section title="Заказ">');

      // Новое поле на core появляется в разметке сервера без повторного markup.
      await formEditTool(
        { dir: 'form', edits: [{ op: 'add_field', name: 'comment', label: 'Комментарий' }] },
        knowledge
      );
      expect(file('index.tsx')).toContain('bundle.form.comment');
    },
    SLOW
  );

  it(
    'стек — из плана: чужой target в intent возвращается к плану',
    async () => {
      await formStartTool({ dir: 'form', target: 'core', task: 'Вход: логин и пароль' }, knowledge);
      writeFileSync(
        join(project, 'form', 'form.intent.json'),
        JSON.stringify({ formName: 'Вход', target: 'renderer-react', fields: [] })
      );
      const result = await formEditTool(
        { dir: 'form', edits: [{ op: 'add_field', name: 'login' }] },
        knowledge
      );
      expect(text(result)).toMatch(/target set back to core/);
      expect(JSON.parse(file('form.intent.json')).target).toBe('core');
    },
    SLOW
  );
});
