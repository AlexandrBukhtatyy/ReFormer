/**
 * Профиль guided: признаки задачи, план, плоские правки и сквозной путь form_start → form_edit →
 * «Done» настоящей сборкой (с проверкой типов: разметку core, которую пишет сервер, должен принять
 * компилятор).
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { RUN_SCRIPT_TOOL } from '../src/core/codemode/run-script';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { applyEdits, maskToPattern, type EditContext } from '../src/core/guided/edits';
import { behaviorWord, featuresFromText } from '../src/core/guided/features';
import { MARKUP_MARK } from '../src/core/guided/markup';
import {
  baselineOf,
  changesLine,
  editGaps,
  formulaMisses,
  gapFixes,
  stageExample,
  stagesFor,
  taskFragment,
  taskGaps,
  uncomputed,
} from '../src/core/guided/plan';
import { readIntent } from '../src/core/generate/form-intent';
import type { Knowledge } from '../src/core/knowledge';
import {
  formBuildGuidedTool,
  formEditTool,
  formStartTool,
  formStatusTool,
  guidedBuildText,
} from '../src/core/tools/guided';
import { createCliFormWorkspace, TYPECHECK_ROOT_ENV } from '../src/platform/cli/form-workspace';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { createQuickJsSandbox } from '../src/platform/cli/quickjs-sandbox';

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
    ).toEqual(['fields', 'arrays', 'wizard', 'validation']);
  });

  it('«из списка» и «выпадающий список» — выбор, а не строки массива', () => {
    expect(featuresFromText('город из списка Москва, Казань').arrays).toBe(false);
    expect(featuresFromText('страна — выпадающий список').arrays).toBe(false);
    expect(featuresFromText('список контактов, до 5 строк').arrays).toBe(true);
    expect(featuresFromText('password repeat must match').arrays).toBe(false);
    expect(
      featuresFromText('При доставке адрес обязателен и виден; при самовывозе его не видно')
        .behavior
    ).toBe(true);
  });

  it('валидация в плане всегда: слова задания модель пересказывает и теряет', () => {
    expect(stagesFor(featuresFromText('Forma vkhoda s loginom i parolem'), 'core')).toEqual([
      'fields',
      'validation',
      'markup',
    ]);
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
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, false, false, false, false]);
    // Повтор существующего поля — его правка: модель пересылает весь список полей.
    expect(outcomes[1].message).toMatch(/`email` already existed — field `email` changed/);
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
    // required с условием заменил безусловный: замена — по полю и валидатору, без учёта «when».
    expect(coded).toEqual({
      target: 'age',
      rules: ["min(18, { code: 'age.min' })", "max(120, { code: 'age.max' })"],
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
        { op: 'add_behavior', kind: 'hideWhen', target: 'total', expr: 'model.price > 100' },
      ],
      ctx()
    );
    // «Скрыть при условии» в add_behavior — это видимость: правка уходит туда.
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, true, true, true]);
    expect(outcomes[5].message).toMatch(/`total` hidden when model.price > 100/);
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

  it('варианты «значение — подпись» делятся; умолчание подписью — значение варианта', () => {
    const { file } = applyEdits(
      {},
      [
        {
          op: 'add_field',
          name: 'reason',
          options: ['defect - брак', 'other — другое'],
          initialValue: 'defect - брак',
        },
        { op: 'add_field', name: 'kind', options: ['a', 'b'], default: 'b' },
        { op: 'set_field', name: 'reason', initialValue: 'другое' },
      ],
      ctx()
    );
    expect(fields(file)[0].componentProps).toEqual({
      options: [
        { value: 'defect', label: 'брак' },
        { value: 'other', label: 'другое' },
      ],
    });
    expect(fields(file)[0].initialValue).toBe('other');
    expect(fields(file)[1].initialValue).toBe('b');
  });

  it('форма без шагов: «step» игнорируется; числа строками у числового поля — диапазон, не выбор', () => {
    const task = 'Скидка (discount, от 0 до 50). Итог (total) = цена × (1 − скидка/100).';
    const { file, outcomes } = applyEdits(
      {},
      [
        {
          op: 'add_field',
          name: 'total',
          type: 'number',
          readonly: true,
          step: 'total = price * (1 - discount/100)',
        },
        { op: 'add_field', name: 'discount', type: 'number', options: ['0', '1', '5', '50'] },
      ],
      { ...ctx(), wizard: false, task }
    );
    expect(outcomes[0].message).toBe(
      'field `total` added to the form ("step" ignored — this form has no steps; a formula is add_behavior "kind":"compute")'
    );
    expect(fields(file)[0]).toMatchObject({ componentProps: { readOnly: true } });
    expect(outcomes[1].ok).toBe(false);
    expect(outcomes[1].message).toMatch(/a range of the task is a check, not choices/);
  });

  it('маска без формата в задании — выдумка: выбрасывается, поле остаётся без проверки по ней', () => {
    const { file, outcomes } = applyEdits(
      {},
      [{ op: 'add_field', name: 'phone', label: 'Телефон', mask: '+9(999)00-00-00' }],
      { ...ctx(), task: 'Форма заказа обратного звонка: имя и телефон' }
    );
    expect(outcomes[0].message).toBe(
      'field `phone` added to the form; "mask" dropped — the task names no input format'
    );
    expect(fields(file)[0].componentProps).toBeUndefined();
    expect(file.validation ?? []).toEqual([]);
    const kept = applyEdits({}, [{ op: 'add_field', name: 'phone', mask: '+7 (999) 999-99-99' }], {
      ...ctx(),
      task: 'Телефон в формате +7 (999) 999-99-99',
    });
    expect(fields(kept.file)[0].componentProps).toEqual({ mask: '+7 (999) 999-99-99' });
  });

  it('удаление поля, которое задание называет, — с напоминанием вернуть его', () => {
    const task = 'Анкета: город из списка Москва, Казань.';
    const { outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'city', label: 'Город', options: ['Москва', 'Казань'] },
        { op: 'add_field', name: 'extra', label: 'Лишнее' },
        { op: 'remove_field', name: 'city' },
        { op: 'remove_field', name: 'extra' },
      ],
      { ...ctx(), task }
    );
    expect(outcomes[2].message).toBe(
      '`city` removed — the task names this input («Город»): put it back with add_field unless it really is not an input of the task'
    );
    expect(outcomes[3].message).toBe('`extra` removed');
  });

  it('пустой add_rule по полю, которое задание делает обязательным; when флагом; цели через запятую', () => {
    const task =
      'Заказ: способ (method: a — да, b — нет). При доставке становятся обязательными адрес (address) и дата (date); комментарий (note) по желанию.';
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'method', options: ['a', 'b'] },
        { op: 'add_field', name: 'address', label: 'Адрес' },
        { op: 'add_field', name: 'date', label: 'Дата' },
        { op: 'add_field', name: 'note', label: 'Комментарий' },
        { op: 'add_rule', field: 'address' },
        { op: 'add_rule', field: 'note' },
        { op: 'add_rule', field: 'date', required: true, when: true },
        { op: 'add_visibility', target: 'address, date', showWhen: "model.method === 'a'" },
      ],
      { ...ctx(), task }
    );
    expect(outcomes[4].message).toMatch(/no check given — the task makes the field required/);
    expect(outcomes[5].ok).toBe(false);
    expect(outcomes[6].message).toMatch(/"when" true\/false is no condition — dropped/);
    expect(outcomes[7].ok).toBe(true);
    expect(file.visibility).toEqual([
      { selector: 'address', condition: "!(model.method === 'a')" },
      { selector: 'date', condition: "!(model.method === 'a')" },
    ]);
  });

  it('условие — голое поле выбора: отказ с образцом сравнения; флажок — можно', () => {
    const { outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'reason', options: ['defect', 'other'] },
        { op: 'add_field', name: 'agree', type: 'boolean' },
        { op: 'add_field', name: 'comment' },
        { op: 'add_visibility', field: 'comment', showWhen: 'model.reason' },
        { op: 'add_visibility', field: 'comment', showWhen: 'model.agree' },
      ],
      ctx()
    );
    expect(outcomes[3].message).toBe(
      `"model.reason" is not yes/no — \`reason\` is a choice; compare it: model.reason === 'defect' or model.reason === 'other'`
    );
    expect(outcomes[4].ok).toBe(true);
  });

  it('маска чужого поля: правка её отсекает, сверка находит, "mask":"" снимает с проверкой', () => {
    const task =
      'Анкета профиля: ФИО (от 2 до 100 символов), телефон в формате +7 (999) 999-99-99.';
    const guarded = applyEdits(
      {},
      [
        { op: 'add_field', name: 'fullName', label: 'ФИО', mask: '+7 (999) 999-99-99' },
        { op: 'add_field', name: 'phone', label: 'Телефон', mask: '+7 (999) 999-99-99' },
      ],
      { ...ctx(), task }
    );
    expect(guarded.outcomes[0].message).toMatch(
      /"mask" dropped — the format «\+7 \(999\) 999-99-99» stands by another input of the task/
    );
    expect(fields(guarded.file)[1].componentProps).toEqual({ mask: '+7 (999) 999-99-99' });
    // Маска уже стоит (форма собрана раньше) — сверка находит и даёт правку.
    const placed = applyEdits(
      {},
      [
        { op: 'add_field', name: 'fullName', label: 'ФИО', mask: '+7 (999) 999-99-99' },
        { op: 'add_field', name: 'phone', label: 'Телефон', mask: '+7 (999) 999-99-99' },
        { op: 'add_rule', field: 'fullName', minLength: 2, maxLength: 100 },
      ],
      ctx()
    );
    const { intent } = readIntent({ target: 'renderer-react', ...placed.file });
    expect(taskGaps(task, intent)).toContain(
      'the mask of fullName is the format of another input of the task — the task names no format for fullName: "mask":"" removes it'
    );
    expect(gapFixes(task, intent)).toContainEqual({ op: 'set_field', name: 'fullName', mask: '' });
    const fixed = applyEdits(placed.file, [{ op: 'set_field', name: 'fullName', mask: '' }], {
      ...ctx(),
      task,
    });
    expect(fixed.outcomes[0].message).toMatch(
      /mask «\+7 \(999\) 999-99-99» and its format check removed/
    );
    const fullName = fields(fixed.file).find((field) => field.name === 'fullName')!;
    expect(fullName.componentProps).toBeUndefined();
    expect(fullName.component).toBe('Input');
    expect((fixed.file.validation as Rec[]).filter((row) => row.target === 'fullName')).toEqual([
      { target: 'fullName', rules: ['minLength(2)', 'maxLength(100)'] },
    ]);
  });

  it('границы диапазона вариантами — отказ; «!поле === v» — «поле !== v»; ${…} — отказ', () => {
    const task = 'Скидка (discount, от 0 до 50). Причина (reason): defect — брак, other — другое.';
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'discount', type: 'number', options: [0, 50] },
        { op: 'add_field', name: 'reason', options: ['defect', 'other'] },
        { op: 'add_field', name: 'comment' },
        { op: 'add_rule', field: 'comment', required: true, when: "!model.reason === 'other'" },
        {
          op: 'add_rule',
          field: 'reason',
          required: true,
          when: '"${model.reason}" !== \'defect\'',
        },
      ],
      { ...ctx(), task }
    );
    expect(outcomes[0].message).toMatch(/a range of the task is a check, not choices/);
    expect((file.validation as Rec[])[0]).toMatchObject({
      target: 'comment',
      when: "model.reason !== 'other'",
    });
    expect(outcomes[4].message).toMatch(/no \$\{…\} here/);
  });

  it('одиночное «=» в условии — сравнение; заголовок формы — не поле', () => {
    const { file, outcomes } = applyEdits(
      { formName: 'Оформление заказа' },
      [
        { op: 'add_field', name: 'orderDetails', label: 'Оформление заказа' },
        { op: 'add_field', name: 'deliveryMethod', options: ['pickup', 'delivery'] },
        { op: 'add_field', name: 'deliveryDate', type: 'date' },
        { op: 'add_visibility', field: 'deliveryDate', showWhen: 'deliveryMethod=delivery' },
      ],
      ctx()
    );
    expect(outcomes[0].message).toMatch(/is the title of the form, not an input/);
    expect(outcomes[3].ok).toBe(true);
    expect(file.visibility).toEqual([
      { selector: 'deliveryDate', condition: "!(model.deliveryMethod === 'delivery')" },
    ]);
  });

  it('имя поля — слово о типе: отказ с подсказкой', () => {
    const { outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'integer', label: 'Number of tickets' },
        { op: 'add_field', name: 'field2', label: 'Промокод' },
        { op: 'add_field', name: 'tickets', label: 'Количество билетов' },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([false, false, true]);
    expect(outcomes[0].message).toMatch(/says the kind, not the input/);
  });

  it('"type":"readonly" — флаг только для чтения, а не тип', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'refund', type: 'number' },
        { op: 'set_field', name: 'refund', type: 'readonly' },
        { op: 'add_field', name: 'total', type: 'computed' },
      ],
      ctx()
    );
    expect(outcomes.every((o) => o.ok)).toBe(true);
    expect(fields(file)[0]).toMatchObject({ type: 'number', componentProps: { readOnly: true } });
    expect(fields(file)[1]).toMatchObject({ type: 'number', componentProps: { readOnly: true } });
  });

  it('поведение: то же вычисление поля заменяется, чужие имена — отказ, remove_behavior убирает', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'amount', type: 'number' },
        { op: 'add_field', name: 'refund', type: 'number' },
        { op: 'add_behavior', kind: 'compute', target: 'refund', expr: 'visible ? amount : 0' },
        { op: 'add_behavior', kind: 'compute', target: 'refund', expr: 'amount * 2' },
        { op: 'add_behavior', kind: 'compute', target: 'refund', expr: 'amount * 3' },
        { op: 'remove_behavior', target: 'amount' },
      ],
      ctx()
    );
    expect(outcomes[2].ok).toBe(false);
    expect(outcomes[2].message).toMatch(
      /"expr" names `visible` — not a field of the form; an expression reads only the fields: amount, refund/
    );
    expect(outcomes[4].message).toMatch(/replaced the previous one/);
    expect(outcomes[5].message).toMatch(
      /no behavior on `amount` — the form has: compute on refund/
    );
    expect(file.behavior).toEqual([
      { kind: 'compute', target: 'refund', sources: ['amount'], expr: '(model.amount ?? 0) * 3' },
    ]);
    const removed = applyEdits(file, [{ op: 'remove_behavior', target: 'refund' }], ctx());
    expect(removed.outcomes[0].message).toBe('1 behavior removed from `refund`');
    expect(removed.file.behavior).toEqual([]);
  });

  it('сумма по строкам: параметры стрелочной функции — не чужие имена', () => {
    const { outcomes } = applyEdits(
      {},
      [
        { op: 'add_array', name: 'items', label: 'Позиции' },
        { op: 'add_item_field', array: 'items', name: 'price', type: 'number' },
        { op: 'add_field', name: 'total', type: 'number' },
        {
          op: 'add_behavior',
          kind: 'compute',
          target: 'total',
          expr: 'model.items.reduce((sum, row) => sum + (row.price ?? 0), 0)',
        },
      ],
      { ...ctx(), rows: true }
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, true]);
  });

  it('самописное выражение почты — проверка email сервера; ник с @ — нет', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'email' },
        { op: 'add_field', name: 'nick' },
        {
          op: 'add_rule',
          field: 'email',
          required: true,
          pattern: '[^\\W_@]+[@]\\.+\\.[a-z]{2,}',
        },
        { op: 'add_rule', field: 'nick', pattern: '^@\\w{5,32}$' },
      ],
      ctx()
    );
    expect(outcomes[2].message).toMatch(/email pattern read as "email":true/);
    expect(file.validation).toEqual([
      { target: 'email', rules: ['required()', 'email()'] },
      { target: 'nick', rules: ['pattern(/^@\\w{5,32}$/)'] },
    ]);
  });

  it('проверки на самом поле — правило поля, а не потеря', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'login', label: 'Логин', required: true },
        { op: 'add_field', name: 'fio', minLength: 2, maxLength: 100, message: 'От 2 до 100' },
      ],
      ctx()
    );
    expect(outcomes.every((o) => o.ok)).toBe(true);
    expect(outcomes[0].message).toMatch(/rule on `login`: required/);
    expect(file.validation).toEqual([
      { target: 'login', rules: ['required()'] },
      {
        target: 'fio',
        rules: [
          "minLength(2, { code: 'fio.minLength' })",
          "maxLength(100, { code: 'fio.maxLength' })",
        ],
        message: 'От 2 до 100',
      },
    ]);
    expect(fields(file)[0]).not.toHaveProperty('required');
  });

  it('та же проверка того же поля заменяется, а не дописывается', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'a', required: true },
        { op: 'add_rule', field: 'a', minLength: 1 },
        { op: 'add_rule', field: 'a', minLength: 2 },
        { op: 'set_field', name: 'a', required: true },
      ],
      ctx()
    );
    expect(outcomes[2].message).toMatch(/replaced the previous one/);
    expect(file.validation).toEqual([
      { target: 'a', rules: ['minLength(2)'] },
      { target: 'a', rules: ['required()'] },
    ]);
  });

  it('ключ с пробелом — тот же ключ; без "op" — отказ называет пришедшие ключи', () => {
    const { file, outcomes } = applyEdits(
      {},
      [{ ' op': 'add_field', name: 'login' }, { name: 'password' }, { op: 'add_fild', name: 'x' }],
      ctx()
    );
    expect(outcomes[0]).toMatchObject({ ok: true, op: 'add_field' });
    expect(outcomes[0].message).toMatch(/keys read as " op" → "op"/);
    expect(outcomes[1].message).toMatch(/no "op" in this edit \(keys: name\)/);
    expect(outcomes[2].message).toMatch(/did you mean `add_field`/);
    expect(outcomes[2].message.match(/add_visibility/g)).toHaveLength(1);
    expect(fields(file).map((f) => f.name)).toEqual(['login']);
  });

  it('pattern шаблоном маски — выражение по маске; неверное выражение — отказ правки', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'phone', mask: '+7 (999) 999-99-99' },
        { op: 'add_rule', field: 'phone', pattern: '+7 \\(999\\) 999-99-99' },
        { op: 'add_field', name: 'card' },
        { op: 'add_rule', field: 'card', pattern: '9999 9999' },
        { op: 'add_rule', field: 'card', pattern: '+[' },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, true, false]);
    expect(outcomes[1].message).toMatch(/read as the input mask "\+7 \(999\) 999-99-99"/);
    expect(outcomes[4].message).toMatch(/not a valid regular expression/);
    const rules = (file.validation as Rec[]).map((row) => (row.rules as string[])[0]);
    expect(rules).toEqual([
      'pattern(/^\\+7 \\(\\d\\d\\d\\) \\d\\d\\d-\\d\\d-\\d\\d$/)',
      'pattern(/^\\d\\d\\d\\d \\d\\d\\d\\d$/)',
    ]);
    expect(new RegExp(maskToPattern('+7 (999) 999-99-99')).test('+7 (912) 345-67-89')).toBe(true);
  });

  it('проверки объектом в options — проверки поля; слова проверок в списке options — отказ', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'fio', options: { minLength: 2, maxLength: 100 } },
        { op: 'add_field', name: 'age', options: ['min', 18, 'max', 99] },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, false]);
    expect(fields(file)[0]).toMatchObject({ component: 'Input' });
    expect(file.validation).toEqual([{ target: 'fio', rules: ['minLength(2)', 'maxLength(100)'] }]);
    expect(outcomes[1].message).toMatch(/a length or a range is a check/);
  });

  it('один вариант — не выбор; set_field понимает "field"; массив вне плана — отказ', () => {
    const { outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'fio', options: ['от 2 до 100 символов'] },
        { op: 'add_field', name: 'phone' },
        { op: 'set_field', field: 'phone', label: 'Телефон' },
        { op: 'add_array', name: 'city' },
      ],
      { ...ctx(), rows: false }
    );
    expect(outcomes.map((o) => o.ok)).toEqual([false, true, true, false]);
    expect(outcomes[0].message).toMatch(/one choice is not a select/);
    expect(outcomes[3].message).toMatch(/the plan has no rows.*Send the same add_array again/);
  });

  it('маска в чужой нотации (#) — нотация кита; выражение в "rule" — pattern', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'phone', mask: '+7 (###) ###-##-##' },
        { op: 'add_rule', field: 'phone', pattern: '^\\+7 \\(###\\) ###-##-##$' },
        { op: 'add_field', name: 'code' },
        { op: 'add_rule', field: 'code', rule: '^\\d{6}$' },
      ],
      ctx()
    );
    expect(outcomes.every((o) => o.ok)).toBe(true);
    expect(fields(file)[0]).toMatchObject({ componentProps: { mask: '+7 (999) 999-99-99' } });
    const rules = (file.validation as Rec[]).map((row) => (row.rules as string[])[0]);
    expect(rules[0]).toBe(`pattern(/${maskToPattern('+7 (999) 999-99-99')}/)`);
    expect(rules[1]).toBe('pattern(/^\\d{6}$/)');
  });

  it('варианты на поле с маской или датой — отказ: это не выбор', () => {
    const options = ['Москва', 'Казань'];
    const { outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'phone', mask: '+7 (999) 999-99-99', options },
        { op: 'add_field', name: 'birth', type: 'date', options },
        { op: 'add_field', name: 'city', options },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([false, false, true]);
    expect(outcomes[0].message).toMatch(/with "mask" is not a choice/);
    expect(outcomes[1].message).toMatch(/with "type":"date" is not a choice/);
  });

  it('min/max у текстового поля — его длина', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'fio', min: 2, max: 100 },
        { op: 'add_field', name: 'age', type: 'number', min: 18 },
      ],
      ctx()
    );
    expect(outcomes[0].message).toMatch(/min\/max of a text read as its length/);
    expect(file.validation).toEqual([
      { target: 'fio', rules: ['minLength(2)', 'maxLength(100)'] },
      { target: 'age', rules: ['min(18)'] },
    ]);
  });

  it('строка rule: короткие записи — вызов валидатора, мусор — отказ', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'fio' },
        { op: 'add_rule', field: 'fio', rule: 'minLength:2' },
        { op: 'add_rule', field: 'fio', rule: 'maxLength=100' },
        { op: 'add_rule', field: 'fio', rule: 'required' },
        { op: 'add_rule', field: 'fio', rule: 'minLength=2;maxLength=100' },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, true, false]);
    expect((file.validation as Rec[]).flatMap((row) => row.rules as string[])).toEqual([
      'minLength(2)',
      'maxLength(100)',
      'required()',
    ]);
    expect(outcomes[4].message).toMatch(/is not a validator call/);
  });

  it('when проверяется при приёме; remove_rule убирает правила; проверки в options — правила', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        {
          op: 'add_field',
          name: 'tickets',
          type: 'number',
          options: ['required', 'min:1', 'max:10'],
        },
        { op: 'add_field', name: 'email' },
        { op: 'add_rule', field: 'email', required: true, when: '@email != ""' },
        { op: 'add_rule', field: 'email', required: true, when: 'model.emial !== ""' },
        { op: 'add_rule', field: 'email', email: true, when: 'true' },
        { op: 'remove_rule', field: 'tickets', rule: 'max' },
        { op: 'remove_rule', field: 'email' },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, false, false, true, true, true]);
    expect(outcomes[2].message).toMatch(/a condition over the form/);
    expect(outcomes[3].message).toMatch(/no such field — did you mean `email`/);
    expect(outcomes[6].message).toMatch(/1 rule removed from `email`/);
    expect(file.validation).toEqual([{ target: 'tickets', rules: ['required()', 'min(1)'] }]);
  });

  it('правило между полями: equals и краткая запись — равенство; мусор — отказ с образцом', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'password' },
        { op: 'add_field', name: 'confirm_password' },
        { op: 'add_rule', field: 'confirm_password', equals: 'password', message: 'Не совпадает' },
        { op: 'add_rule', field: 'confirm_password', cross: 'password;equals' },
        { op: 'add_rule', field: 'confirm_password', cross: 'equals' },
        {
          op: 'add_rule',
          field: 'confirm_password',
          cross: 'values.pasword === values.confirm_password',
        },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, true, false, false]);
    // snake_case — camelCase: и имя поля, и ссылки на него.
    expect(outcomes[1].message).toMatch(
      /names read as camelCase: confirm_password → confirmPassword/
    );
    expect((file.validation as Rec[])[0]).toMatchObject({
      target: 'confirmPassword',
      cross: 'values.confirmPassword === values.password',
      message: 'Не совпадает',
    });
    expect((file.validation as Rec[])[1].cross).toBe('values.confirmPassword === values.password');
    expect(outcomes[4].message).toMatch(/"equals":"<other field>"/);
    expect(outcomes[5].message).toMatch(/no such field — did you mean `password`/);
  });

  it('«cross» объектом — равенство; флаг — отказ с образцом; текст в «rule» — message', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'password' },
        { op: 'add_field', name: 'confirmPassword' },
        { op: 'add_rule', field: 'confirmPassword', cross: { target: 'password' } },
        { op: 'add_rule', field: 'confirmPassword', cross: true },
        {
          op: 'add_rule',
          field: 'password',
          minLength: 8,
          rule: 'Password must be at least 8 characters long.',
        },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, false, true]);
    expect((file.validation as Rec[])[0].cross).toBe('values.confirmPassword === values.password');
    expect(outcomes[3].message).toMatch(/"cross" is an expression over values, TRUE when valid/);
    expect(outcomes[4].message).toMatch(/"rule" text read as "message"/);
    expect((file.validation as Rec[])[1]).toMatchObject({
      target: 'password',
      message: 'Password must be at least 8 characters long.',
    });
  });

  it('условия с голыми именами — над формой; видимость списком полей; поведение «show» — видимость', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        {
          op: 'add_field',
          name: 'deliveryMethod',
          type: 'choice',
          options: ['pickup', 'delivery'],
        },
        { op: 'add_field', name: 'address' },
        { op: 'add_field', name: 'deliveryDate', type: 'date' },
        { op: 'add_rule', field: 'address', required: true, when: 'deliveryMethod == delivery' },
        {
          op: 'add_visibility',
          fields: ['address', 'deliveryDate'],
          showWhen: "deliveryMethod === 'delivery'",
          hideWhen: "deliveryMethod === 'pickup'",
        },
        {
          op: 'add_behavior',
          kind: 'showFields',
          field: 'address',
          condition: 'deliveryMethod == delivery',
        },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, true, true, true]);
    expect(fields(file)[0]).toMatchObject({ type: 'string', component: 'Select' });
    expect((file.validation as Rec[])[0].when).toBe("model.deliveryMethod == 'delivery'");
    expect(file.visibility).toEqual([
      { selector: 'address', condition: "!(model.deliveryMethod === 'delivery')" },
      { selector: 'deliveryDate', condition: "!(model.deliveryMethod === 'delivery')" },
      { selector: 'address', condition: "!(model.deliveryMethod == 'delivery')" },
    ]);
  });

  it('имя поля в кавычках — поле; default — начальное значение; заглушка формулы — отказ', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'reason', options: ['defect', 'other'], default: 'defect' },
        { op: 'add_field', name: 'comment' },
        { op: 'add_rule', field: 'comment', required: true, when: "'reason' === 'other'" },
        { op: 'add_field', name: 'amount', type: 'number' },
        { op: 'add_field', name: 'refund', type: 'number', readonly: true },
        {
          op: 'add_behavior',
          kind: 'compute',
          target: 'refund',
          expr: '<the formula of the task over model.amount>',
        },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, true, true, true, false]);
    expect(fields(file)[0]).toMatchObject({ initialValue: 'defect' });
    expect((file.validation as Rec[])[0].when).toBe("model.reason === 'other'");
    expect(outcomes[5].message).toMatch(/placeholder/);
  });

  it('поля формулы без типа — числа, их длины — границы', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'price' },
        { op: 'add_field', name: 'discount', min: 0, max: 50 },
        { op: 'add_field', name: 'total', readonly: true },
        {
          op: 'add_behavior',
          kind: 'compute',
          target: 'total',
          expr: 'model.price * (1 - model.discount / 100)',
        },
      ],
      ctx()
    );
    expect(outcomes[3].message).toMatch(/total, price, discount made numbers/);
    expect(fields(file).map((f) => [f.name, f.type, f.component])).toEqual([
      ['price', 'number', 'InputNumber'],
      ['discount', 'number', 'InputNumber'],
      ['total', 'number', 'InputNumber'],
    ]);
    expect(fields(file)[2].componentProps).toEqual({ readOnly: true });
    expect(file.validation).toEqual([{ target: 'discount', rules: ['min(0)', 'max(50)'] }]);
  });

  it('скрытое поле не проверяется: правила получают условие показа', () => {
    const { file, outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'method', options: ['pickup', 'delivery'] },
        { op: 'add_field', name: 'address', required: true },
        { op: 'add_visibility', field: 'address', showWhen: "method === 'delivery'" },
        { op: 'add_field', name: 'date', type: 'date' },
        { op: 'add_visibility', field: 'date', showWhen: "method === 'delivery'" },
        { op: 'add_rule', field: 'date', required: true },
      ],
      ctx()
    );
    expect(outcomes[2].message).toMatch(/its rules are checked only while shown/);
    expect(outcomes[5].message).toMatch(/checked only while shown: model.method === 'delivery'/);
    expect(file.validation).toEqual([
      { target: 'address', rules: ['required()'], when: "model.method === 'delivery'" },
      { target: 'date', rules: ['required()'], when: "model.method === 'delivery'" },
    ]);
  });

  it('формулы над числовыми полями — с «?? 0»: числовое поле начинается с null', () => {
    const { file } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'price', type: 'number' },
        { op: 'add_field', name: 'qty', type: 'number' },
        { op: 'add_field', name: 'total', type: 'number', readonly: true },
        {
          op: 'add_behavior',
          kind: 'compute',
          target: 'total',
          expr: 'model.price * (model.qty ?? 1) / 100',
        },
      ],
      ctx()
    );
    expect((file.behavior as Rec[])[0].expr).toBe('(model.price ?? 0) * (model.qty ?? 1) / 100');
  });

  it('маска без цифр или на дате — отказ', () => {
    const { outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'birth', type: 'date', mask: 'YYYY-MM-DD' },
        { op: 'add_field', name: 'code', mask: 'AA-AA' },
      ],
      ctx()
    );
    expect(outcomes.map((o) => o.ok)).toEqual([false, false]);
    expect(outcomes[0].message).toMatch(/a date field has no "mask"/);
    expect(outcomes[1].message).toMatch(/has no digit/);
  });

  it('не объект в списке правок — отказ называет, что пришло', () => {
    const { outcomes } = applyEdits({}, [{ op: 'add_field', name: 'a' }, 'op'], ctx());
    expect(outcomes[1]).toMatchObject({ ok: false, op: '?' });
    expect(outcomes[1].message).toMatch(/got "op" — check the brackets/);
  });
});

describe('пример следующего шага', () => {
  it('строится на полях формы: правила, вычисление, условие — заглушка значения из задания', () => {
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
    // Пример — на полях без правил; вычисляемое (readOnly) не в счёт.
    expect(JSON.parse(stageExample('validation', 'renderer-react', intent))).toEqual([
      { op: 'add_rule', field: 'method', required: true },
      { op: 'add_rule', field: 'address', required: true },
      { op: 'add_rule', field: 'price', required: true },
    ]);
    expect(JSON.parse(stageExample('behavior', 'renderer-react', intent))).toEqual([
      {
        op: 'add_behavior',
        kind: 'compute',
        target: 'total',
        expr: '<the formula of the task over model.price>',
      },
      {
        op: 'add_visibility',
        field: 'address',
        showWhen: "model.method === '<the choice of the task>'",
      },
    ]);
    expect(stageExample('behavior', 'core', intent)).toContain(
      '"kind":"enableWhen","target":"address"'
    );
  });
  it('поле с маской: пример валидации — pattern по маске', () => {
    const { intent } = readIntent({
      target: 'renderer-react',
      fields: [
        { name: 'fio', type: 'string', component: 'Input' },
        {
          name: 'phone',
          type: 'string',
          component: 'InputMask',
          componentProps: { mask: '(999) 99' },
        },
      ],
    });
    expect(JSON.parse(stageExample('validation', 'renderer-react', intent))).toEqual([
      { op: 'add_rule', field: 'fio', required: true },
      { op: 'add_rule', field: 'phone', required: true },
      { op: 'add_rule', field: 'phone', pattern: '^\\(\\d\\d\\d\\) \\d\\d$' },
    ]);
  });
});

describe('сверка с заданием', () => {
  const task = 'Анкета: ФИО (от 2 до 100 символов), телефон в формате +7 (999) 999-99-99.';
  const form = (mask: string, rules: string[]) =>
    readIntent({
      target: 'renderer-json',
      fields: [
        { name: 'fio', type: 'string', component: 'Input' },
        { name: 'phone', type: 'string', component: 'InputMask', componentProps: { mask } },
      ],
      validation: [{ target: 'fio', rules }],
    }).intent;

  it('маска не из задания и неиспользованное число задания — расхождения', () => {
    expect(taskGaps(task, form('(999) 999-99-99', ['maxLength(100)']))).toEqual([
      'the mask of phone «(999) 999-99-99» is not the format of the task «+7 (999) 999-99-99» (9 for each digit)',
      'the task names 2 — no rule or setting of the form uses it',
    ]);
  });

  it('готовые правки: маска из шаблона задания, вторая граница диапазона', () => {
    expect(gapFixes(task, form('(999) 999-99-99', ['maxLength(100)']))).toEqual([
      { op: 'set_field', name: 'phone', mask: '+7 (999) 999-99-99' },
      { op: 'add_rule', field: 'fio', minLength: 2 },
    ]);
    expect(
      gapFixes(task, form('+7 (999) 999-99-99', ["minLength(2, { code: 'fio.minLength' })"]))
    ).toEqual([{ op: 'add_rule', field: 'fio', maxLength: 100 }]);
    expect(gapFixes('ФИО (от 2 до 20 символов)', form('+7 (999) 99', ['maxLength(20)']))).toEqual([
      { op: 'add_rule', field: 'fio', minLength: 2 },
    ]);
  });

  it('формат задания без поля — маска полю, чья подпись стоит перед шаблоном', () => {
    const { intent } = readIntent({
      target: 'renderer-json',
      fields: [
        { name: 'fio', type: 'string', component: 'Input', label: 'ФИО' },
        { name: 'phone', type: 'string', component: 'Input', label: 'Телефон' },
      ],
      validation: [{ target: 'fio', rules: ['minLength(2)', 'maxLength(100)'] }],
    });
    expect(gapFixes(task, intent)).toEqual([
      { op: 'set_field', name: 'phone', mask: '+7 (999) 999-99-99' },
    ]);
  });

  it('варианты далеко от подписи своего поля — расхождение', () => {
    const profile =
      'Анкета: ФИО (от 2 до 100 символов), дата рождения, город из списка Москва, Казань.';
    const options = [
      { value: 'Москва', label: 'Москва' },
      { value: 'Казань', label: 'Казань' },
    ];
    const wrong = readIntent({
      target: 'renderer-json',
      fields: [
        {
          name: 'fio',
          type: 'string',
          component: 'Select',
          label: 'ФИО',
          componentProps: { options },
        },
      ],
      validation: [{ target: 'fio', rules: ['minLength(2)', 'maxLength(100)'] }],
    }).intent;
    expect(taskGaps(profile, wrong)).toEqual([
      'the choices of fio «ФИО» stand in the task far from «ФИО» — they belong to the input named right before them; is that input missing?',
    ]);
    const right = readIntent({
      target: 'renderer-json',
      fields: [
        {
          name: 'city',
          type: 'string',
          component: 'Select',
          label: 'Город',
          componentProps: { options },
        },
      ],
    }).intent;
    expect(taskGaps(profile, right).filter((gap) => gap.includes('choices'))).toEqual([]);
    // Подпись модели шире задания, но имя в скобках стоит прямо перед вариантами — не расхождение.
    const refund = readIntent({
      target: 'renderer-json',
      fields: [
        {
          name: 'reason',
          type: 'string',
          component: 'Select',
          label: 'Причина возврата',
          componentProps: { options: [{ value: 'defect', label: 'defect' }] },
        },
      ],
    }).intent;
    expect(
      taskGaps('Причина (reason): defect — брак, other — другое.', refund).filter((gap) =>
        gap.includes('choices')
      )
    ).toEqual([]);
  });

  it('граница правила не из задания и подписи не на языке задания — расхождения с правкой', () => {
    const registration = 'Регистрация: email (обязателен), повтор пароля, возраст от 18 до 120.';
    const { intent } = readIntent({
      target: 'renderer-react',
      fields: [
        { name: 'email', type: 'string', component: 'Input', label: 'Email' },
        { name: 'confirm', type: 'string', component: 'Input', label: 'Confirm Password' },
        { name: 'age', type: 'number', component: 'InputNumber', label: 'Возраст' },
      ],
      validation: [
        { target: 'email', rules: ['required()', 'maxLength(10)'] },
        { target: 'age', rules: ['min(18)', 'max(120)'] },
      ],
    });
    expect(taskGaps(registration, intent)).toEqual([
      'the form limits email by maxLength(10) — the task names no 10',
      'the labels «Confirm Password» are not in the task — take each label from the task, in its language',
    ]);
    expect(gapFixes(registration, intent)).toEqual([
      { op: 'remove_rule', field: 'email', rule: 'maxLength' },
    ]);
  });

  it('числа формулы — не границы: до этапа поведения расхождения нет, правки max:100 тоже', () => {
    const order =
      'Позиция заказа: цена (price), количество (quantity), скидка в процентах (discount, от 0 до 50). Итог (total) = цена × количество × (1 − скидка/100), итог только для чтения и считается сам.';
    const intentWith = (rules: string[]) =>
      readIntent({
        target: 'core',
        fields: [
          { name: 'price', type: 'number', component: 'InputNumber', label: 'Цена' },
          { name: 'quantity', type: 'number', component: 'InputNumber', label: 'Количество' },
          { name: 'discount', type: 'number', component: 'InputNumber', label: 'Скидка' },
          { name: 'total', type: 'number', component: 'InputNumber', label: 'Итог' },
        ],
        validation: [{ target: 'discount', rules }],
      }).intent;
    expect(taskGaps(order, intentWith(['min(0)', 'max(50)']))).toEqual([]);
    expect(gapFixes(order, intentWith(['min(1)', 'max(50)']))).toEqual([
      { op: 'remove_rule', field: 'discount', rule: 'min' },
    ]);
    // Граница из формулы — выдуманная.
    expect(taskGaps(order, intentWith(['min(0)', 'max(100)']))).toEqual([
      'the task names 50 — no rule or setting of the form uses it',
      'the form limits discount by max(100) — the task names no 100',
    ]);
    // Маркеры списка «1) … 2)» — не границы; «(от 0 до 50)» — граница.
    expect(
      taskGaps('Мастер: 1) цена, 2) скидка (от 0 до 50).', intentWith(['min(0)', 'max(50)']))
    ).toEqual([]);
    // Диапазон через дефис — не формула.
    expect(taskGaps('Комментарий (2-100 символов).', intentWith([]))).toEqual([
      'the task names 2, 100 — no rule or setting of the form uses it',
    ]);
  });

  it('умолчание задания без initialValue — расхождение с готовой правкой', () => {
    const refund =
      'Причина (reason): defect — брак, other — другое; по умолчанию выбран defect. Удержание в процентах (feePercent) от 0 до 30, по умолчанию 0.';
    const intentWith = (reason: unknown, fee: unknown) =>
      readIntent({
        target: 'renderer-react',
        fields: [
          {
            name: 'reason',
            type: 'string',
            component: 'Select',
            label: 'Причина',
            initialValue: reason,
            componentProps: {
              options: [
                { value: 'defect', label: 'брак' },
                { value: 'other', label: 'другое' },
              ],
            },
          },
          {
            name: 'feePercent',
            type: 'number',
            component: 'InputNumber',
            label: 'Удержание в процентах',
            initialValue: fee,
          },
        ],
        validation: [{ target: 'feePercent', rules: ['min(0)', 'max(30)'] }],
      }).intent;
    expect(taskGaps(refund, intentWith('', null))).toEqual([
      'the task names the default «по умолчанию выбран defect» — reason has no "initialValue" defect',
      'the task names the default «по умолчанию 0» — feePercent has no "initialValue" 0',
    ]);
    expect(gapFixes(refund, intentWith('', null))).toEqual([
      { op: 'set_field', name: 'reason', initialValue: 'defect' },
      { op: 'set_field', name: 'feePercent', initialValue: 0 },
    ]);
    expect(taskGaps(refund, intentWith('defect', 0))).toEqual([]);
  });

  it('обязательность и видимость из окна поля — расхождения; условие — из варианта в окне', () => {
    const refund =
      'Причина (reason): defect — брак, other — другое. Комментарий (comment) виден и обязателен только при other. Сумма (amount) обязательна.';
    const intentWith = (visibility: unknown[], rules: Array<{ target: string; rules: string[] }>) =>
      readIntent({
        target: 'renderer-react',
        fields: [
          {
            name: 'reason',
            type: 'string',
            component: 'Select',
            label: 'Причина',
            componentProps: {
              options: [
                { value: 'defect', label: 'брак' },
                { value: 'other', label: 'другое' },
              ],
            },
          },
          { name: 'comment', type: 'string', component: 'Input', label: 'Комментарий' },
          { name: 'amount', type: 'number', component: 'InputNumber', label: 'Сумма' },
        ],
        validation: rules,
        visibility,
      }).intent;
    const bare = intentWith([], [{ target: 'amount', rules: ['required()'] }]);
    expect(taskGaps(refund, bare)).toEqual([
      'the task makes comment required («Комментарий (comment) виден и обязателен только при other») — no "required" rule on it',
      'the task shows comment only on a condition («Комментарий (comment) виден и обязателен только при other») — add_visibility for it',
    ]);
    expect(gapFixes(refund, bare)).toEqual([
      { op: 'add_visibility', field: 'comment', showWhen: "model.reason === 'other'" },
      { op: 'add_rule', field: 'comment', required: true },
    ]);
    const right = intentWith(
      [{ selector: 'comment', condition: "!(model.reason === 'other')" }],
      [
        { target: 'amount', rules: ['required()'] },
        { target: 'comment', rules: ['required()'] },
      ]
    );
    expect(taskGaps(refund, right)).toEqual([]);
  });

  it('поле задания «(имя)», которого нет в форме, — расхождение с add_field', () => {
    const task = 'Сумма (amount) обязательна. К возврату (refund) = amount × 2 (required).';
    const { intent } = readIntent({
      target: 'renderer-react',
      fields: [{ name: 'amount', type: 'number', component: 'InputNumber', label: 'Сумма' }],
      validation: [{ target: 'amount', rules: ['required()'] }],
    });
    expect(taskGaps(task, intent)).toEqual([
      'the task names the input refund «К возврату» — the form has no such field',
    ]);
    expect(gapFixes(task, intent)).toEqual([
      { op: 'add_field', name: 'refund', label: 'К возврату' },
    ]);
  });

  it('соседи по условию: у адреса нет видимости и «when», как у даты, — расхождение с правкой', () => {
    const delivery =
      'Оформление заказа: способ получения (deliveryMethod: pickup — самовывоз, delivery — доставка). При доставке становятся обязательными адрес (address) и желаемая дата (deliveryDate) и они видны; при самовывозе этих полей не видно и они не проверяются.';
    const { intent } = readIntent({
      target: 'renderer-react',
      fields: [
        {
          name: 'deliveryMethod',
          type: 'string',
          component: 'Select',
          label: 'Способ получения',
          componentProps: {
            options: [
              { value: 'pickup', label: 'pickup' },
              { value: 'delivery', label: 'delivery' },
            ],
          },
        },
        { name: 'address', type: 'string', component: 'Input', label: 'Адрес' },
        { name: 'deliveryDate', type: 'date', component: 'Input', label: 'Желаемая дата' },
      ],
      validation: [
        { target: 'deliveryMethod', rules: ['required()'] },
        { target: 'address', rules: ['required()'] },
        {
          target: 'deliveryDate',
          rules: ['required()'],
          when: "model.deliveryMethod == 'delivery'",
        },
      ],
      visibility: [
        { selector: 'deliveryDate', condition: "!(model.deliveryMethod == 'delivery')" },
      ],
    });
    expect(taskGaps(delivery, intent)).toEqual([
      "the task says the same of address as of deliveryDate — deliveryDate is shown only when model.deliveryMethod == 'delivery', address always",
      "the task says the same of address as of deliveryDate — deliveryDate is required only when model.deliveryMethod == 'delivery', address always",
    ]);
    expect(gapFixes(delivery, intent)).toEqual([
      { op: 'add_visibility', field: 'address', showWhen: "model.deliveryMethod == 'delivery'" },
      {
        op: 'add_rule',
        field: 'address',
        required: true,
        when: "model.deliveryMethod == 'delivery'",
      },
    ]);
  });

  it('вычисляемое поле без compute — этап поведения не сделан, даже с видимостью', () => {
    const task =
      'Сумма (amount). К возврату (refund) = amount × 2. Комментарий (comment) виден при other.';
    const intentWith = (behavior: unknown[], readOnly: boolean) =>
      readIntent({
        target: 'renderer-react',
        fields: [
          { name: 'amount', type: 'number', component: 'InputNumber', label: 'Сумма' },
          {
            name: 'refund',
            type: 'string',
            component: 'Input',
            label: 'К возврату',
            ...(readOnly ? { componentProps: { readOnly: true } } : {}),
          },
        ],
        behavior,
        visibility: [{ selector: 'amount', condition: 'false' }],
      }).intent;
    expect(uncomputed(intentWith([], true), task)).toEqual(['refund']);
    expect(uncomputed(intentWith([], false), task)).toEqual(['refund']);
    expect(uncomputed(intentWith([], false), 'Сумма (amount).')).toEqual([]);
    expect(
      uncomputed(
        intentWith(
          [{ kind: 'compute', target: 'refund', sources: ['amount'], expr: 'model.amount * 2' }],
          true
        ),
        task
      )
    ).toEqual([]);
  });

  it('формула без поля из формулы задания — названо, что она ещё читает', () => {
    const task =
      'Позиция заказа: цена (price), количество (quantity), скидка в процентах (discount, от 0 до 50). Итог (total) = цена × количество × (1 − скидка/100), итог только для чтения.';
    const intentWith = (expr: string) =>
      readIntent({
        target: 'core',
        fields: [
          { name: 'price', type: 'number', component: 'InputNumber', label: 'Цена' },
          { name: 'quantity', type: 'number', component: 'InputNumber', label: 'Количество' },
          {
            name: 'discount',
            type: 'number',
            component: 'InputNumber',
            label: 'Скидка в процентах',
          },
          { name: 'total', type: 'number', component: 'InputNumber', label: 'Итого (Total)' },
        ],
        behavior: [{ kind: 'compute', target: 'total', expr }],
      }).intent;
    expect(formulaMisses(intentWith('model.price * model.quantity'), task)).toEqual([
      { target: 'total', missing: ['discount'] },
    ]);
    expect(
      formulaMisses(intentWith('model.price * model.quantity * (1 - model.discount / 100)'), task)
    ).toEqual([]);
  });

  it('заглушка в условии — отказ правки', () => {
    const { outcomes } = applyEdits(
      {},
      [
        { op: 'add_field', name: 'method', options: ['a', 'b'] },
        { op: 'add_field', name: 'address' },
        {
          op: 'add_visibility',
          field: 'address',
          showWhen: "model.method === '<the choice of the task>'",
        },
      ],
      ctx()
    );
    expect(outcomes[2].message).toMatch(/placeholder in angle brackets/);
  });

  it('граница чужого поля — расхождение с remove_rule', () => {
    const signup =
      'Запись на мероприятие: email (обязателен, проверяется формат), количество билетов (целое число от 1 до 10, обязательно), промокод (необязателен, не длиннее 12 символов).';
    const { intent } = readIntent({
      target: 'core',
      fields: [
        { name: 'email', type: 'string', component: 'Input', label: 'Email' },
        { name: 'tickets', type: 'number', component: 'InputNumber', label: 'Количество билетов' },
        { name: 'promoCode', type: 'string', component: 'Input', label: 'Промокод' },
      ],
      validation: [
        { target: 'email', rules: ['required()', 'email()', 'maxLength(12)'] },
        { target: 'tickets', rules: ['required()', 'min(1)', 'max(10)'] },
        { target: 'promoCode', rules: ['maxLength(12)'] },
      ],
    });
    expect(taskGaps(signup, intent)).toEqual([
      'the form limits email by maxLength(12) — the task names 12 for promoCode, not for email',
    ]);
    expect(gapFixes(signup, intent)).toEqual([
      { op: 'remove_rule', field: 'email', rule: 'maxLength' },
    ]);
  });

  it('форма по заданию — расхождений нет', () => {
    expect(taskGaps(task, form('+7 (999) 999-99-99', ['minLength(2)', 'maxLength(100)']))).toEqual(
      []
    );
    expect(taskGaps('Вход: логин и пароль, оба обязательны.', form('+7 (999) 99', []))).toEqual([]);
  });
});

describe('окно фокуса', () => {
  const intentOf = (fields: Array<[string, string]>) =>
    readIntent({
      target: 'renderer-react',
      fields: fields.map(([name, label]) => ({ name, type: 'string', component: 'Input', label })),
    }).intent;

  it('кусок задания про поле: до следующего поля, с вводной частью фразы', () => {
    const profile =
      'Анкета профиля: ФИО (от 2 до 100 символов), телефон в формате +7 (999) 999-99-99, дата рождения, город из списка Москва, Санкт-Петербург, Казань. Всё обязательно.';
    const p = intentOf([
      ['fio', 'ФИО'],
      ['phone', 'Телефон'],
      ['birthDate', 'Дата рождения'],
      ['city', 'Город'],
    ]);
    expect(taskFragment(profile, p, 'fio')).toBe('ФИО (от 2 до 100 символов)');
    expect(taskFragment(profile, p, 'phone')).toBe('телефон в формате +7 (999) 999-99-99');
    expect(taskFragment(profile, p, 'city')).toBe(
      'город из списка Москва, Санкт-Петербург, Казань'
    );
    const delivery =
      'Оформление заказа: способ получения (deliveryMethod: pickup — самовывоз, delivery — доставка). При доставке становятся обязательными адрес (address) и желаемая дата (deliveryDate) и они видны; при самовывозе этих полей не видно.';
    const d = intentOf([
      ['deliveryMethod', 'Способ получения'],
      ['address', 'Адрес'],
      ['deliveryDate', 'Желаемая дата'],
    ]);
    expect(taskFragment(delivery, d, 'address')).toBe(
      'При доставке становятся обязательными адрес (address) и'
    );
    expect(taskFragment(delivery, d, 'deliveryDate')).toBe(
      'При доставке становятся обязательными … желаемая дата (deliveryDate) и они видны; при самовывозе этих полей не видно'
    );
  });

  it('после «;» — то же поле: умолчание остаётся в окне', () => {
    const refund =
      'Заявка на возврат денег. Причина (reason): defect — брак, other — другое; по умолчанию выбран defect. Комментарий (comment) виден только при other.';
    const r = intentOf([
      ['reason', 'Причина'],
      ['comment', 'Комментарий'],
    ]);
    expect(taskFragment(refund, r, 'reason')).toBe(
      'Причина (reason): defect — брак, other — другое; по умолчанию выбран defect'
    );
  });

  it('формула — до конца фразы; поле не найдено — задание целиком', () => {
    const order =
      'Позиция заказа: цена (price), количество (quantity). Итог (total) = цена × количество, итог только для чтения.';
    const o = intentOf([
      ['price', 'Цена'],
      ['quantity', 'Количество'],
      ['total', 'Итог'],
    ]);
    expect(taskFragment(order, o, 'total', true)).toBe(
      'Итог (total) = цена × количество, итог только для чтения'
    );
    expect(taskFragment('Форма входа.', o, 'price')).toBe('Форма входа.');
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
      // Перед «готово» — сверка правил с заданием.
      expect(text(status)).toMatch(/Next — check the form against the task/);
      expect(text(status)).toMatch(/Rules now: /);
      expect(text(status)).not.toMatch(/Done/);
      const checked = await formStatusTool({ dir: 'form', confirm: 'validation' }, knowledge);
      expect(text(checked)).toMatch(/Stage validation checked against the task/);
      expect(text(checked)).toMatch(/Done: the form is built/);
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
            { op: 'add_rule', field: 'price', min: 0 },
            { op: 'add_rule', field: 'quantity', min: 1 },
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
      expect(answer).toMatch(/13 of 13 edits applied/);
      expect(answer).toMatch(/Types checked, no errors\./);
      expect(answer).toMatch(/Next — check the form against the task/);
      // Границы min(0)/min(1) не из задания: первое подтверждение — отказ с расхождениями.
      const first = await formStatusTool({ dir: 'form', confirm: 'validation' }, knowledge);
      expect(text(first)).toMatch(/Not confirmed yet/);
      const checked = await formStatusTool({ dir: 'form', confirm: 'validation' }, knowledge);
      expect(text(checked)).toMatch(/Done: the form is built/);
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
    'intent, написанный руками, сервер убирает: форма меняется только правками',
    async () => {
      await formStartTool({ dir: 'form', target: 'core', task: 'Вход: логин и пароль' }, knowledge);
      writeFileSync(
        join(project, 'form', 'form.intent.json'),
        JSON.stringify({ formName: 'Вход', target: 'renderer-react', fields: [] })
      );
      const result = await formEditTool(
        { dir: 'form', edits: [{ op: 'add_field', name: 'login', label: 'Логин' }] },
        knowledge
      );
      expect(text(result)).toMatch(/written by hand — the server put its own version back/);
      const intent = JSON.parse(file('form.intent.json'));
      expect(intent.target).toBe('core');
      expect(intent.fields.map((f: { name: string }) => f.name)).toEqual(['login']);

      // Правка руками после правки сервера — назад к версии сервера, и в formStatus тоже.
      writeFileSync(
        join(project, 'form', 'form.intent.json'),
        JSON.stringify({ formName: 'Вход', target: 'core', fields: [], cross: 'x' })
      );
      const status = await formStatusTool({ dir: 'form' }, knowledge);
      expect(text(status)).toMatch(/written by hand — the server put its own version back/);
      expect(JSON.parse(file('form.intent.json')).fields).toHaveLength(1);
    },
    SLOW
  );

  it(
    'отклонённые правки — раньше следующего этапа; строка вместо списка читается списком',
    async () => {
      await formStartTool(
        { dir: 'form', target: 'renderer-react', task: 'Вход: логин и пароль, оба обязательны' },
        knowledge
      );
      const fieldsAdded = await formEditTool(
        {
          dir: 'form',
          edits: JSON.stringify([
            { op: 'add_field', name: 'login' },
            { op: 'add_field', name: 'password' },
          ]),
        },
        knowledge
      );
      expect(text(fieldsAdded)).toMatch(/came as a string — read as a list/);
      const result = await formEditTool(
        {
          dir: 'form',
          edits: [{ op: 'add_rule', field: 'login', required: true }, 'op', 'add_rule', 'field'],
        },
        knowledge
      );
      const answer = text(result);
      expect(answer).toMatch(/✗ edits 2–4: not objects/);
      expect(answer).toMatch(/Next: 3 edits were rejected — send them again/);
      expect(answer).not.toMatch(/Done/);
    },
    SLOW
  );

  it(
    'form_status: skip списком, add этапа; ответ называет поля формы',
    async () => {
      await formStartTool(
        { dir: 'form', target: 'renderer-react', task: 'Вход: логин' },
        knowledge
      );
      await formEditTool(
        { dir: 'form', edits: [{ op: 'add_field', name: 'login', label: 'Логин' }] },
        knowledge
      );
      const added = await formStatusTool({ dir: 'form', add: 'arrays,behavior' }, knowledge);
      expect(text(added)).toMatch(/Stage arrays, behavior added to the plan/);
      expect(text(added)).toMatch(/Form fields: Логин \(login\)/);
      const skipped = await formStatusTool({ dir: 'form', skip: 'arrays, behavior' }, knowledge);
      expect(text(skipped)).toMatch(/Stage arrays, behavior skipped/);
    },
    SLOW
  );

  it(
    'валидацию, которую задание называет словами, не пропускают: ни в Next, ни через skip',
    async () => {
      const task = 'Заказ: при доставке адрес (address) становится обязательным.';
      await formStartTool({ dir: 'form', target: 'renderer-react', task }, knowledge);
      const added = await formEditTool(
        { dir: 'form', edits: [{ op: 'add_field', name: 'address', label: 'Адрес' }] },
        knowledge
      );
      expect(text(added)).toMatch(/Next — validation/);
      expect(text(added)).not.toMatch(/"skip":"validation"/);
      const skipped = await formStatusTool({ dir: 'form', skip: 'validation' }, knowledge);
      expect(text(skipped)).toMatch(
        /Validation is not skipped: the task names checks \(«обязател»\) — add_rule for each/
      );
      expect(text(skipped)).toMatch(/Next — validation/);
      expect(text(skipped)).not.toMatch(/Stage validation skipped/);
    },
    SLOW
  );

  it(
    'index.tsx руками на renderer — сборка пишет его заново; ключи за скобкой — ключи правки',
    async () => {
      const task = 'Доставка: адрес (address) обязателен.';
      await formStartTool({ dir: 'form', target: 'renderer-react', task }, knowledge);
      await formEditTool(
        { dir: 'form', edits: [{ op: 'add_field', name: 'address', label: 'Адрес' }] },
        knowledge
      );
      writeFileSync(
        join(project, 'form', 'index.tsx'),
        'export function Broken() { const x: number = "s"; return x; }\n'
      );
      const rebuilt = await formEditTool(
        {
          dir: 'form',
          edits: [{ op: 'add_rule', field: 'address', when: 'model.address !== null' }],
          message: 'Адрес нужен',
        },
        knowledge
      );
      expect(text(rebuilt)).toMatch(
        /Written by hand and replaced by the build: index\.tsx — the server writes the module/
      );
      expect(text(rebuilt)).toMatch(/Keys outside the edit \("message"\) read as keys of it/);
      expect(text(rebuilt)).toMatch(/a condition with no check read as "required" on it/);
      expect(text(rebuilt)).toMatch(/^✓ form_build/m);
      expect(readFileSync(join(project, 'form', 'index.tsx'), 'utf8')).toMatch(/FormRenderer/);
    },
    SLOW
  );

  it(
    'правило между полями, которое задание называет, не пропускают',
    async () => {
      const task =
        'Регистрация: пароль (password), повтор пароля (confirmPassword, должен совпадать с паролем).';
      await formStartTool({ dir: 'form', target: 'renderer-react', task }, knowledge);
      await formEditTool(
        {
          dir: 'form',
          edits: [
            { op: 'add_field', name: 'password', label: 'Пароль' },
            { op: 'add_field', name: 'confirmPassword', label: 'Повтор пароля' },
          ],
        },
        knowledge
      );
      const skipped = await formStatusTool({ dir: 'form', skip: 'cross' }, knowledge);
      expect(text(skipped)).toMatch(
        /Cross-field rules are not skipped: the task names one \(«повтор парол»\)/
      );
      expect(text(skipped)).not.toMatch(/Stage cross skipped/);
    },
    SLOW
  );

  it(
    'поведение с формулой или видимостью в задании не пропускают',
    async () => {
      const task = 'Сумма (amount). К возврату (refund) = amount × 2, только для чтения.';
      await formStartTool({ dir: 'form', target: 'renderer-react', task }, knowledge);
      await formEditTool(
        { dir: 'form', edits: [{ op: 'add_field', name: 'amount', type: 'number' }] },
        knowledge
      );
      const skipped = await formStatusTool({ dir: 'form', skip: 'validation,behavior' }, knowledge);
      expect(text(skipped)).toMatch(
        /Behavior is not skipped: the task names a reaction \(«=»\) — add_behavior or add_visibility for it/
      );
      expect(text(skipped)).toMatch(/Stage validation skipped/);
      expect(text(skipped)).not.toMatch(/"skip":"behavior"/);
    },
    SLOW
  );

  it(
    'маска: проверку формата ставит сервер; валидация напоминает задание и ждёт решения об остальном',
    async () => {
      const task = 'Анкета: телефон в формате +7 (999) 999-99-99, обязателен';
      await formStartTool({ dir: 'form', target: 'renderer-react', task }, knowledge);
      const added = await formEditTool(
        { dir: 'form', edits: [{ op: 'add_field', name: 'phone', mask: '+7 (999) 999-99-99' }] },
        knowledge
      );
      expect(text(added)).toMatch(/rule on `phone`: pattern \(the format check from the mask\)/);
      expect(text(added)).toContain(`The task: «${task}»`);
      expect(text(added)).toMatch(/Next — validation[^\n]*phone/);
      const required = await formEditTool(
        { dir: 'form', edits: [{ op: 'add_rule', field: 'phone', required: true }] },
        knowledge
      );
      expect(text(required)).toMatch(/Rules now: phone: pattern, required/);
      expect(text(required)).toMatch(/Fields now: phone «phone»: mask \+7 \(999\) 999-99-99/);
      const checked = await formStatusTool({ dir: 'form', confirm: 'validation' }, knowledge);
      expect(text(checked)).toMatch(/Done: the form is built/);
    },
    SLOW
  );

  it(
    'начатую валидацию не пропускают: сверка, затем confirm закрывает этап с необязательными полями',
    async () => {
      await formStartTool(
        { dir: 'form', target: 'renderer-react', task: 'Отзыв: имя обязательно, комментарий' },
        knowledge
      );
      await formEditTool(
        {
          dir: 'form',
          edits: [
            { op: 'add_field', name: 'name', label: 'Имя', required: true },
            { op: 'add_field', name: 'comment', label: 'Комментарий' },
          ],
        },
        knowledge
      );
      const skipped = await formStatusTool({ dir: 'form', skip: 'validation' }, knowledge);
      expect(text(skipped)).toMatch(/Validation is not skipped/);
      expect(text(skipped)).toMatch(/Are comment optional on purpose\? Check the form/);
      expect(text(skipped)).toMatch(/Fields now: name «Имя»: text · comment «Комментарий»: text/);
      expect(text(skipped)).not.toMatch(/"skip"/);
      const checked = await formStatusTool({ dir: 'form', confirm: 'validation' }, knowledge);
      expect(text(checked)).toMatch(/Done: the form is built/);
    },
    SLOW
  );

  it(
    'сверку с расхождениями первый раз не подтверждают, второй — да',
    async () => {
      await formStartTool(
        { dir: 'form', target: 'renderer-react', task: 'Заказ: билеты от 1 до 10' },
        knowledge
      );
      await formEditTool(
        {
          dir: 'form',
          edits: [{ op: 'add_field', name: 'tickets', type: 'number', required: true }],
        },
        knowledge
      );
      const first = await formStatusTool({ dir: 'form', confirm: 'validation' }, knowledge);
      expect(text(first)).toMatch(/Not confirmed yet — the form differs from the task/);
      expect(text(first)).toMatch(/the task names 1, 10/);
      const second = await formStatusTool({ dir: 'form', confirm: 'validation' }, knowledge);
      expect(text(second)).toMatch(/Done: the form is built/);
    },
    SLOW
  );

  it(
    'правки под другими ключами аргумента — тоже правки',
    async () => {
      await formStartTool(
        { dir: 'form', target: 'renderer-react', task: 'Пароль и повтор' },
        knowledge
      );
      const result = await formEditTool(
        {
          dir: 'form',
          edits: [
            { op: 'add_field', name: 'password' },
            { op: 'add_field', name: 'confirmPassword' },
          ],
          cross: [{ op: 'add_rule', field: 'confirmPassword', equals: 'password' }],
        },
        knowledge
      );
      expect(text(result)).toMatch(/Edits under "cross" read as edits/);
      expect(text(result)).toMatch(/cross rule on `confirmPassword` added/);
    },
    SLOW
  );

  it(
    'грамматики в профиле нет: form_build с grammar ведёт к правкам; числа-варианты диапазона — отказ',
    async () => {
      await formStartTool(
        { dir: 'form', target: 'renderer-react', task: 'Заказ: скидка от 0 до 50' },
        knowledge
      );
      const grammar = await formBuildGuidedTool({ dir: 'form', grammar: 'base' }, knowledge);
      expect(text(grammar)).toMatch(
        /no grammar here — in this profile the form changes only with form_edit/
      );
      expect(text(grammar)).toMatch(/Next — fields/);
      const edited = await formEditTool(
        {
          dir: 'form',
          edits: [{ op: 'add_field', name: 'discount', type: 'number', options: [0, 10, 20] }],
        },
        knowledge
      );
      expect(text(edited)).toMatch(/a range of the task is a check, not choices/);
    },
    SLOW
  );

  it(
    'form_build профиля guided кончается планом и Next:',
    async () => {
      await formStartTool(
        { dir: 'form', target: 'renderer-react', task: 'Вход: логин и пароль, оба обязательны' },
        knowledge
      );
      await formEditTool({ dir: 'form', edits: [{ op: 'add_field', name: 'login' }] }, knowledge);
      const built = await formBuildGuidedTool({ dir: 'form' }, knowledge);
      expect(text(built)).toMatch(/^✓ form_build/);
      expect(text(built)).toMatch(/Plan: ✓ fields · → validation/);
      expect(text(built)).toMatch(/Next — validation/);
    },
    SLOW
  );
});

describe('связка Code Mode и guided', () => {
  let project: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'code-guided-'));
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({ name: 'consumer', dependencies: { '@reformer/core': '*' } })
    );
  });
  afterEach(() => rmSync(project, { recursive: true, force: true }));

  const catalogFor = (dir: string) => {
    const knowledge: Knowledge = { ...cliKnowledge(), forms: createCliFormWorkspace(dir) };
    return createToolCatalog(() => knowledge, {
      profile: 'node',
      guided: true,
      codeMode: createQuickJsSandbox(),
    });
  };

  it('в песочнице — только функции guided', () => {
    const listed = catalogFor(project).list();
    expect(listed.map((tool) => tool.name)).toEqual([RUN_SCRIPT_TOOL]);
    for (const fn of ['formStart(', 'formEdit(', 'formStatus(', 'formBuild(']) {
      expect(listed[0]!.description).toContain(fn);
    }
    expect(listed[0]!.description).not.toContain('chooseApi(');
  });

  it('второй аргумент функции — ошибка вызова, а не тихая потеря', async () => {
    const result = await catalogFor(project).call(RUN_SCRIPT_TOOL, {
      code: 'console.log(await reformer.formStatus({ dir: "form" }, { skip: "validation" }))',
    });
    const answer = result.content.map((block) => (block.type === 'text' ? block.text : '')).join();
    expect(result.isError).toBe(true);
    expect(answer).toMatch(/reformer\.formStatus takes ONE object/);
  });

  it('скрипт ничего не напечатал — ответ последнего вызова', async () => {
    const result = await catalogFor(project).call(RUN_SCRIPT_TOOL, {
      code: 'await reformer.formStart({ dir: "form", target: "renderer-react", task: "Вход: логин" })',
    });
    const answer = result.content.map((block) => (block.type === 'text' ? block.text : '')).join();
    expect(answer).toMatch(
      /^\(the script printed nothing — reformer\.formStart answered:\)\n✓ form_start/
    );
  });

  it('строка Next: приходит кодом скрипта, который можно вставить как есть', async () => {
    const result = await catalogFor(project).call(RUN_SCRIPT_TOOL, {
      code: 'console.log(await reformer.formStart({ dir: "form", target: "renderer-react", task: "Вход: логин и пароль" }))',
    });
    const answer = result.content.map((block) => (block.type === 'text' ? block.text : '')).join();
    expect(answer).toMatch(/^await reformer\.formEdit\(\{"dir":"form","edits":\[/m);
    expect(answer).not.toMatch(/form_edit \{/);
    // Следующий вызов — напоминание, что он идёт через run_script.
    expect(answer).toMatch(
      /→ Run that call with run_script: code written in a message runs nothing\.$/
    );
  });

  it('стек, названный в задании пакетом, сильнее аргумента target', async () => {
    const result = await catalogFor(project).call(RUN_SCRIPT_TOOL, {
      code: 'console.log(await reformer.formStart({ dir: "form", target: "renderer-react", task: "Вход: логин. Стек: @reformer/core, разметку пишешь сам в JSX." }))',
    });
    const answer = result.content.map((block) => (block.type === 'text' ? block.text : '')).join();
    expect(answer).toMatch(
      /"target" taken from the task: @reformer\/core → "core" \(not "renderer-react"\)/
    );
    expect(answer).toMatch(/on core is saved/);
  });
});

describe('правка готовой формы: операции', () => {
  const seed = (): Rec => ({
    formName: 'Заказ',
    target: 'renderer-react',
    fields: [
      { name: 'customerType', type: 'string', component: 'Input', label: 'Тип' },
      { name: 'subtotal', type: 'number', component: 'InputNumber', label: 'Сумма' },
      { name: 'discount', type: 'number', component: 'InputNumber', label: 'Скидка' },
      { name: 'total', type: 'number', component: 'InputNumber', label: 'Итого' },
      { name: 'delivery.city', type: 'string', component: 'Input', label: 'Город' },
    ],
    arrays: [
      {
        name: 'items',
        itemFields: [{ name: 'price', type: 'number', component: 'InputNumber', label: 'Цена' }],
      },
    ],
    validation: [
      { target: 'customerType', rules: ['required()'] },
      { target: 'discount', when: "model.customerType === 'company'", rules: ['max(30)'] },
      { target: 'total', cross: 'values.total >= 0 || values.customerType === "b"', code: 't' },
      { target: 'price', each: 'items', rules: ['required()'] },
    ],
    behavior: [
      {
        kind: 'computeFrom',
        target: 'total',
        sources: ['subtotal', 'discount'],
        expr: '(subtotal ?? 0) * (1 - (discount ?? 0) / 100)',
      },
      {
        kind: 'enableWhen',
        target: 'discount',
        sources: ['customerType'],
        expr: "model.customerType === 'company'",
      },
    ],
    visibility: [{ selector: 'delivery', condition: "model.customerType !== 'b'" }],
    layoutRoot: {
      kind: 'container',
      component: 'FormWizard',
      children: [
        {
          kind: 'step',
          title: 'Покупатель',
          selector: 'buyer',
          children: ['customerType', { kind: 'part', ref: 'delivery', part: 'address' }],
        },
        {
          kind: 'step',
          title: 'Оплата',
          selector: 'payment',
          children: ['subtotal', 'discount', 'total', { kind: 'array', ref: 'items' }],
        },
      ],
    },
  });

  it('rename_field переписывает цели, источники, выражения, видимость и раскладку', () => {
    const { file, outcomes } = applyEdits(
      seed(),
      [{ op: 'rename_field', name: 'customerType', to: 'payerType', label: 'Плательщик' }],
      { ...ctx(), edit: true }
    );
    expect(outcomes[0]).toMatchObject({ ok: true });
    expect(outcomes[0].message).toMatch(/`customerType` renamed to `payerType`/);
    const text = JSON.stringify(file);
    expect(text).not.toMatch(/customerType/);
    expect((file.fields as Rec[])[0]).toMatchObject({ name: 'payerType', label: 'Плательщик' });
    expect((file.behavior as Rec[])[1]).toMatchObject({
      sources: ['payerType'],
      expr: "model.payerType === 'company'",
    });
    expect((file.validation as Rec[])[2].cross).toBe(
      'values.total >= 0 || values.payerType === "b"'
    );
  });

  it('rename_field группы и голое имя в формуле computeFrom; колонки строк не трогает', () => {
    const { file } = applyEdits(
      seed(),
      [
        { op: 'rename_field', name: 'discount', to: 'rebate' },
        { op: 'rename_field', name: 'delivery', to: 'shipping' },
      ],
      { ...ctx(), edit: true }
    );
    const behavior = file.behavior as Rec[];
    expect(behavior[0]).toMatchObject({
      sources: ['subtotal', 'rebate'],
      expr: '(subtotal ?? 0) * (1 - (rebate ?? 0) / 100)',
    });
    expect((file.fields as Rec[]).map((f) => f.name)).toContain('shipping.city');
    expect(JSON.stringify(file.layoutRoot)).toMatch(/"ref":"shipping"/);
    expect((file.visibility as Rec[])[0].selector).toBe('shipping');
    // Колонка строки `price` — не поле формы: правило по `each` остаётся как было.
    expect((file.validation as Rec[])[3]).toMatchObject({ target: 'price', each: 'items' });
  });

  it('rename_field: неизвестное поле и занятое имя — отказ с причиной', () => {
    const { outcomes } = applyEdits(
      seed(),
      [
        { op: 'rename_field', name: 'customerTipe', to: 'payerType' },
        { op: 'rename_field', name: 'discount', to: 'total' },
        { op: 'rename_field', name: 'discount' },
      ],
      { ...ctx(), edit: true }
    );
    expect(outcomes.map((o) => o.ok)).toEqual([false, false, false]);
    expect(outcomes[0].message).toMatch(/no field `customerTipe` — did you mean `customerType`/);
    expect(outcomes[2].message).toMatch(/"to" is the new key/);
  });

  it('rename_step и remove_step: шаг с полями, частью, массивом и их строками', () => {
    const { file, outcomes } = applyEdits(
      seed(),
      [
        { op: 'rename_step', title: 'Оплата', to: 'Оплата и скидки' },
        { op: 'remove_step', title: 'Покупатель' },
      ],
      { ...ctx(), edit: true }
    );
    expect(outcomes.map((o) => o.ok)).toEqual([true, true]);
    expect(outcomes[1].message).toMatch(/step «Покупатель» removed with 2 items/);
    // Правила и поведение на удалённом поле ушли; кто ещё читает его — назван.
    expect(outcomes[1].message).toMatch(/still read by/);
    const names = (file.fields as Rec[]).map((f) => f.name);
    expect(names).not.toContain('customerType');
    expect(names).not.toContain('delivery.city');
    expect(file.visibility).toEqual([]);
    const steps = JSON.stringify(file.layoutRoot);
    expect(steps).toMatch(/Оплата и скидки/);
    expect(steps).not.toMatch(/Покупатель/);
  });

  it('remove_field в режиме правки — без напоминания «задание называет поле»', () => {
    const task = 'Убери из формы скидку (`discount`).';
    const editing = applyEdits(seed(), [{ op: 'remove_field', name: 'discount' }], {
      ...ctx(),
      task,
      edit: true,
    });
    expect(editing.outcomes[0].message).not.toMatch(/put it back/);
    // Формулу, которая читает удалённое поле, ответ называет.
    expect(editing.outcomes[0].message).toMatch(/still read by computeFrom of total/);
    const creating = applyEdits(seed(), [{ op: 'remove_field', name: 'discount' }], {
      ...ctx(),
      task: 'Форма: скидка (discount) от 0 до 30',
    });
    expect(creating.outcomes[0].message).toMatch(/put it back/);
  });
});

describe('правка готовой формы: сверка по дельте', () => {
  const intent = (paths: string[], steps: string[] = []) =>
    readIntent({
      formName: 'F',
      target: 'renderer-react',
      fields: paths.map((name) => ({ name, type: 'string', component: 'Input', label: name })),
      ...(steps.length > 0
        ? {
            layoutRoot: {
              kind: 'container',
              component: 'FormWizard',
              children: steps.map((title, index) => ({
                kind: 'step',
                title,
                selector: `s${index}`,
                children: index === 0 ? paths : [],
              })),
            },
          }
        : {}),
    }).intent!;

  it('переименование, добавление и удаление по именам в кавычках', () => {
    const task = [
      'В каталоге `form/` уже готова форма. Доработай её:',
      '1. Поле логина переименуй: ключ `username` вместо `login`.',
      '2. Поле `customerType` переименуй в `payerType`.',
      '3. Сразу после email добавь необязательный телефон (`phone`).',
      '4. Убери капчу (`captcha`).',
      'Остальное в форме не меняй.',
    ].join('\n');
    expect(editGaps(task, intent(['login', 'customerType', 'captcha']))).toEqual([
      '`login` is still in the form — the task renames it to `username`',
      '`customerType` is still in the form — the task renames it to `payerType`',
      '`phone` is not in the form — the task adds it',
      '`captcha` is still in the form — the task removes it',
    ]);
    expect(editGaps(task, intent(['username', 'payerType', 'phone']))).toEqual([]);
  });

  it('шаги в «ёлочках» и действие заголовка для пунктов списка под ним', () => {
    const task = [
      '1. Шаг «Оплата» переименуй в «Оплата и скидки».',
      '2. Между шагами «Товары» и «Оплата» добавь шаг «Упаковка»:',
      '   - «Подарочная упаковка» (`giftWrap`) — Switch;',
      '3. Удали из мастера шаги «Компания» и «Доставка» целиком.',
    ].join('\n');
    expect(
      editGaps(task, intent(['comment'], ['Товары', 'Оплата', 'Компания', 'Доставка']))
    ).toEqual([
      'step «Оплата» is still in the form — the task renames it to «Оплата и скидки»',
      'step «Упаковка» is not in the form — the task adds it',
      '`giftWrap` is not in the form — the task adds it',
      'step «Компания» is still in the form — the task removes it',
      'step «Доставка» is still in the form — the task removes it',
    ]);
  });

  it('формулы и маски в кавычках — не имена; без имён расхождений нет', () => {
    const task =
      'Добавь телефон с маской `+7 (999) 999-99-99`. Итого теперь `subtotal × (1 − discount / 100)`. Убери капчу и повтор пароля.';
    expect(editGaps(task, intent(['captcha', 'confirmPassword']))).toEqual([]);
  });

  it('строка «что изменилось» — от состава на старте', () => {
    const before = baselineOf(intent(['login', 'captcha']));
    expect(changesLine(before, intent(['username', 'phone']))).toBe(
      'Changes since the start: fields removed: login, captcha; fields added: username, phone.'
    );
    expect(changesLine(before, intent(['login', 'captcha']))).toMatch(
      /no field, array or step added or removed/
    );
  });

  it('пример этапа cross — заглушки, а не пара полей формы', () => {
    expect(stageExample('cross', 'renderer-react', intent(['email', 'login']))).toMatch(
      /"field":"<field>","equals":"<the field it must match>"/
    );
  });
});

describe('правка готовой формы и спецификация: сквозной путь', () => {
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
    project = mkdtempSync(join(tmpdir(), 'guided-edit-'));
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({ name: 'consumer', dependencies: { '@reformer/core': '*' } })
    );
    knowledge = { ...cliKnowledge(), forms: createCliFormWorkspace(project) };
  });
  afterEach(() => rmSync(project, { recursive: true, force: true }));

  const seedForm = (): void => {
    const intent = {
      formName: 'Регистрация',
      target: 'renderer-react',
      fields: [
        { name: 'login', type: 'string', component: 'Input', label: 'Логин', initialValue: '' },
        { name: 'email', type: 'string', component: 'Input', label: 'Email', initialValue: '' },
        { name: 'password', type: 'string', component: 'Input', label: 'Пароль', initialValue: '' },
        { name: 'captcha', type: 'string', component: 'Input', label: 'Капча', initialValue: '' },
      ],
      validation: [
        { target: 'login', rules: ['required()', 'minLength(3)'] },
        { target: 'email', rules: ['required()', 'email()'] },
        { target: 'password', cross: 'values.password !== values.login', code: 'password.same' },
        { target: 'captcha', rules: ['required()'] },
      ],
    };
    const dir = join(project, 'form');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'form.intent.json'), JSON.stringify(intent, null, 2));
  };

  it(
    'форма уже в каталоге: план правки → rename/add/remove → сверка дельты → Done',
    async () => {
      seedForm();
      const task = [
        'В каталоге `form/` уже готова форма регистрации. Доработай её:',
        '1. Поле логина переименуй: ключ `username` вместо `login`.',
        '2. Сразу после email добавь необязательный телефон (`phone`).',
        '3. Убери капчу (`captcha`).',
      ].join('\n');
      const start = await formStartTool({ dir: 'form', target: 'renderer-react', task }, knowledge);
      expect(text(start)).toMatch(/the form in form is already built — the plan of the change/);
      expect(text(start)).toMatch(/Next — edit:/);
      expect(text(start)).not.toMatch(/every input of the task is here/);
      expect(JSON.parse(file('form.plan.json'))).toMatchObject({ mode: 'edit', stages: ['edit'] });

      const renamed = await formEditTool(
        { dir: 'form', edits: [{ op: 'rename_field', name: 'login', to: 'username' }] },
        knowledge
      );
      expect(text(renamed)).toMatch(/^form_edit: 1 of 1 edits applied/);
      expect(text(renamed)).toMatch(/Next — check the changes against the task/);
      expect(text(renamed)).toMatch(/`phone` is not in the form — the task adds it/);
      // Первое подтверждение при расхождениях — отказ.
      const early = await formStatusTool({ dir: 'form', confirm: 'edit' }, knowledge);
      expect(text(early)).toMatch(/Not confirmed yet/);

      const rest = await formEditTool(
        {
          dir: 'form',
          edits: [
            { op: 'add_field', name: 'phone', label: 'Телефон' },
            { op: 'remove_field', name: 'captcha' },
          ],
        },
        knowledge
      );
      expect(text(rest)).not.toMatch(/put it back/);
      expect(text(rest)).toMatch(
        /Changes since the start: fields removed: login, captcha; fields added: username, phone/
      );
      expect(text(rest)).not.toMatch(/Differs from the task/);
      const done = await formStatusTool({ dir: 'form', confirm: 'edit' }, knowledge);
      expect(text(done)).toMatch(/Done: the form is built/);
      const intent = JSON.parse(file('form.intent.json'));
      expect(JSON.stringify(intent.validation)).toMatch(/values\.password !== values\.username/);
    },
    SLOW
  );

  it(
    'formEdit без плана при готовой форме ведёт в formStart с заданием правки',
    async () => {
      seedForm();
      const result = await formEditTool({ dir: 'form', edits: [] }, knowledge);
      expect(text(result)).toMatch(/the form is already in form: start the change first/);
    },
    SLOW
  );

  it(
    'спецификация, названная в задании файлом, — specPath',
    async () => {
      const spec =
        '# Форма: Отзыв\n\n## Поля\n\n| Поле | Тип |\n| --- | --- |\n| Имя (`name`) | string |\n';
      const withSpec: Knowledge = {
        ...knowledge,
        spec: { describe: () => project, read: (ref) => (ref === 'form/spec.md' ? spec : null) },
      };
      const start = await formStartTool(
        {
          dir: 'form',
          target: 'renderer-react',
          task: 'Сделай форму по спецификации из файла `spec.md`.',
        },
        withSpec
      );
      expect(text(start)).toMatch(/"specPath" taken from the task: form\/spec\.md/);
      expect(text(start)).toMatch(/✓ the server drafted the form from form\/spec\.md/);
      expect(text(start)).not.toMatch(/form\.intent\.json|by hand/);
      expect(JSON.parse(file('form.plan.json'))).toMatchObject({
        source: 'spec',
        specPath: 'form/spec.md',
      });
    },
    SLOW
  );

  it(
    'повтор add_array после отказа «в плане нет строк» добавляет этап и применяется',
    async () => {
      await formStartTool(
        { dir: 'form', target: 'renderer-react', task: 'Форма: имя и email' },
        knowledge
      );
      const edit = { op: 'add_array', name: 'items', label: 'Товары' };
      const first = await formEditTool({ dir: 'form', edits: [edit] }, knowledge);
      expect(text(first)).toMatch(/Send the same add_array again/);
      const second = await formEditTool({ dir: 'form', edits: [edit] }, knowledge);
      expect(text(second)).toMatch(/Stage arrays added to the plan: add_array came again/);
      expect(text(second)).toMatch(/✓ add_array/);
      expect(JSON.parse(file('form.plan.json')).stages).toContain('arrays');
    },
    SLOW
  );
});

describe('модель не видит файлов формы', () => {
  it('ответ сборки — словами правок: без имени intent, списка файлов и «правь руками»', () => {
    const raw = [
      '✗ form_build: type errors: 1 — nothing written.',
      '- form.validation.ts:11 Expression expected. → fix form.intent.json — the build writes form.validation.ts',
      '- form.behavior.ts:9 Type mismatch. → fix form.intent.json — the build writes form.behavior.ts',
      '✗ form_build: form.intent.json is not read in full — nothing written.',
      'Folder form: api.ts, form.intent.json, index.tsx.',
      'The build does not know the task: check the intent against it, especially cross-field rules and dependency tables.',
      '⚠️ Your operators are still stubs: api.ts. A stub rule passes any value. Write the bodies there yourself (Edit).',
      'Edited by hand and left as is: model.ts. The build no longer updates them; delete a file to put it back under the build.',
      '- Send the intent with report_issue: the build must answer with diagnostics, not crash.',
    ].join('\n');
    const text = guidedBuildText(raw);
    expect(text).not.toMatch(/form\.intent\.json|Folder |the intent|\(Edit\)|by hand|report_issue/);
    expect(text).toMatch(/Expression expected\. → fix it with form_edit: add_rule again/);
    expect(text).toMatch(/Type mismatch\. → fix it with form_edit: add_behavior again/);
    expect(text).toMatch(/the form is not read in full/);
    expect(text).toMatch(/operators that are stubs/);
  });

  it('pattern(…) без слэшей — литерал; фраза, кончающаяся на $, — отказ', () => {
    const form = (): Rec => ({
      formName: 'F',
      target: 'renderer-react',
      fields: [{ name: 'login', type: 'string', component: 'Input', label: 'Логин' }],
    });
    const rulesOf = (rule: string) => {
      const { file, outcomes } = applyEdits(
        form(),
        [{ op: 'add_rule', field: 'login', rule }],
        ctx()
      );
      return {
        ok: outcomes[0].ok,
        message: outcomes[0].message,
        rules: JSON.stringify(file.validation),
      };
    };
    expect(rulesOf('pattern(^[a-zA-Z0-9_]{3,20}$)').rules).toContain(
      'pattern(/^[a-zA-Z0-9_]{3,20}$/)'
    );
    expect(rulesOf("pattern('^[a-z]+$')").rules).toContain('pattern(/^[a-z]+$/)');
    expect(rulesOf('pattern(/^x$/i)').rules).toContain('pattern(/^x$/i)');
    const sentence = rulesOf('length >= 6 && pattern ^[a-zA-Z0-9_-]{6}$');
    expect(sentence).toMatchObject({ ok: false });
    expect(sentence.message).toMatch(/is not a validator call/);
    const broken = rulesOf('pattern(^[a-z)');
    expect(broken).toMatchObject({ ok: false });
    expect(broken.message).toMatch(/not a valid regular expression/);
  });

  describe('через сервер', () => {
    let project: string;
    const previousRoot = process.env[TYPECHECK_ROOT_ENV];
    const answer = (result: { content: Array<{ type: string; text?: string }> }) =>
      result.content.map((block) => (block.type === 'text' ? (block.text ?? '') : '')).join('\n');
    beforeAll(() => {
      process.env[TYPECHECK_ROOT_ENV] = repoRoot;
    });
    afterAll(() => {
      if (previousRoot === undefined) delete process.env[TYPECHECK_ROOT_ENV];
      else process.env[TYPECHECK_ROOT_ENV] = previousRoot;
    });
    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), 'guided-files-'));
      writeFileSync(
        join(project, 'package.json'),
        JSON.stringify({ name: 'consumer', dependencies: { '@reformer/core': '*' } })
      );
    });
    afterEach(() => rmSync(project, { recursive: true, force: true }));
    const knowledgeOf = (): Knowledge => ({
      ...cliKnowledge(),
      forms: createCliFormWorkspace(project),
    });

    it(
      'formBuild без плана и без формы ведёт в formStart, а не отдаёт грамматику',
      async () => {
        const result = await formBuildGuidedTool({ dir: 'form' }, knowledgeOf());
        expect(answer(result)).toMatch(/no plan yet — start the form first/);
        expect(answer(result)).not.toMatch(/grammar|Write it by/);
      },
      SLOW
    );

    it(
      'code-guided: сбой сборки после применённых правок — ответ, а не исключение скрипта',
      async () => {
        const catalog = createToolCatalog(knowledgeOf, {
          profile: 'node',
          guided: true,
          codeMode: createQuickJsSandbox(),
        });
        await catalog.call(RUN_SCRIPT_TOOL, {
          code: 'console.log(await reformer.formStart({ dir: "form", target: "renderer-react", task: "Форма: a, b, c" }))',
        });
        const result = await catalog.call(RUN_SCRIPT_TOOL, {
          code: `console.log(await reformer.formEdit({ dir: "form", edits: [
            { op: "add_field", name: "a", label: "A" },
            { op: "add_field", name: "b", label: "B" },
            { op: "add_field", name: "c", label: "C" },
            { op: "add_behavior", kind: "disableWhen", target: "c", expr: "model.a || model.b" },
          ] }))`,
        });
        const text = answer(result as never);
        expect(text).toMatch(/form_edit: 4 of 4 edits applied/);
        expect(text).toMatch(/✗ form_build/);
        expect(text).not.toMatch(/script error/);
        expect(text).not.toMatch(/form\.intent\.json/);
        expect(result.isError).not.toBe(true);
      },
      SLOW
    );
  });
});

describe('сверка без ложных чисел и с пересказом правки', () => {
  const form = (fields: Array<[string, string]>, validation: Rec[] = []) =>
    readIntent({
      formName: 'F',
      target: 'renderer-react',
      fields: fields.map(([name, label]) => ({ name, type: 'string', component: 'Input', label })),
      validation,
    }).intent!;

  it('число, склеенное с буквами, и длительность — не ограничения формы', () => {
    const task =
      'капча (captcha) — код из 6 символов, обязательна. Верный код ABC123, ответ через 300 мс.';
    const gaps = taskGaps(task, form([['captcha', 'Капча']]));
    expect(gaps.join('\n')).toMatch(/the task names 6 —/);
    expect(gaps.join('\n')).not.toMatch(/123|300/);
  });

  it('имена латиницей без кавычек в русском пересказе — тоже имена', () => {
    const task =
      '1. Поле логина переименуй: ключ username вместо login. 2. Сразу после email добавь телефон phone.';
    expect(
      editGaps(
        task,
        form([
          ['login', 'Логин'],
          ['email', 'Email'],
        ])
      )
    ).toEqual([
      '`login` is still in the form — the task renames it to `username`',
      '`phone` is not in the form — the task adds it',
    ]);
  });

  it('удаление по подписи и «остальное не меняй» — по составу на старте', () => {
    const seed = form(
      [
        ['login', 'Логин'],
        ['password', 'Пароль'],
        ['confirmPassword', 'Повтор пароля'],
        ['captcha', 'Капча'],
      ],
      [
        { target: 'login', rules: ['required()', 'minLength(3)'] },
        { target: 'password', rules: ['required()'] },
        { target: 'confirmPassword', rules: ['required()'] },
      ]
    );
    const before = baselineOf(seed);
    const task =
      'Убери из формы капчу и повтор пароля — сами поля и все их проверки. Остальное в форме не меняй.';
    // Повтор пароля остался, а у логина и пароля сняли проверки.
    const wrong = form([
      ['login', 'Логин'],
      ['password', 'Пароль'],
      ['confirmPassword', 'Повтор пароля'],
    ]);
    expect(editGaps(task, wrong, before)).toEqual([
      '`confirmPassword` is still in the form — the task removes it',
      '`login` lost its checks (required, minLength) — the task does not change `login`: put them back with add_rule',
      '`password` lost its checks (required) — the task does not change `password`: put them back with add_rule',
    ]);
    // Повтор пароля удалён: подпись «пароля» внутри его подписи — не поле «Пароль».
    const right = form(
      [
        ['login', 'Логин'],
        ['password', 'Пароль'],
      ],
      [
        { target: 'login', rules: ['required()', 'minLength(3)'] },
        { target: 'password', rules: ['required()'] },
      ]
    );
    expect(editGaps(task, right, before)).toEqual([]);
  });

  it('code-guided: синтаксическая ошибка — место в коде и «ничего не выполнилось»', async () => {
    const catalog = createToolCatalog(() => cliKnowledge(), {
      profile: 'node',
      guided: true,
      codeMode: createQuickJsSandbox(),
    });
    const result = await catalog.call(RUN_SCRIPT_TOOL, {
      code: 'console.log(await reformer.formEdit({dir:"form",edits:[{op:"add_rule",field:"phone",pattern":"x"}]}))',
    });
    const text = result.content.map((block) => (block.type === 'text' ? block.text : '')).join();
    expect(text).toMatch(/SyntaxError/);
    expect(text).toMatch(/⟪here⟫/);
    expect(text).toMatch(/Nothing in this script ran/);
  });
});

describe('скрытый ввод пароля — не поведение', () => {
  it('«ввод скрыт» не даёт этап поведения и не держит его от skip; видимость поля — даёт', () => {
    const task = 'пароль (password) — обязателен, минимум 8 символов, ввод скрыт;';
    expect(featuresFromText(task).behavior).toBe(false);
    expect(behaviorWord(task)).toBeUndefined();
    expect(featuresFromText('Адрес скрыт при самовывозе').behavior).toBe(true);
    expect(featuresFromText('password field, hidden input').behavior).toBe(false);
  });

  it('пример этапа поведения без подходящих полей — заглушки, а не total и address', () => {
    expect(stageExample('behavior', 'core')).not.toMatch(/"total"|"address"/);
    expect(stageExample('behavior', 'renderer-react')).toMatch(/<computed field>/);
  });
});

describe('сверка: формат email и маска в правке', () => {
  const form = (fields: Array<[string, string, Rec?]>, validation: Rec[] = []) =>
    readIntent({
      formName: 'F',
      target: 'renderer-react',
      fields: fields.map(([name, label, props]) => ({
        name,
        type: 'string',
        component: props?.mask ? 'InputMask' : 'Input',
        label,
        ...(props ? { componentProps: props } : {}),
      })),
      validation,
    }).intent!;

  it('«проверяется формат» у email без правила email — расхождение с готовой правкой', () => {
    const task = 'email (email) — обязателен, проверяется формат.';
    const missing = form([['email', 'Email']], [{ target: 'email', rules: ['required()'] }]);
    expect(taskGaps(task, missing).join('\n')).toMatch(
      /the task checks the format of email .* no "email" rule on it/
    );
    expect(gapFixes(task, missing)).toContainEqual({ op: 'add_rule', field: 'email', email: true });
    const done = form(
      [['email', 'Email']],
      [{ target: 'email', rules: ['required()', 'email()'] }]
    );
    expect(taskGaps(task, done).join('\n')).not.toMatch(/format of email/);
  });

  it('правка: поле с форматом задания без маски — расхождение', () => {
    const task = '3. Сразу после email добавь телефон (`phone`) с маской `+7 (999) 999-99-99`.';
    expect(
      editGaps(
        task,
        form([
          ['email', 'Email'],
          ['phone', 'Телефон'],
        ])
      )
    ).toEqual([
      '`phone` has no mask — the task gives its format +7 (999) 999-99-99: set_field "mask":"+7 (999) 999-99-99"',
    ]);
    expect(
      editGaps(
        task,
        form([
          ['email', 'Email'],
          ['phone', 'Телефон', { mask: '+7 (999) 999-99-99' }],
        ])
      )
    ).toEqual([]);
  });
});
