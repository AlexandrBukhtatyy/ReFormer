/**
 * Печать ответов guided кодом конструктора. Главное свойство — кругооборот: правка → строка кода
 * (`printEdit`) → прелюдия в QuickJS → `dslFormEdit` (лямбды → выражения) даёт ту же правку.
 * Иначе `Next:` вёл бы модель к коду, который делает не то, что сервер предложил.
 */

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { dslFormEdit } from '../src/core/codemode/dsl/host';
import { DSL_EPILOGUE, DSL_PRELUDE } from '../src/core/codemode/dsl/prelude';
import { asBuilderCalls, printEdit } from '../src/core/codemode/dsl/printer';
import type { ScriptFunction } from '../src/core/codemode/run-script';
import { OPTIONAL_STAGES, STAGE_ORDER, stageExample } from '../src/core/guided/plan';
import { createQuickJsSandbox } from '../src/platform/cli/quickjs-sandbox';

type Rec = Record<string, unknown>;

/** Исполнить код конструктора и вернуть правки, которые хост отправил бы в `form_edit`. */
async function roundTrip(code: string): Promise<{ dir?: unknown; edits: Rec[]; error?: string }> {
  let args: Rec | null = null;
  const formEdit: ScriptFunction = async (received) => {
    args = received as Rec;
    return 'ok';
  };
  const outcome = await createQuickJsSandbox().run(
    code,
    { formEdit },
    { prelude: DSL_PRELUDE, epilogue: DSL_EPILOGUE }
  );
  if (outcome.error) return { edits: [], error: outcome.error };
  if (args === null) return { edits: [] };
  const sent: Rec[] = [];
  const result = await dslFormEdit(
    args,
    async (_name, payload) => {
      sent.push(...(payload.edits as Rec[]));
      return { content: [{ type: 'text', text: 'form_edit: ok' }] };
    },
    ts
  );
  const text = result.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  return { dir: (args as Rec).dir, edits: sent, error: result.isError ? text : undefined };
}

const block = (lines: string[]) =>
  ['const f = reformer.form()', ...lines, 'await f.save()'].join('\n');

/** По образцу на каждую операцию `form_edit` и на каждую ветку печати. */
const SAMPLES: Rec[] = [
  { op: 'add_field', name: 'login', label: 'Логин' },
  {
    op: 'add_field',
    name: 'age',
    label: 'Возраст',
    type: 'number',
    step: 'Анкета',
    placeholder: '18+',
    initialValue: 18,
  },
  {
    op: 'add_field',
    name: 'method',
    label: 'Доставка',
    options: [
      { value: 'courier', label: 'Курьер' },
      { value: 'pickup', label: 'Самовывоз' },
    ],
    component: 'RadioGroup',
  },
  { op: 'set_field', name: 'phone', mask: '+7 (999) 999-99-99' },
  { op: 'set_field', name: 'total', readonly: true, label: 'Итого' },
  { op: 'set_field', array: 'items', name: 'price', type: 'number', initialValue: 0 },
  { op: 'rename_field', name: 'login', to: 'username' },
  { op: 'rename_field', name: 'login', to: 'username', label: 'Имя пользователя' },
  { op: 'remove_field', name: 'middleName' },
  { op: 'add_array', name: 'items', label: 'Товары' },
  { op: 'add_array', name: 'items', label: 'Товары', minItems: 1, maxItems: 5, step: 'Корзина' },
  { op: 'add_item_field', array: 'items', name: 'price', label: 'Цена', type: 'number' },
  { op: 'add_step', title: 'Контакты', fields: ['email', 'phone'] },
  { op: 'add_step', title: 'Упаковка', fields: ['giftWrap'], after: 'Товары' },
  { op: 'add_step', title: 'Упаковка', fields: ['giftWrap'], before: '4' },
  { op: 'add_array', name: 'items', label: 'Товары', minItems: 1 },
  { op: 'rename_step', title: 'Контакты', to: 'Связь' },
  { op: 'remove_step', title: '3' },
  { op: 'place', name: 'email', step: 'Контакты' },
  { op: 'add_rule', field: 'email', required: true, email: true, message: 'Введите email' },
  { op: 'add_rule', field: 'login', minLength: 3, maxLength: 20 },
  { op: 'add_rule', field: 'age', min: 18, max: 120, message: 'От 18 до 120' },
  { op: 'add_rule', field: 'password', pattern: '\\d', message: 'Нужна цифра' },
  { op: 'add_rule', field: 'login', pattern: '/^[a-z_]+$/i' },
  { op: 'add_rule', field: 'note', required: false },
  { op: 'add_rule', field: 'count', rule: 'integer()' },
  { op: 'add_rule', field: 'confirm', equals: 'password', message: 'Не совпадают' },
  {
    op: 'add_rule',
    field: 'endDate',
    cross: 'values.endDate >= values.startDate',
    message: 'Конец позже начала',
  },
  {
    op: 'add_rule',
    field: 'captcha',
    async: 'String(value).toUpperCase() === "ABC123"',
    delay: 300,
    message: 'Символы не совпадают',
  },
  {
    op: 'add_rule',
    field: 'address',
    required: true,
    when: "model.method === 'courier'",
  },
  { op: 'add_rule', field: 'price', array: 'items', required: true, min: 0 },
  { op: 'remove_rule', field: 'login', rule: 'pattern' },
  { op: 'remove_rule', field: 'login' },
  { op: 'add_behavior', kind: 'compute', target: 'total', expr: 'model.subtotal - model.discount' },
  {
    op: 'add_behavior',
    kind: 'compute',
    target: 'lineTotal',
    array: 'items',
    expr: 'item.price * item.quantity',
  },
  {
    op: 'add_behavior',
    kind: 'enableWhen',
    target: 'address',
    expr: "model.method === 'courier'",
    resetOnDisable: true,
  },
  { op: 'add_behavior', kind: 'disableWhen', target: 'company', expr: '!model.isCompany' },
  { op: 'add_behavior', kind: 'resetWhen', target: 'city', expr: 'model.country !== "RU"' },
  {
    op: 'add_behavior',
    kind: 'copyFrom',
    target: 'billing',
    sources: ['delivery'],
    expr: 'model.billingSame',
  },
  {
    op: 'add_rule',
    field: 'total',
    cross: 'values.total <= 100000',
    warning: true,
    message: 'Крупный заказ',
  },
  { op: 'add_rule', field: 'deliveryDate', rule: 'futureDate()', message: 'Не раньше завтра' },
  {
    op: 'add_behavior',
    kind: 'transformValue',
    target: 'promoCode',
    expr: "(value ?? '').toUpperCase()",
  },
  { op: 'add_behavior', kind: 'syncFields', target: 'receiptEmail', sources: ['email'] },
  { op: 'remove_behavior', target: 'total', kind: 'compute' },
  { op: 'remove_behavior', target: 'total' },
  { op: 'add_visibility', field: 'company', showWhen: "model.customerType === 'company'" },
  { op: 'add_visibility', field: 'inn', hideWhen: 'model.customerType === "person"' },
  { op: 'set_form', formName: 'Регистрация' },
  { op: 'submit', label: 'Зарегистрироваться' },
  { op: 'submit', label: 'Отправить', handler: 'sendForm' },
  { op: 'markup' },
];

describe('печать правок кодом конструктора', () => {
  it.each(SAMPLES.map((edit) => [printEdit(edit), edit] as const))(
    '%s — та же правка',
    async (printed, edit) => {
      const { edits, error } = await roundTrip(block([printed]));
      expect(error).toBeUndefined();
      expect(edits).toEqual([edit]);
    }
  );

  it('операции без метода конструктора — f.edit({…}), и это та же правка', async () => {
    const odd: Rec[] = [
      { op: 'add_behavior', kind: 'onChange', target: 'a', expr: 'if (model.a) model.b = 1;' },
      { op: 'add_behavior', kind: 'copyFrom', target: 'a', sources: ['b', 'c'] },
      { op: 'add_visibility', field: 'a', showWhen: 'model.x', hideWhen: 'model.y' },
      { op: 'add_field', name: 'a', label: 'A', unknownKey: 1 },
    ];
    for (const edit of odd) {
      const printed = printEdit(edit);
      expect(printed).toMatch(/^f\.edit\(/);
      expect((await roundTrip(block([printed]))).edits).toEqual([edit]);
    }
  });

  it('образцы этапов плана печатаются и возвращаются теми же правками', async () => {
    for (const target of ['core', 'renderer-react'] as const) {
      for (const stage of STAGE_ORDER) {
        const edits = JSON.parse(stageExample(stage, target)) as Rec[];
        const { edits: back, error } = await roundTrip(block(edits.map(printEdit)));
        expect(error, `${target}/${stage}`).toBeUndefined();
        expect(back, `${target}/${stage}`).toEqual(edits);
      }
    }
    expect(OPTIONAL_STAGES.length).toBeGreaterThan(0);
  });

  it('заглушка выражения остаётся строкой: её не исполнить как стрелку', () => {
    expect(
      printEdit({ op: 'add_behavior', kind: 'compute', target: '<field>', expr: '<the formula>' })
    ).toBe('f.field("<field>").compute("<the formula>")');
    expect(printEdit({ op: 'add_visibility', field: 'a', showWhen: 'model.b === 1' })).toBe(
      'f.field("a").showWhen(m => m.b === 1)'
    );
    expect(
      printEdit({ op: 'add_rule', field: 'a', cross: 'values.a > values.b', message: 'm' })
    ).toBe('f.field("a").check(v => v.a > v.b, "m")');
  });
});

describe('asBuilderCalls — ответ guided на языке конструктора', () => {
  it('form_edit в Next: → блок кода; второй блок того же ответа не объявляет f заново', () => {
    const text = [
      'Next: form_edit {"dir":"form","edits":[{"op":"add_rule","field":"email","required":true}]}',
      'Or: form_edit {"dir":"form","edits":[{"op":"markup"}]}',
    ].join('\n');
    expect(asBuilderCalls(text)).toBe(
      [
        'Next: const f = reformer.form()',
        'f.field("email").required()',
        'console.log(await f.save())',
        'Or: f.markup()',
        'console.log(await f.save())',
      ].join('\n')
    );
  });

  it('каталог формы, form_status и form_build', () => {
    expect(asBuilderCalls('Next: form_edit {"dir":"forms/a","edits":[{"op":"markup"}]}')).toMatch(
      /^Next: const f = reformer\.form\(\{ dir: "forms\/a" \}\)\nf\.markup\(\)/
    );
    expect(asBuilderCalls('Next: form_status {"dir":"form","confirm":"validation"}')).toBe(
      'Next: console.log(await reformer.form().confirm("validation"))'
    );
    expect(asBuilderCalls('Next: form_status {"dir":"form","skip":"behavior"}')).toBe(
      'Next: console.log(await reformer.form().skip("behavior"))'
    );
    expect(asBuilderCalls('Next: form_status {"dir":"form","add":"arrays"}')).toBe(
      'Next: console.log(await reformer.form().addStage("arrays"))'
    );
    expect(asBuilderCalls('Next: form_status {"dir":"form"}')).toBe(
      'Next: console.log(await reformer.form().status())'
    );
    expect(asBuilderCalls('Next: form_build {"dir":"form"}')).toBe(
      'Next: console.log(await reformer.form().build())'
    );
    expect(asBuilderCalls('Next: form_edit {"dir":"form","edits":[]}')).toBe(
      'Next: console.log(await reformer.form().save())'
    );
  });

  it('пояснения: правка JSON и ключи — методами; строки исходов не трогаются', () => {
    expect(
      asBuilderCalls('- the button is not an input: use {"op":"submit","label":"<its text>"}')
    ).toBe('- the button is not an input: use f.submit("<its text>")');
    expect(asBuilderCalls('choices go to "options", a computed field gets "readonly":true')).toBe(
      'choices go to .options(), a computed field gets .readonly()'
    );
    expect(asBuilderCalls('add a check with add_rule, then call form_edit again')).toBe(
      'add a check with a check (.required(), .min(), .pattern()…), then call execute again'
    );
    const kept = [
      'form_edit: 2 of 3 edits applied.',
      '- ✓ add_field: phone',
      '- ✗ edit 3 add_rule: "options" is not a rule key',
    ].join('\n');
    expect(asBuilderCalls(kept)).toBe(kept);
  });
});
