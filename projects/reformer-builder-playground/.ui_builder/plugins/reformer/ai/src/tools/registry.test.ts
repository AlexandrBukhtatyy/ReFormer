/**
 * Реестр над инструментами ReFormer. Поведение реестра (проверка аргументов, отказы, бюджет,
 * загрузка движка) проверяет `@reformer/builder-toolkit`; здесь — что инструменты редактора в нём
 * живут: схемы аргументов компилируются, имена подсказываются, контекст черновика доходит.
 */

import { describe, expect, it } from 'vitest';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { emptyRules } from '../../../core/form-model';
import { builtinEntries } from '../../../core/testing';
import { sampleSchema } from '../../../core/testing';
import { createToolRegistry } from './registry';
import { readOnlyTools } from '../tools';
import type { ToolContext } from '../model/types';

const ctx = (): ToolContext => {
  const schema = sampleSchema();
  return {
    draft: schema,
    base: schema,
    rules: emptyRules(),
    catalog: builtinEntries(),
    validateForm: validateFormSchema,
  };
};

describe('реестр инструментов ReFormer', () => {
  it('list фильтрует по readOnly', () => {
    const reg = createToolRegistry(readOnlyTools());
    expect(reg.list()).toHaveLength(readOnlyTools().length);
    expect(reg.list({ readOnly: true })).toHaveLength(readOnlyTools().length);
    expect(reg.list({ readOnly: false })).toHaveLength(0);
  });

  it('неизвестный инструмент → UNKNOWN_TOOL с похожими именами', async () => {
    const res = await createToolRegistry(readOnlyTools()).invoke('get_form_outlines', {}, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('UNKNOWN_TOOL');
    expect(res.error?.suggestions).toContain('get_form_outline');
  });

  it('инструмент без обязательных полей вызывается без аргументов', async () => {
    const reg = createToolRegistry(readOnlyTools());
    expect((await reg.invoke('get_form_outline', undefined, ctx())).ok).toBe(true);
  });
});
