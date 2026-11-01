/**
 * Неверный вызов инструмента — ошибка выполнения (`isError: true`), а не успешный ответ.
 *
 * По спецификации MCP (2025-11-25) ошибка проверки входа — ошибка инструмента: клиент видит
 * неудачу, модель — что вызов надо поправить. Калибровка (smoke S12) нашла, что все такие ответы
 * приходили успешными: Inspector CLI отдавал exit 0, а `&&`-цепочка CI шла дальше.
 */

import { describe, expect, it } from 'vitest';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { cliKnowledge } from '../src/platform/cli/knowledge';

const catalog = createToolCatalog(cliKnowledge, { profile: 'node' });

const INVALID_CALLS: Array<[string, Record<string, unknown>]> = [
  ['choose_api', {}],
  ['find_recipe', {}],
  ['find_recipe', { topic: '   ' }],
  ['get_symbol_docs', {}],
  ['search_docs', { query: 123 }],
  ['get_context', {}],
  ['validate_form', {}],
  ['validate_form', { kind: 'unknown' }],
  ['generate_form', {}],
  ['plan_form', {}],
  ['plan_form', { specPath: 'нет/такой/спеки.md' }],
  ['report_issue', {}],
  ['check_behaviors', {}],
];

describe('неверный вызов — isError', () => {
  it.each(INVALID_CALLS)('%s %j', async (name, args) => {
    const result = await catalog.call(name, args);
    expect(result.isError).toBe(true);
    // Текст по-прежнему объясняет, чего не хватает.
    expect(result.content[0]).toMatchObject({ type: 'text' });
    expect(String((result.content[0] as { text: string }).text).length).toBeGreaterThan(20);
  });

  it('get_symbol_docs без symbol называет аргумент, а не ищет "undefined"', async () => {
    const result = await catalog.call('get_symbol_docs', {});
    expect((result.content[0] as { text: string }).text).toMatch(/"symbol" is required/);
  });

  it('правильный вызов и ответ «не найдено» — не ошибка', async () => {
    expect(
      (await catalog.call('choose_api', { requirement: 'total = price * quantity' })).isError
    ).toBeUndefined();
    expect(
      (await catalog.call('get_symbol_docs', { symbol: 'NoSuchSymbolAnywhere' })).isError
    ).toBeUndefined();
  });
});
