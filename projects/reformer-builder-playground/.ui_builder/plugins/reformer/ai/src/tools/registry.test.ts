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
import { allTools, readOnlyTools } from '../tools';
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

  it('словари в аргументах — только с именами в ключах', () => {
    // Ключ словаря модель пишет в вызове сама, а gemma4 пишет ключи без кавычек: адрес узла, путь
    // модели или имя со знаком в ключе Ollama не разбирала и выбрасывала вызов целиком — ход
    // кончался пустым ответом (ReFormer-qsm8.11). Здесь ключи — имена свойств, полей узла и
    // источников данных. Данные с другими ключами передаются списком, как `edits`.
    const maps: string[] = [];
    for (const tool of allTools()) freeMaps(tool.inputSchema, tool.name, maps);
    expect(maps).toEqual([
      'insert_node.nodes[].props',
      'insert_node.nodes[].children[]',
      'set_node_prop.props',
      'set_node_prop.edits[].props',
      'set_form_rules.dataSources',
      'set_render_rules.rules[].props',
    ]);
  });
});

/** Адреса объектов схемы аргументов, ключи которых выбирает модель. */
function freeMaps(schema: unknown, path: string, out: string[]): void {
  if (schema === null || typeof schema !== 'object') return;
  const node = schema as Record<string, unknown>;
  if (node.type === 'object' && node.additionalProperties !== false && !node.properties) {
    out.push(path);
  }
  const properties = (node.properties ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(properties)) freeMaps(value, `${path}.${key}`, out);
  if (node.items !== undefined) freeMaps(node.items, `${path}[]`, out);
  if (typeof node.additionalProperties === 'object') {
    freeMaps(node.additionalProperties, `${path}{}`, out);
  }
}
