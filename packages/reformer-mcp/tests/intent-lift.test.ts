/**
 * Записи intent, которые `readIntent` читал как ссылки и молча терял.
 *
 * Зачем. Поле, описанное прямо в шаге или узле разметки, проверки на самом поле, сокращение
 * `steps` и `type: "Select"` терялись без отказа: `form_build` отвечал ✓ на форме без полей, без
 * шагов или с `Input` вместо выбора (ReFormer-j356.5, пробник на рабочем сервере 2026-11-04).
 * Смысл этих записей однозначен, поэтому они читаются в каноническую форму с предупреждением, а
 * запись без имени — отказ.
 */

import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { buildBundle } from '../src/core/generate/builders';
import { crossCheckBundle, inspectLayoutRefs } from '../src/core/generate/cross-check';
import { readIntent, type LayoutNode } from '../src/core/generate/form-intent';

const notes = (warnings: readonly string[]) => warnings.join('\n');

/** Шаги корня мастера: заголовок и ссылки детей. */
function stepsOf(root: LayoutNode): Array<{ title: string; refs: string[] }> {
  if (root.kind !== 'container') return [];
  return root.children
    .filter((node): node is Extract<LayoutNode, { kind: 'step' }> => node.kind === 'step')
    .map((step) => ({
      title: step.title,
      refs: step.children.map((child) => ('ref' in child ? child.ref : child.kind)),
    }));
}

/** Собирается без ошибок кросс-проверки, и каждое поле стоит в раскладке. */
function expectBuilds(raw: unknown): void {
  const { intent, problems } = readIntent(raw);
  expect(problems).toEqual([]);
  const { layoutJson } = buildBundle(intent, CATALOGS);
  const report = crossCheckBundle(intent, JSON.parse(layoutJson));
  expect(report.errors).toEqual([]);
  const { placed } = inspectLayoutRefs(intent);
  for (const entity of [...intent.fields, ...intent.arrays]) {
    expect(placed.has(entity.modelPath ?? entity.name), entity.name).toBe(true);
  }
}

describe('readIntent: поле, описанное на месте', () => {
  it('поля в шагах объявляются в fields, в шаге остаётся имя', () => {
    const raw = {
      formName: 'Заявка',
      steps: [
        { title: 'Клиент', fields: [{ name: 'fullName', component: 'Input', label: 'ФИО' }] },
        { title: 'Заказ', fields: [{ name: 'amount', type: 'number', label: 'Сумма' }] },
      ],
    };
    const { intent, problems } = readIntent(raw);
    expect(problems).toEqual([]);
    expect(intent.fields.map((f) => [f.name, f.component, f.label])).toEqual([
      ['fullName', 'Input', 'ФИО'],
      ['amount', 'InputNumber', 'Сумма'],
    ]);
    expect(stepsOf(intent.layoutRoot)).toEqual([
      { title: 'Клиент', refs: ['fullName'] },
      { title: 'Заказ', refs: ['amount'] },
    ]);
    expect(notes(intent.warnings)).toContain('declared in `fields`: `fullName`, `amount`');
    expectBuilds(raw);
  });

  it('узел разметки с описанием поля и голое имя — ссылки на поле', () => {
    const raw = {
      formName: 'Анкета',
      fields: [{ name: 'city', component: 'Input', label: 'Город' }],
      layoutRoot: {
        kind: 'container',
        component: 'Box',
        children: [
          { kind: 'field', name: 'email', component: 'Input', label: 'Почта' },
          { name: 'city' },
        ],
      },
    };
    const { intent } = readIntent(raw);
    expect(intent.fields.map((f) => f.name)).toEqual(['city', 'email']);
    const root = intent.layoutRoot as Extract<LayoutNode, { kind: 'container' }>;
    expect(root.children).toEqual([
      { kind: 'field', ref: 'email' },
      { kind: 'field', ref: 'city' },
    ]);
    expect(notes(intent.warnings)).toContain('read as field references');
    expectBuilds(raw);
  });

  it('объявленное в fields побеждает описание в шаге', () => {
    const { intent } = readIntent({
      fields: [{ name: 'city', component: 'Select', label: 'Город' }],
      steps: [{ title: 'Адрес', fields: [{ name: 'city', component: 'Input', label: 'Другое' }] }],
    });
    expect(intent.fields).toHaveLength(1);
    expect(intent.fields[0]).toMatchObject({ component: 'Select', label: 'Город' });
  });

  it('массив, описанный в шаге, объявляется в arrays со строками', () => {
    const raw = {
      formName: 'Анкета',
      steps: [
        {
          title: 'Дети',
          fields: [{ name: 'children', type: 'array', fields: [{ name: 'age', type: 'number' }] }],
        },
      ],
    };
    const { intent } = readIntent(raw);
    expect(intent.arrays.map((a) => [a.name, a.itemFields.map((f) => f.name)])).toEqual([
      ['children', ['age']],
    ]);
    expect(stepsOf(intent.layoutRoot)).toEqual([{ title: 'Дети', refs: ['children'] }]);
  });

  it('поле шага и узел-описание без имени — отказ, а не пустой шаг', () => {
    const inStep = readIntent({ steps: [{ title: 'A', fields: [{ component: 'Input' }] }] });
    expect(inStep.problems.map((p) => p.at)).toEqual(['steps[0].fields[0]']);
    const inLayout = readIntent({
      layoutRoot: { kind: 'container', children: [{ component: 'Input', label: 'Почта' }] },
    });
    expect(inLayout.problems.map((p) => p.at)).toEqual(['layoutRoot.children[0]']);
  });
});

describe('readIntent: формы записи шагов и раскладки', () => {
  it('сокращение steps строит корень мастера, поле вне шагов остаётся неразмещённым', () => {
    const { intent } = readIntent({
      fields: [
        { name: 'a', component: 'Input' },
        { name: 'b', component: 'Input' },
        { name: 'c', component: 'Input' },
      ],
      steps: [
        { title: 'Первый', fields: ['a'] },
        { title: 'Второй', fields: ['b'] },
      ],
    });
    expect(intent.layoutRoot).toMatchObject({ kind: 'container', selector: 'wizard' });
    expect(stepsOf(intent.layoutRoot)).toEqual([
      { title: 'Первый', refs: ['a'] },
      { title: 'Второй', refs: ['b'] },
    ]);
    expect(inspectLayoutRefs(intent).placed.has('c')).toBe(false);
  });

  it('своя раскладка побеждает сокращение steps', () => {
    const { intent } = readIntent({
      fields: [{ name: 'a', component: 'Input' }],
      steps: [{ title: 'Шаг', fields: ['a'] }],
      layoutRoot: { kind: 'container', component: 'Box', children: ['a'] },
    });
    expect(stepsOf(intent.layoutRoot)).toEqual([]);
  });

  it('шаг ключом step, steps объектом и intent-узел шага читаются одним шагом', () => {
    const field = { name: 'a', component: 'Input', label: 'A' };
    for (const raw of [
      { step: { title: 'Один', fields: [field] } },
      { steps: { title: 'Один', fields: [field] } },
      { kind: 'step', title: 'Один', children: [field] },
    ]) {
      const { intent, problems } = readIntent(raw);
      expect(problems).toEqual([]);
      expect(intent.fields.map((f) => f.name)).toEqual(['a']);
      expect(stepsOf(intent.layoutRoot)).toEqual([{ title: 'Один', refs: ['a'] }]);
    }
  });

  it('раскладка списком — дети корневого контейнера', () => {
    const { intent } = readIntent({
      fields: [{ name: 'a', component: 'Input' }],
      layoutRoot: ['a'],
    });
    expect(intent.layoutRoot).toEqual({
      kind: 'container',
      component: 'Box',
      children: [{ kind: 'field', ref: 'a' }],
    });
  });
});

describe('readIntent: проверки в списке полей', () => {
  it('правило среди fields уходит в validation, а не объявляет поле второй раз', () => {
    const { intent, problems } = readIntent({
      fields: [
        { name: 'email', component: 'Input', label: 'Почта' },
        { field: 'email', rules: ['required()', 'email()'] },
      ],
    });
    expect(problems).toEqual([]);
    expect(intent.fields.map((f) => f.name)).toEqual(['email']);
    expect(intent.validation).toEqual([{ target: 'email', rules: ['required()', 'email()'] }]);
    expect(notes(intent.warnings)).toContain('moved to `validation`');
  });

  it('проверки на самом поле и на поле строки массива — записи validation', () => {
    const { intent, problems } = readIntent({
      fields: [
        {
          name: 'age',
          component: 'InputNumber',
          rules: ['min(18)'],
          message: 'Только взрослые',
        },
      ],
      arrays: [
        {
          name: 'phones',
          itemFields: [{ name: 'number', component: 'Input', rules: ['required()'] }],
        },
      ],
    });
    expect(problems).toEqual([]);
    expect(intent.validation).toEqual([
      { target: 'age', rules: ['min(18)'], message: 'Только взрослые' },
      { target: 'number', each: 'phones', rules: ['required()'] },
    ]);
    expect(intent.fields[0]).not.toHaveProperty('rules');
  });

  it('второе объявление того же пути — отказ с местом первого', () => {
    const { problems } = readIntent({
      fields: [
        { name: 'email', component: 'Input' },
        { name: 'email', component: 'Input', label: 'Ещё раз' },
      ],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ at: 'fields[1]' });
    expect(problems[0].message).toContain('fields[0]');
  });
});

describe('readIntent: тип, который на деле компонент', () => {
  it('type: "Select" — компонент Select, тип значения string', () => {
    const { intent } = readIntent(
      {
        fields: [{ name: 'city', type: 'Select', label: 'Город', options: [{ value: 'msk' }] }],
      },
      { uiKit: CATALOGS.uiKit }
    );
    expect(intent.fields[0]).toMatchObject({ component: 'Select', type: 'string' });
    expect(notes(intent.warnings)).toContain('is a component name — read as component `Select`');
  });

  it('тип значения берётся из компонента; явный component побеждает type', () => {
    const { intent } = readIntent(
      {
        fields: [
          { name: 'agree', type: 'switch' },
          { name: 'tags', type: 'SelectMulti' },
          { name: 'note', type: 'Textarea' },
          { name: 'city', type: 'select', component: 'Combobox' },
        ],
      },
      { uiKit: CATALOGS.uiKit }
    );
    expect(intent.fields.map((f) => [f.name, f.component, f.type])).toEqual([
      ['agree', 'Switch', 'boolean'],
      ['tags', 'SelectMulti', 'array'],
      ['note', 'Textarea', 'string'],
      ['city', 'Combobox', 'string'],
    ]);
  });
});

describe('readIntent: подсказки из справочника [ReFormer-3yx2]', () => {
  const raw = {
    formName: 'Доставка',
    fields: [{ name: 'city', type: 'string', label: 'Город', suggestionsSource: 'CITIES' }],
    dataSources: [{ name: 'CITIES', values: ['Москва', 'Казань'] }],
  };

  it('suggestionsSource — InputSuggest и $dataSource в пропе suggestions', () => {
    const { intent, problems } = readIntent(raw);
    expect(problems).toEqual([]);
    expect(intent.fields[0]).toMatchObject({
      component: 'InputSuggest',
      suggestionsSource: 'CITIES',
    });
    expect(intent.fields[0].componentProps?.suggestions).toBeUndefined();
    const { layoutJson } = buildBundle(intent, CATALOGS);
    expect(layoutJson).toContain('"suggestions": "$dataSource(CITIES)"');
    expect(crossCheckBundle(intent, JSON.parse(layoutJson)).errors).toEqual([]);
  });

  it('подсказки списком — готовые значения в пропсах; справочник без объявления — C3', () => {
    const inline = readIntent({
      fields: [{ name: 'city', component: 'Input', suggestions: ['Москва'] }],
    }).intent;
    expect(inline.fields[0]).toMatchObject({
      component: 'InputSuggest',
      componentProps: { suggestions: ['Москва'] },
    });
    const { intent } = readIntent({ ...raw, dataSources: [] });
    const { layoutJson } = buildBundle(intent, CATALOGS);
    const codes = crossCheckBundle(intent, JSON.parse(layoutJson)).errors.map((e) => e.code);
    expect(codes).toContain('C3');
  });
});

describe('readIntent: значок шага [ReFormer-j356.4.21: A19]', () => {
  it('icon шага — из сокращения steps и из узла step — доходит до componentProps шага', () => {
    for (const raw of [
      {
        fields: [{ name: 'a', component: 'Input' }],
        steps: [{ title: 'Кредит', icon: '💰', fields: ['a'] }],
      },
      {
        fields: [{ name: 'a', component: 'Input' }],
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [{ kind: 'step', title: 'Кредит', icon: '💰', children: ['a'] }],
        },
      },
    ]) {
      const { intent } = readIntent(raw);
      const { layoutJson } = buildBundle(intent, CATALOGS);
      const step = JSON.parse(layoutJson).root.children[0];
      expect(step.componentProps).toEqual({ title: 'Кредит', icon: '💰' });
    }
  });
});

/**
 * Записи, которые ассистент конструктора поднимал своим проходом (`build-form/lift.ts`) до
 * `readIntent`. Проход удалён (план — фаза 4): здесь закреплено, что чтение MCP разбирает каждую из
 * них само, — корпус тот же, что у теста паритета, которым проверялось удаление.
 */
describe('записи подъёма ассистента конструктора — читает сам readIntent', () => {
  const field = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    component: 'Input',
    label: name.toUpperCase(),
    ...extra,
  });
  const rows = [
    { name: 'type', component: 'Input', label: 'Type' },
    { name: 'value', component: 'InputNumber', label: 'Value' },
  ];
  const view = (raw: unknown) => {
    const { intent, problems, notices } = readIntent(raw, {
      forDocument: true,
      uiKit: CATALOGS.uiKit,
    });
    return {
      problems: problems.map((p) => `${p.code} at ${p.at}`),
      notices: notices.map((n) => n.code),
      fields: intent.fields.map((f) => `${f.modelPath ?? f.name}:${f.component}`),
      arrays: intent.arrays.map((a) => `${a.name}[${a.itemFields.map((f) => f.name).join(',')}]`),
      steps: (intent.wizard?.steps ?? []).map((s) => s.title),
      validation: intent.validation.map((v) => v.target),
    };
  };

  it.each<[string, unknown, string[]]>([
    ['поля в шаге', { steps: [{ title: 'One', fields: [field('a'), field('b')] }] }, ['a', 'b']],
    [
      'узлы-поля в разметке',
      {
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [{ kind: 'field', ...field('city') }, field('street')],
        },
      },
      ['city', 'street'],
    ],
    ['раскладка списком', { layoutRoot: [field('a')] }, ['a']],
    [
      'intent — узел шага',
      { kind: 'step', title: 'Delivery', children: [field('city')] },
      ['city'],
    ],
    ['intent — узел-контейнер', { children: [field('a')] }, ['a']],
    ['шаг ключом step', { step: { title: 'Delivery', fields: [field('city')] } }, ['city']],
    ['steps объектом', { steps: { title: 'Delivery', fields: [field('city')] } }, ['city']],
    [
      'поле шага по пути модели',
      { step: { title: 'D', fields: [{ label: 'City', model: 'delivery.city', type: 'text' }] } },
      ['delivery.city'],
    ],
    ['ключ wizard', { wizard: { steps: [{ title: 'A', fields: [field('a')] }] } }, ['a']],
    [
      'имя полем path',
      { steps: [{ title: 'A', fields: [{ path: 'x.y', component: 'Input' }] }] },
      ['x.y'],
    ],
    [
      'имя полем ref',
      { steps: [{ title: 'A', fields: [{ ref: 'z', component: 'Input' }] }] },
      ['z'],
    ],
    [
      'имя полем binding',
      { steps: [{ title: 'A', fields: [{ binding: 'w', component: 'Input' }] }] },
      ['w'],
    ],
    ['список шага items', { steps: [{ title: 'A', items: [field('a')] }] }, ['a']],
    ['шаги ключом pages', { pages: [{ title: 'A', fields: [field('a')] }] }, ['a']],
    [
      'раскладка ключом tree',
      { tree: { kind: 'container', component: 'Box', children: [field('a')] } },
      ['a'],
    ],
    [
      'дети ключом nodes',
      { layoutRoot: { kind: 'container', component: 'Box', nodes: [field('a')] } },
      ['a'],
    ],
    [
      'вложенный список детей',
      { layoutRoot: { kind: 'container', component: 'Box', children: [[field('a'), field('b')]] } },
      ['a', 'b'],
    ],
  ])('%s', (_name, raw, paths) => {
    const read = view(raw);
    expect(read.problems).toEqual([]);
    expect(read.fields.map((f) => f.split(':')[0])).toEqual(paths);
  });

  it('тип-компонент и синонимы компонента', () => {
    const read = view({
      fields: [
        { name: 'note', type: 'textarea', label: 'Note' },
        { name: 'a', widget: 'Input', label: 'A' },
        { name: 'b', componentName: 'InputNumber', label: 'B' },
      ],
    });
    expect(read.problems).toEqual([]);
    expect(read.fields).toEqual(['note:Textarea', 'a:Input', 'b:InputNumber']);
  });

  it('массив полем и массив в шаге — массивы со строками', () => {
    for (const raw of [
      {
        fields: [{ name: 'items', type: 'array', label: 'Items', itemFields: rows }],
        steps: [{ title: 'A', fields: ['items'] }],
      },
      {
        steps: [
          { title: 'A', fields: [{ name: 'items', type: 'array', label: 'Items', fields: rows }] },
        ],
      },
    ]) {
      const read = view(raw);
      expect(read.problems).toEqual([]);
      expect(read.arrays).toEqual(['items[type,value]']);
    }
  });

  it('правило среди полей — в validation; голое имя в разметке — ссылка', () => {
    expect(
      view({ fields: [field('phone'), { target: 'phone', rules: ['required'] }] })
    ).toMatchObject({
      problems: [],
      fields: ['phone:Input'],
      validation: ['phone'],
    });
    const bare = view({
      fields: [field('city'), field('same')],
      layoutRoot: [{ kind: 'container', component: 'Box', children: ['city'] }, { name: 'same' }],
    });
    expect(bare.problems).toEqual([]);
  });

  it('правило без проверок ("rules": []) отбрасывается с предупреждением, а не валит intent', () => {
    const read = view({
      fields: [field('phone'), field('phone2')],
      validation: [
        { target: 'phone', rules: ['required'] },
        { target: 'phone2', rules: [] },
      ],
    });
    expect(read.problems).toEqual([]);
    expect(read.validation).toEqual(['phone']);
    expect(read.notices).toContain('rule-empty-dropped');
    // Ключа нет вовсе — запись битая: это по-прежнему отказ.
    expect(view({ fields: [field('a')], validation: [{ target: 'a' }] }).problems).toEqual([
      'missing-key at validation[0].rules',
    ]);
  });

  it('поле шага без имени и описание на месте против объявления — отказы, а не молчаливый выбор', () => {
    expect(
      view({ steps: [{ title: 'A', fields: [{ label: 'City', component: 'Input' }] }] }).problems
    ).toEqual(['missing-key at steps[0].fields[0]']);
    expect(
      view({
        fields: [field('a', { label: 'Declared' })],
        steps: [{ title: 'One', fields: [field('a', { label: 'Inline' })] }],
      }).problems
    ).toEqual(['key-conflict at steps[0].fields[0].label']);
  });
});
