/**
 * Гейты инструмента правил.
 *
 * Проверяется не «применилось ли», а то, что инструмент ОТКАЗЫВАЕТ там, где принятое правило
 * молча испортило бы форму. Разница принципиальная: неверная раскладка видна на канвасе сразу,
 * а неверное правило выглядит правдоподобно и ломается у пользователя — при сборке его проекта
 * или, хуже, в рантайме, где «поле почему-то не валидируется».
 */

import { describe, expect, it } from 'vitest';
import { createToolRegistry } from '../registry';
import { setFormRulesTool } from './set-form-rules';
import { emptyRules, type FormRules } from '../../../model/rules';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { ToolContext } from '../types';

/** Форма с тремя связанными полями — минимум, на котором видно и цикл, и двойную запись. */
function schema(): JsonFormSchema {
  return {
    root: {
      component: '$html(div)',
      children: [
        { value: '$model(price)', component: '$component(Input)' },
        { value: '$model(quantity)', component: '$component(Input)' },
        { value: '$model(total)', component: '$component(Input)' },
      ],
    },
  } as unknown as JsonFormSchema;
}

const reg = createToolRegistry([setFormRulesTool]);
const ctx = (rules: FormRules = emptyRules()): ToolContext => ({
  draft: schema(),
  base: schema(),
  rules,
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
