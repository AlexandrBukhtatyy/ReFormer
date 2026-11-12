/**
 * Модель гадает после ошибки (ReFormer-11oe.21, батч 20261111T195230Z-300a, qwen3.5:4b):
 *
 * - JSON Schema данных в `validate_form kind="json-schema"` называлась «прежним форматом» с советом
 *   `migrateJsonSchema` — модель пять раз переписывала документ под ложный совет;
 * - тот же вызов с тем же ответом не назывался повтором: правка файла до проверки не доходила, а
 *   модель этого не узнавала.
 */

import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createRepeatWatch } from '../src/core/server/repeat-calls';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { validateFormTool } from '../src/core/tools/validate-form';
import { cliKnowledge } from '../src/platform/cli/knowledge';

const k = cliKnowledge();

/** Схема из прогона qwen: обычная JSON Schema данных, не документ формы. */
const DATA_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: { city: { type: 'string' }, phone: { type: 'string' } },
  required: ['city', 'phone'],
};

const textOf = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content.map((item) => item.text ?? '').join('\n');

describe('validate_form json-schema: не документ формы', () => {
  it('JSON Schema данных — свой диагноз и путь через form_build, без migrateJsonSchema', async () => {
    const out = textOf(await validateFormTool({ kind: 'json-schema', schema: DATA_SCHEMA }, k));
    expect(out).toContain('# JSON schema — ❌ not a form document');
    expect(out).toContain('This is a JSON Schema of the data');
    expect(out).toContain('{ "format": 2, "root": { … } }');
    expect(out).toContain('write <dir>/form.intent.json and call form_build {"dir":"<dir>"}');
    expect(out).toContain('migrateJsonSchema will not help');
    expect(out).not.toContain('previous JSON schema format');
  });

  it('FormIntent — его проверяет kind="bundle"', async () => {
    const intent = { formName: 'Profile', fields: [{ name: 'city', type: 'string' }] };
    const out = textOf(await validateFormTool({ kind: 'json-schema', schema: intent }, k));
    expect(out).toContain('This is a FormIntent, not a form document.');
    expect(out).toContain('validate_form {"kind":"bundle","intent":…}');
  });

  it('без form_build (воркер билдера) — его не советует', async () => {
    const out = textOf(
      await validateFormTool({ kind: 'json-schema', schema: DATA_SCHEMA }, k, { formBuild: false })
    );
    expect(out).toContain('not a form document');
    expect(out).not.toContain('form_build');
  });

  it('документ прежнего формата (`root` без `format`) по-прежнему ведёт к migrateJsonSchema', async () => {
    const v1 = { root: { value: '$model(email)', component: '$component(Input)' } };
    const out = textOf(await validateFormTool({ kind: 'json-schema', schema: v1 }, k));
    expect(out).toMatch(/previous JSON schema format.*migrateJsonSchema/);
    expect(out).not.toContain('not a form document');
  });
});

describe('повтор вызова без перемен', () => {
  const answer = (text: string): CallToolResult => ({ content: [{ type: 'text', text }] });

  it('те же аргументы и тот же ответ — пометка с номером первого вызова и советом инструмента', () => {
    const watch = createRepeatWatch();
    const args = { kind: 'json-schema', schema: { b: 1, a: 2 } };
    expect(textOf(watch.observe(1, 'validate_form', args, answer('❌')))).toBe('❌');
    // Порядок ключей — не перемена.
    const second = textOf(
      watch.observe(
        2,
        'validate_form',
        { schema: { a: 2, b: 1 }, kind: 'json-schema' },
        answer('❌')
      )
    );
    expect(second).toContain(
      '> Repeated call: the same arguments and the same answer as call 1 — nothing changed between them.'
    );
    expect(second).toContain('an edit of a file does not reach it');
    expect(textOf(watch.observe(3, 'validate_form', args, answer('❌')))).toContain(
      'as call 1 (3 times now)'
    );
  });

  it('другой ответ на те же аргументы — не повтор: form_build после правки файла', () => {
    const watch = createRepeatWatch();
    const args = { dir: 'form' };
    watch.observe(1, 'form_build', args, answer('✗ 2 errors'));
    expect(textOf(watch.observe(2, 'form_build', args, answer('✗ 1 error')))).toBe('✗ 1 error');
    expect(textOf(watch.observe(3, 'form_build', args, answer('✗ 1 error')))).toContain(
      'as call 2 — nothing changed between them. form_build reads form.intent.json from disk'
    );
  });

  it('form_build с grammar: совет про grammar, а не «измени файл» [ReFormer-11oe.23]', () => {
    const watch = createRepeatWatch();
    const args = { dir: 'form', grammar: 'all' };
    watch.observe(1, 'form_build', args, answer('# grammar'));
    const second = textOf(watch.observe(2, 'form_build', args, answer('# grammar')));
    expect(second).toContain(
      'With "grammar" form_build returns the grammar only and builds nothing'
    );
    expect(second).toContain('without "grammar"');
    expect(second).not.toContain('change it before building');
  });

  it('другие аргументы или инструмент — не повтор; у прочих инструментов — без совета', () => {
    const watch = createRepeatWatch();
    watch.observe(1, 'search_docs', { query: 'a' }, answer('x'));
    expect(textOf(watch.observe(2, 'search_docs', { query: 'b' }, answer('x')))).toBe('x');
    expect(textOf(watch.observe(3, 'find_recipe', { query: 'a' }, answer('x')))).toBe('x');
    expect(textOf(watch.observe(4, 'search_docs', { query: 'a' }, answer('x')))).toBe(
      'x\n\n> Repeated call: the same arguments and the same answer as call 1 — nothing changed between them.'
    );
  });

  it('помнит не больше предела: давний вызов забыт', () => {
    const watch = createRepeatWatch(2);
    watch.observe(1, 'search_docs', { query: 'a' }, answer('x'));
    watch.observe(2, 'search_docs', { query: 'b' }, answer('x'));
    watch.observe(3, 'search_docs', { query: 'c' }, answer('x'));
    expect(textOf(watch.observe(4, 'search_docs', { query: 'a' }, answer('x')))).toBe('x');
  });

  it('через каталог: номер — порядковый номер вызова инструмента в сеансе', async () => {
    const catalog = createToolCatalog(cliKnowledge, { profile: 'node' });
    const args = { kind: 'json-schema', schema: DATA_SCHEMA };
    expect(textOf(await catalog.call('validate_form', args))).not.toContain('Repeated call');
    await catalog.call('find_recipe', { topic: 'copyFrom' });
    const third = textOf(await catalog.call('validate_form', args));
    expect(third).toContain('not a form document');
    expect(third).toContain('as call 1 — nothing changed between them.');
  });
});
