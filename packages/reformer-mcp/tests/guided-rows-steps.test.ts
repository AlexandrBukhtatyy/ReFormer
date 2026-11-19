/**
 * Дыры правок, найденные замером sonnet на code-guided-dsl (батчи 20261115T083423Z-ad6e,
 * 20261115T092608Z-48ed):
 *
 * - ReFormer-f2fs.29 — массив без строк: черновик по спеке терял «От 1 до 10 строк» и «одна пустая
 *   строка», а границы готового массива нельзя было задать ни `add_array`, ни `set_field`;
 * - ReFormer-f2fs.30 — правило условно активного поля оставалось безусловным, пересоздание поля
 *   молча теряло сброс, шаг нельзя было поставить между шагами.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { intentFromSpec } from '../src/core/generate/from-spec';
import { applyEdits, type EditContext } from '../src/core/guided/edits';
import { rowBounds, startRows } from '../src/core/spec/analyze';

type Rec = Record<string, unknown>;

const ctx = (target: EditContext['target'] = 'renderer-react'): EditContext => ({
  uiKit: CATALOGS.uiKit,
  rules: new Set(CATALOGS.core.rules.keys()),
  target,
});

const arrays = (file: Rec) => file.arrays as Rec[];
const messages = (outcomes: ReadonlyArray<{ ok: boolean; message: string }>) =>
  outcomes.map((outcome) => `${outcome.ok ? '✓' : '✗'} ${outcome.message}`);

/** Форма с массивом без границ — как черновик спеки до правки. */
const withRows = (): Rec =>
  applyEdits(
    {},
    [
      { op: 'add_array', name: 'items', label: 'Товары' },
      { op: 'add_item_field', array: 'items', name: 'title', label: 'Название' },
      { op: 'add_item_field', array: 'items', name: 'price', label: 'Цена', type: 'number' },
    ],
    ctx()
  ).file;

describe('строки массива (ReFormer-f2fs.29)', () => {
  it('границы и стартовые строки из ячеек спеки', () => {
    expect(rowBounds('От 1 до 10 строк. Поля строки — в таблице «Строка товара»')).toEqual({
      min: 1,
      max: 10,
    });
    expect(rowBounds('не меньше одной строки, не больше 5 позиций')).toEqual({ min: 1, max: 5 });
    expect(rowBounds('1 to 10 rows')).toEqual({ min: 1, max: 10 });
    expect(rowBounds('at least one row')).toEqual({ min: 1 });
    expect(rowBounds('Обязательное')).toEqual({});
    expect(startRows('одна пустая строка')).toBe(1);
    expect(startRows('одна строка, основной')).toBe(1);
    expect(startRows('две строки')).toBe(2);
    expect(startRows('`[]`')).toBe(0);
    expect(startRows('—')).toBeUndefined();
  });

  it('черновик спеки заказа начинает с одной строки товара и одной строки получателя', () => {
    const spec = readFileSync(resolve(__dirname, '../eval/scenarios/order/spec.md'), 'utf8');
    for (const target of ['core', 'renderer-react', 'renderer-json'] as const) {
      const intent = intentFromSpec(spec, target, CATALOGS.uiKit);
      const items = intent.arrays.find((array) => array.name === 'items')!;
      expect(items.componentProps).toMatchObject({ minItems: 1, maxItems: 10 });
      expect(items.initialValue).toHaveLength(1);
      expect(Object.keys(items.initialValue[0] as Rec)).toEqual(
        items.itemFields.map((field) => field.name)
      );
      const recipients = intent.arrays.find((array) => array.name === 'recipients')!;
      expect(recipients.componentProps).toMatchObject({ minItems: 1 });
      expect(recipients.initialValue).toHaveLength(1);
    }
  });

  it('add_array с именем готового массива меняет подпись и границы, строк — не меньше минимума', () => {
    const { file, outcomes } = applyEdits(
      withRows(),
      [{ op: 'add_array', name: 'items', label: 'Товары', minItems: 1, maxItems: 10 }],
      ctx()
    );
    expect(messages(outcomes)).toEqual([
      '✓ array `items` changed: at least 1 row, at most 10 rows; rule on `items`: minLength(1), maxLength(10) (the text of the task for it: add_rule with "message")',
    ]);
    expect(file.validation).toEqual([
      { target: 'items', rules: ["minLength(1, { code: 'items.minLength' })"] },
      { target: 'items', rules: ["maxLength(10, { code: 'items.maxLength' })"] },
    ]);
    const items = arrays(file)[0];
    expect(items.componentProps).toMatchObject({ title: 'Товары', minItems: 1, maxItems: 10 });
    expect(items.initialValue).toEqual([{ title: '', price: null }]);
  });

  it('set_field на массиве: min/max — границы строк, а не «is an array, not a field»', () => {
    const { file, outcomes } = applyEdits(
      withRows(),
      [{ op: 'set_field', name: 'items', min: 2, max: 5, label: 'Позиции' }],
      ctx()
    );
    expect(messages(outcomes)).toEqual([
      '✓ array `items` changed: label «Позиции», at least 2 rows, at most 5 rows; rule on `items`: minLength(2), maxLength(5) (the text of the task for it: add_rule with "message")',
    ]);
    expect(arrays(file)[0].initialValue).toHaveLength(2);
    expect(arrays(file)[0].componentProps).toMatchObject({ addButtonLabel: '+ Позиции' });
  });

  it('add_item_field с готовой колонкой меняет её, а не отказывает', () => {
    const { file, outcomes } = applyEdits(
      withRows(),
      [{ op: 'add_item_field', array: 'items', name: 'price', label: 'Цена, ₽', type: 'number' }],
      ctx()
    );
    expect(messages(outcomes)).toEqual([
      '✓ row field `items.price` changed (it was in the rows already)',
    ]);
    expect((arrays(file)[0].itemFields as Rec[]).map((item) => item.name)).toEqual([
      'title',
      'price',
    ]);
  });

  it('правило длины массива из спеки и от add_rule на массиве', () => {
    const spec = readFileSync(resolve(__dirname, '../eval/scenarios/order/spec.md'), 'utf8');
    const intent = intentFromSpec(spec, 'renderer-react', CATALOGS.uiKit);
    expect(intent.validation.filter((row) => row.target === 'items')).toEqual([
      { target: 'items', rules: ['minLength(1)', 'maxLength(10)'] },
    ]);
    const { file } = applyEdits(
      withRows(),
      [{ op: 'add_rule', field: 'items', minLength: 1, message: 'Добавьте хотя бы один товар' }],
      ctx()
    );
    expect(file.validation).toEqual([
      {
        target: 'items',
        rules: ["minLength(1, { code: 'items.minLength' })"],
        message: 'Добавьте хотя бы один товар',
      },
    ]);
  });

  it('set_field с array меняет колонку строк', () => {
    const { file, outcomes } = applyEdits(
      withRows(),
      [{ op: 'set_field', array: 'items', name: 'price', label: 'Цена, ₽', readonly: true }],
      ctx()
    );
    expect(outcomes[0].ok).toBe(true);
    const price = (arrays(file)[0].itemFields as Rec[]).find((item) => item.name === 'price')!;
    expect(price.label).toBe('Цена, ₽');
  });
});

describe('колонка готового массива и стартовые строки', () => {
  it('смена типа и значения колонки переписывает её значение в стартовых строках', () => {
    const start = applyEdits(
      withRows(),
      [{ op: 'add_array', name: 'items', label: 'Товары', minItems: 1 }],
      ctx()
    ).file;
    const { file, outcomes } = applyEdits(
      start,
      [
        { op: 'set_field', array: 'items', name: 'title', type: 'number' },
        { op: 'set_field', array: 'items', name: 'price', initialValue: 100 },
      ],
      ctx()
    );
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    const items = arrays(file)[0];
    const title = (items.itemFields as Rec[]).find((item) => item.name === 'title')!;
    expect(items.initialValue).toEqual([{ title: title.initialValue, price: 100 }]);
    expect(title.initialValue).not.toBe('');
  });
});

describe('умолчание поля при правке типа (ReFormer-f2fs.38)', () => {
  const field = (file: Rec, name: string) =>
    (file.fields as Rec[]).find((record) => record.name === name)!;

  it('тот же тип — умолчание остаётся: скидка черновика спеки сохраняет 0', () => {
    const spec = readFileSync(resolve(__dirname, '../eval/scenarios/order/spec.md'), 'utf8');
    const draft = intentFromSpec(spec, 'renderer-react', CATALOGS.uiKit) as unknown as Rec;
    expect(field(draft, 'discount').initialValue).toBe(0);
    // Правка модели из прогона r3 батча 20261119T124506Z-bff7 как есть.
    const { file, outcomes } = applyEdits(
      draft,
      [{ op: 'set_field', name: 'discount', type: 'number', component: 'Slider' }],
      ctx()
    );
    expect(outcomes[0].ok).toBe(true);
    expect(field(file, 'discount').initialValue).toBe(0);
  });

  it('смена типа: подходящее значение переносится, остальное — пустое значение типа', () => {
    const start = applyEdits(
      {},
      [
        { op: 'add_field', name: 'count', label: 'Количество', initialValue: '3' },
        { op: 'add_field', name: 'note', label: 'Заметка', initialValue: 'нет' },
        { op: 'add_field', name: 'agree', label: 'Согласие', type: 'boolean', initialValue: true },
      ],
      ctx()
    ).file;
    const { file } = applyEdits(
      start,
      [
        { op: 'set_field', name: 'count', type: 'number' },
        { op: 'set_field', name: 'note', type: 'number' },
        { op: 'set_field', name: 'agree', type: 'string' },
      ],
      ctx()
    );
    expect(field(file, 'count').initialValue).toBe(3);
    expect(field(file, 'note').initialValue).toBeNull();
    expect(field(file, 'agree').initialValue).toBe('');
  });
});

describe('стартовые строки со своими значениями и флажок строки (ReFormer-f2fs.36)', () => {
  /** Получатели: email и флажок «основной», одна стартовая строка. */
  const recipients = (): Rec =>
    applyEdits(
      {},
      [
        { op: 'add_array', name: 'recipients', label: 'Получатели', minItems: 1 },
        { op: 'add_item_field', array: 'recipients', name: 'email', label: 'Email' },
        {
          op: 'add_item_field',
          array: 'recipients',
          name: 'primary',
          label: 'Основной',
          type: 'boolean',
          initialValue: false,
        },
      ],
      ctx()
    ).file;

  it('startRows: значения строк поверх умолчаний колонок, не меньше minItems', () => {
    const { file, outcomes } = applyEdits(
      recipients(),
      [{ op: 'add_array', name: 'recipients', startRows: [{ primary: true }] }],
      ctx()
    );
    expect(messages(outcomes)).toEqual([
      '✓ array `recipients` changed: start rows [{"primary":true}]',
    ]);
    expect(arrays(file)[0].initialValue).toEqual([{ email: '', primary: true }]);

    // Пустой список при minItems 1 — одна строка умолчаний, а не ноль.
    const empty = applyEdits(
      recipients(),
      [{ op: 'add_array', name: 'recipients', startRows: [] }],
      ctx()
    ).file;
    expect(arrays(empty)[0].initialValue).toEqual([{ email: '', primary: false }]);
  });

  it('startRows: чужая колонка и не значение — отказ с подсказкой', () => {
    const { outcomes } = applyEdits(
      recipients(),
      [
        { op: 'add_array', name: 'recipients', startRows: [{ primery: true }] },
        { op: 'add_array', name: 'recipients', startRows: [{ email: ['a'] }] },
        { op: 'add_array', name: 'recipients', startRows: { primary: true } },
      ],
      ctx()
    );
    expect(messages(outcomes)).toEqual([
      expect.stringMatching(/^✗ .*no column `primery` in rows of `recipients`.*primary/),
      expect.stringMatching(/^✗ .*start row value of `email` is a string, number, boolean or null/),
      expect.stringMatching(/^✗ .*"startRows" is a list of rows/),
    ]);
  });

  it('смена умолчания колонки не трогает значение, заданное строке явно; смена типа — трогает', () => {
    const start = applyEdits(
      recipients(),
      [
        {
          op: 'add_array',
          name: 'recipients',
          startRows: [{ primary: true }, { email: 'a@b.ru' }],
        },
      ],
      ctx()
    ).file;
    const kept = applyEdits(
      start,
      [{ op: 'set_field', array: 'recipients', name: 'primary', initialValue: false }],
      ctx()
    ).file;
    expect(arrays(kept)[0].initialValue).toEqual([
      { email: '', primary: true },
      { email: 'a@b.ru', primary: false },
    ]);
  });

  it('exclusiveFlag — только на колонке да/нет', () => {
    const { outcomes, file } = applyEdits(
      recipients(),
      [
        { op: 'add_behavior', kind: 'exclusiveFlag', target: 'primary', array: 'recipients' },
        { op: 'add_behavior', kind: 'exclusiveFlag', target: 'email', array: 'recipients' },
        {
          op: 'add_behavior',
          kind: 'aggregateInto',
          target: 'recipients',
          array: 'recipients',
          expr: 'rows.length === 0 || rows.some((row) => row.primary) ? [] : [{ index: 0, patch: { primary: true } }]',
        },
      ],
      ctx()
    );
    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, true]);
    expect(outcomes[1].message).toMatch(/exclusiveFlag needs a yes\/no column — type boolean/);
    expect((file.behavior as Rec[]).map((row) => `${row.kind} ${row.target}`)).toEqual([
      'exclusiveFlag recipients.primary',
      'aggregateInto recipients',
    ]);
  });
});

describe('условно активное поле, пересоздание, место шага (ReFormer-f2fs.30)', () => {
  const giftForm = (): Rec =>
    applyEdits(
      {},
      [
        { op: 'add_field', name: 'giftWrap', label: 'Подарочная упаковка', type: 'boolean' },
        { op: 'add_field', name: 'giftMessage', label: 'Текст открытки' },
      ],
      ctx('core')
    ).file;

  it('правило поля с enableWhen проверяется только пока поле активно — в любом порядке правок', () => {
    const before = applyEdits(
      giftForm(),
      [
        { op: 'add_rule', field: 'giftMessage', required: true, maxLength: 200 },
        {
          op: 'add_behavior',
          kind: 'enableWhen',
          target: 'giftMessage',
          expr: 'model.giftWrap === true',
        },
      ],
      ctx('core')
    );
    expect(before.outcomes[1].message).toMatch(/its rules are checked only while it is active/);
    const after = applyEdits(
      giftForm(),
      [
        {
          op: 'add_behavior',
          kind: 'disableWhen',
          target: 'giftMessage',
          expr: 'model.giftWrap !== true',
        },
        { op: 'add_rule', field: 'giftMessage', required: true },
      ],
      ctx('core')
    );
    expect(after.outcomes[1].message).toMatch(
      /checked only while active: !\(model\.giftWrap !== true\)/
    );
    for (const file of [before.file, after.file]) {
      const rows = (file.validation as Rec[]).filter((row) => row.target === 'giftMessage');
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.when).toBeTruthy();
    }
  });

  it('на core showWhen — enableWhen, hideWhen — disableWhen: правила цепочки не безусловны [ReFormer-f2fs.37]', () => {
    // Цепочка f.field("giftMessage").required().maxLength(200).showWhen(…) — правила раньше видимости.
    const shown = applyEdits(
      giftForm(),
      [
        { op: 'add_rule', field: 'giftMessage', required: true, maxLength: 200 },
        { op: 'add_visibility', field: 'giftMessage', showWhen: 'model.giftWrap === true' },
      ],
      ctx('core')
    );
    expect(messages(shown.outcomes)[1]).toMatch(
      /^✓ on core the server hides no field — enableWhen instead: enableWhen on `giftMessage`.*its rules are checked only while it is active/
    );
    expect(shown.file.visibility ?? []).toEqual([]);
    expect(shown.file.behavior).toEqual([
      expect.objectContaining({
        kind: 'enableWhen',
        target: 'giftMessage',
        expr: 'model.giftWrap === true',
      }),
    ]);
    const rows = (shown.file.validation as Rec[]).filter((row) => row.target === 'giftMessage');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.when).toBe('model.giftWrap === true');

    const hidden = applyEdits(
      giftForm(),
      [{ op: 'add_visibility', field: 'giftMessage', hideWhen: 'model.giftWrap !== true' }],
      ctx('core')
    );
    expect(hidden.outcomes[0].ok).toBe(true);
    expect((hidden.file.behavior as Rec[])[0]).toMatchObject({
      kind: 'disableWhen',
      target: 'giftMessage',
    });

    // Строки на core не скрыть и не выключить целиком — отказ с подсказкой.
    const rowsForm = applyEdits(
      giftForm(),
      [
        { op: 'add_array', name: 'cards', label: 'Открытки' },
        { op: 'add_visibility', field: 'cards', showWhen: 'model.giftWrap === true' },
      ],
      ctx('core')
    );
    expect(messages(rowsForm.outcomes)[1]).toMatch(/^✗ .*`cards` is rows/);
  });

  it('удалить и добавить снова — предупреждение о потерянном сбросе и поведении', () => {
    const start = applyEdits(
      giftForm(),
      [
        { op: 'add_field', name: 'discount', label: 'Скидка', type: 'number' },
        {
          op: 'add_behavior',
          kind: 'enableWhen',
          target: 'discount',
          expr: 'model.giftWrap === true',
          resetOnDisable: true,
        },
        { op: 'add_behavior', kind: 'compute', target: 'discount', expr: 'model.giftWrap ? 5 : 0' },
      ],
      ctx('core')
    ).file;
    const { outcomes } = applyEdits(
      start,
      [
        { op: 'remove_field', name: 'discount' },
        { op: 'add_field', name: 'discount', label: 'Скидка, %', type: 'number' },
        {
          op: 'add_behavior',
          kind: 'enableWhen',
          target: 'discount',
          expr: 'model.giftWrap === true',
        },
      ],
      ctx('core')
    );
    expect(outcomes[1].message).toMatch(
      /⚠ `discount` was removed and added again without resetOnDisable of enableWhen, compute \(model\.giftWrap \? 5 : 0\) it had/
    );
    // Всё на месте — без предупреждения.
    const kept = applyEdits(
      start,
      [
        { op: 'remove_field', name: 'discount' },
        { op: 'add_field', name: 'discount', label: 'Скидка', type: 'number' },
        {
          op: 'add_behavior',
          kind: 'enableWhen',
          target: 'discount',
          expr: 'model.giftWrap === true',
          resetOnDisable: true,
        },
        { op: 'add_behavior', kind: 'compute', target: 'discount', expr: 'model.giftWrap ? 5 : 0' },
      ],
      ctx('core')
    );
    expect(kept.outcomes[1].message).not.toMatch(/⚠/);
  });

  const wizard = (): Rec =>
    applyEdits(
      {},
      [
        { op: 'add_field', name: 'a', label: 'A' },
        { op: 'add_field', name: 'b', label: 'B' },
        { op: 'add_field', name: 'c', label: 'C' },
        { op: 'add_step', title: 'Первый', fields: ['a'] },
        { op: 'add_step', title: 'Второй', fields: ['b'] },
      ],
      ctx()
    ).file;
  const titles = (file: Rec) => (file.steps as Rec[]).map((step) => step.title);

  it('add_step after/before ставит шаг между шагами; готовый шаг переезжает', () => {
    const between = applyEdits(
      wizard(),
      [{ op: 'add_step', title: 'Между', fields: ['c'], after: 'Первый' }],
      ctx()
    );
    expect(messages(between.outcomes)).toEqual([
      '✓ step «Между» added with 1 items, after «Первый»',
    ]);
    expect(titles(between.file)).toEqual(['Первый', 'Между', 'Второй']);

    const first = applyEdits(
      wizard(),
      [{ op: 'add_step', title: 'Ноль', fields: ['c'], before: '1' }],
      ctx()
    );
    expect(titles(first.file)).toEqual(['Ноль', 'Первый', 'Второй']);

    const moved = applyEdits(
      wizard(),
      [{ op: 'add_step', title: 'Второй', fields: [], before: 'Первый' }],
      ctx()
    );
    expect(messages(moved.outcomes)).toEqual(['✓ step «Второй» moved, before «Первый»']);
    expect(titles(moved.file)).toEqual(['Второй', 'Первый']);

    const unknown = applyEdits(
      wizard(),
      [{ op: 'add_step', title: 'Х', fields: ['c'], after: 'Нет' }],
      ctx()
    );
    expect(unknown.outcomes[0].ok).toBe(false);
    expect(unknown.outcomes[0].message).toMatch(/no step `Нет`/);
  });
});

describe('предупреждение, реакции, поле из самого себя (ReFormer-f2fs.31)', () => {
  const order = (): Rec =>
    applyEdits(
      {},
      [
        { op: 'add_field', name: 'customerType', label: 'Тип', options: ['person', 'company'] },
        { op: 'add_field', name: 'paymentMethod', label: 'Оплата', options: ['card', 'invoice'] },
        { op: 'add_field', name: 'promoCode', label: 'Промокод' },
        { op: 'add_field', name: 'total', label: 'Итого', type: 'number' },
      ],
      ctx()
    ).file;

  it('"warning":true — проверка-предупреждение: severity warning, свой код', () => {
    const { file, outcomes } = applyEdits(
      order(),
      [
        {
          op: 'add_rule',
          field: 'total',
          cross: 'values.total <= 100000',
          warning: true,
          message: 'Крупный заказ',
        },
      ],
      ctx()
    );
    expect(messages(outcomes)).toEqual([
      '✓ warning on `total` added — it shows the message and does not block sending',
    ]);
    expect(file.validation).toEqual([
      {
        target: 'total',
        severity: 'warning',
        cross: 'values.total <= 100000',
        code: 'total.warning',
        message: 'Крупный заказ',
      },
    ]);
  });

  it('transformValue над value и onChange с телом реакции принимаются', () => {
    const { file, outcomes } = applyEdits(
      order(),
      [
        {
          op: 'add_behavior',
          kind: 'transformValue',
          target: 'promoCode',
          expr: "(value ?? '').toUpperCase()",
        },
        {
          op: 'add_behavior',
          kind: 'onChange',
          target: 'customerType',
          expr: "if (model.customerType === 'person' && model.paymentMethod === 'invoice') model.paymentMethod = 'card';",
        },
      ],
      ctx()
    );
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect((file.behavior as Rec[]).map((row) => row.kind)).toEqual(['transformValue', 'onChange']);
  });

  it('правка мультивыбора черновика без type оставляет его тип array', () => {
    const start: Rec = {
      ...order(),
      fields: [
        ...((order().fields as Rec[]) ?? []),
        { name: 'sources', type: 'array', component: 'SelectMulti', label: 'Источники' },
      ],
    };
    const { file, outcomes } = applyEdits(
      start,
      [{ op: 'set_field', name: 'sources', options: ['search', 'friends'] }],
      ctx()
    );
    expect(outcomes[0].ok).toBe(true);
    const sources = (file.fields as Rec[]).find((field) => field.name === 'sources')!;
    expect(sources.type).toBe('array');
  });

  it('функция строкой в cross — отказ, а не «равно другому полю»', () => {
    const { outcomes } = applyEdits(
      order(),
      [
        {
          op: 'add_rule',
          field: 'total',
          cross: "v => v.customerType !== 'company' || v.total > 0",
          message: 'm',
        },
      ],
      ctx()
    );
    expect(outcomes[0].ok).toBe(false);
    expect(outcomes[0].message).toMatch(/"cross" is an expression over values, not a function/);
  });

  it('поле из самого себя — отказ с transformValue и onChange; resetWhen своего поля — без цикла', () => {
    const { outcomes } = applyEdits(
      order(),
      [
        {
          op: 'add_behavior',
          kind: 'compute',
          target: 'promoCode',
          expr: 'String(model.promoCode).toUpperCase()',
        },
        {
          op: 'add_behavior',
          kind: 'compute',
          target: 'paymentMethod',
          expr: "model.customerType === 'person' && model.paymentMethod === 'invoice' ? 'card' : model.paymentMethod",
        },
        {
          op: 'add_behavior',
          kind: 'resetWhen',
          target: 'paymentMethod',
          expr: "model.customerType === 'person' && model.paymentMethod === 'invoice'",
        },
      ],
      ctx()
    );
    expect(outcomes[0].ok).toBe(false);
    expect(outcomes[0].message).toMatch(
      /a computed field does not read itself .*transformValue.*onChange/
    );
    expect(outcomes[1].ok).toBe(false);
    expect(outcomes[2].message).toBe('resetWhen on `paymentMethod` reading customerType');
  });
});
