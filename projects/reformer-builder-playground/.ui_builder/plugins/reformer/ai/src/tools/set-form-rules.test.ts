/**
 * Гейты инструмента правил.
 *
 * Проверяется не «применилось ли», а то, что инструмент ОТКАЗЫВАЕТ там, где принятое правило
 * молча испортило бы форму. Разница принципиальная: неверная раскладка видна на канвасе сразу,
 * а неверное правило выглядит правдоподобно и ломается у пользователя — при сборке его проекта
 * или, хуже, в рантайме, где «поле почему-то не валидируется».
 */

import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '../../../core/testing';
import { describe, expect, it } from 'vitest';
import { createToolRegistry } from './registry';
import { setFormRulesTool } from './set-form-rules';
import { emptyRules, type FormRules } from '../../../core/form-model';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { ToolContext } from '../model/types';

/** Форма с тремя связанными полями — минимум, на котором видно и цикл, и двойную запись. */
function schema(): JsonFormSchema {
  return {
    format: 2,
    root: {
      component: '$html(div)',
      children: [
        { model: '$model(price)', component: '$component(Input)' },
        { model: '$model(quantity)', component: '$component(Input)' },
        { model: '$model(total)', component: '$component(Input)' },
      ],
    },
  } as unknown as JsonFormSchema;
}

const catalog = builtinEntries();
const reg = createToolRegistry([setFormRulesTool]);
const ctx = (rules: FormRules = emptyRules()): ToolContext => ({
  draft: schema(),
  base: schema(),
  rules,
  catalog,
  validateForm: validateFormSchema,
});

describe('set_form_rules', () => {
  it('правило на существующий путь принимается и возвращает новые правила', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      { validation: [{ target: 'price', rules: ['required'] }] },
      ctx()
    );
    expect(res.ok).toBe(true);
    expect(res.rules?.validation).toHaveLength(1);
    // Схему инструмент не трогает — правила живут отдельно от неё.
    expect(res.schema).toBeUndefined();
  });

  it('правило на несуществующее поле отвергается с подсказкой', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      { validation: [{ target: 'prise', rules: ['required'] }] },
      ctx()
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('STALE_POINTER');
    // Опечатка должна чиниться без лишнего шага хода.
    expect(res.error?.suggestions).toContain('price');
  });

  it('источник поведения тоже проверяется, не только цель', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      {
        behavior: [
          { kind: 'computeFrom', target: 'total', sources: ['price', 'quantitiy'], expr: '0' },
        ],
      },
      ctx()
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('STALE_POINTER');
  });

  it('цикл в вычисляемых полях отвергается', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      {
        behavior: [
          { kind: 'computeFrom', target: 'total', sources: ['price'], expr: '0' },
          { kind: 'computeFrom', target: 'price', sources: ['total'], expr: '0' },
        ],
      },
      ctx()
    );
    expect(res.ok).toBe(false);
    expect(res.text).toContain('Cycle');
  });

  it('два поведения на одно поле отвергаются', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      {
        behavior: [
          { kind: 'computeFrom', target: 'total', sources: ['price'], expr: '0' },
          { kind: 'copyFrom', target: 'total', sources: ['quantity'] },
        ],
      },
      ctx()
    );
    expect(res.ok).toBe(false);
    // Не «последнее выигрывает», а гонка: порядок зависит от того, как их разложил сборщик.
    expect(res.text).toContain('Two behaviours');
  });

  it('цикл ищется по ВСЕМ правилам, включая уже существующие', async () => {
    // Одиночный вызов выглядит безобидно; цикл возникает только вместе с тем, что уже есть.
    const existing: FormRules = {
      ...emptyRules(),
      behavior: [{ kind: 'computeFrom', target: 'total', sources: ['price'], expr: '0' }],
    };
    const res = await reg.invoke(
      'set_form_rules',
      { behavior: [{ kind: 'computeFrom', target: 'price', sources: ['total'], expr: '0' }] },
      ctx(existing)
    );
    expect(res.ok).toBe(false);
    expect(res.text).toContain('Cycle');
  });

  it('mode=replace заменяет набор, а не добавляет к нему', async () => {
    const existing: FormRules = {
      ...emptyRules(),
      validation: [{ target: 'price', rules: ['required'] }],
    };
    const res = await reg.invoke(
      'set_form_rules',
      { mode: 'replace', validation: [{ target: 'quantity', rules: ['required'] }] },
      ctx(existing)
    );
    expect(res.ok).toBe(true);
    expect(res.rules?.validation).toHaveLength(1);
    expect(res.rules?.validation[0].target).toBe('quantity');
  });
});

describe('set_form_rules — кросс-полевые и асинхронные проверки', () => {
  it('кросс-полевая проверка с текстом принимается; код выводится из цели', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      {
        validation: [
          { target: 'total', cross: 'values.total >= values.price', message: 'Итог меньше цены' },
        ],
      },
      ctx()
    );
    expect(res.ok).toBe(true);
    expect(res.rules?.validation).toEqual([
      {
        target: 'total',
        rules: [],
        cross: 'values.total >= values.price',
        code: 'totalCross',
        message: 'Итог меньше цены',
      },
    ]);
  });

  it('кросс-полевая проверка без текста отвергается: под полем стоял бы голый код', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      { validation: [{ target: 'total', cross: 'values.total >= values.price' }] },
      ctx()
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_PARAMS');
  });

  it('асинхронное правило принимается выражением; текст без кода — отказ', async () => {
    const async = 'async (value, { signal }) => (value ? null : { code: "taken" })';
    const ok = await reg.invoke(
      'set_form_rules',
      { validation: [{ target: 'price', async, code: 'taken', message: 'Занято' }] },
      ctx()
    );
    expect(ok.ok).toBe(true);
    expect(ok.rules?.validation[0]).toMatchObject({ async, code: 'taken', rules: [] });

    const noCode = await reg.invoke(
      'set_form_rules',
      { validation: [{ target: 'price', async, message: 'Занято' }] },
      ctx()
    );
    expect(noCode.ok).toBe(false);
  });

  it('правило без единой проверки отвергается', async () => {
    const res = await reg.invoke('set_form_rules', { validation: [{ target: 'price' }] }, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_PARAMS');
  });
});

describe('set_form_rules — связи строк массива', () => {
  /** Форма с массивом строк: количество, цена, сумма строки и флаг «основная». */
  function rowsSchema(): JsonFormSchema {
    return {
      format: 2,
      root: {
        component: '$html(div)',
        children: [
          {
            model: '$model(items)',
            component: '$component(FieldArray)',
            item: {
              $template: {
                component: '$html(div)',
                children: [
                  { model: '$model(qty)', component: '$component(Input)' },
                  { model: '$model(price)', component: '$component(Input)' },
                  { model: '$model(sum)', component: '$component(Input)' },
                  { model: '$model(primary)', component: '$component(Checkbox)' },
                ],
              },
            },
          },
        ],
      },
    } as unknown as JsonFormSchema;
  }
  const rowsCtx = (): ToolContext => ({ ...ctx(), draft: rowsSchema(), base: rowsSchema() });

  it('связь строки хранится полным путём, пути от строки принимаются', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      {
        behavior: [
          {
            kind: 'computeFrom',
            each: 'items',
            target: 'sum',
            sources: ['qty', 'items.price'],
            expr: 'qty * price',
          },
        ],
      },
      rowsCtx()
    );
    expect(res.ok).toBe(true);
    expect(res.rules?.behavior).toEqual([
      {
        kind: 'computeFrom',
        each: 'items',
        target: 'items.sum',
        sources: ['items.qty', 'items.price'],
        expr: 'qty * price',
      },
    ]);
  });

  it('флаг одной строки требует массив, итог по строкам — формулу', async () => {
    const flag = await reg.invoke(
      'set_form_rules',
      { behavior: [{ kind: 'exclusiveFlag', target: 'items.primary' }] },
      rowsCtx()
    );
    expect(flag.error?.code).toBe('INVALID_PARAMS');
    const total = await reg.invoke(
      'set_form_rules',
      { behavior: [{ kind: 'aggregateInto', target: 'items' }] },
      rowsCtx()
    );
    expect(total.error?.code).toBe('INVALID_PARAMS');

    const ok = await reg.invoke(
      'set_form_rules',
      {
        behavior: [
          { kind: 'exclusiveFlag', each: 'items', target: 'primary' },
          { kind: 'aggregateInto', target: 'items', expr: '[]' },
        ],
      },
      rowsCtx()
    );
    expect(ok.ok).toBe(true);
    expect(ok.rules?.behavior.map((b) => b.target)).toEqual(['items.primary', 'items']);
  });

  it('поле строки несуществующего массива — отказ с адресом полным путём', async () => {
    const res = await reg.invoke(
      'set_form_rules',
      { behavior: [{ kind: 'compute', each: 'rows', target: 'nope', expr: '1' }] },
      rowsCtx()
    );
    expect(res.error?.code).toBe('STALE_POINTER');
    expect(res.error?.message).toContain('rows.nope');
  });
});
