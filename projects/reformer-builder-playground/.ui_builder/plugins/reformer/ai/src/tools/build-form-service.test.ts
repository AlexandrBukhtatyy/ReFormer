/**
 * `build_form` и сервис ReFormer: что инструмент делает с ответами компилятора.
 *
 * Компилятор intent — сервис (`../service/compiler`): грамматику, вердикт судьи и документ раскладки
 * считает он. Сборку по настоящему вердикту проверяют тесты сервиса; здесь — ответы клиента на
 * каждый исход вызова, на заглушке компилятора.
 */

import { validateFormSchema } from '@reformer/renderer-json/validate';
import { describe, expect, it } from 'vitest';
import { builtinEntries } from '../../../core/testing';
import { emptyRules, emptySchema } from '../../../core/form-model';
import type { ToolContext } from '../model/types';
import type { FormCompiler, IntentVerdict } from '../service/compiler';
import { createBuildFormTool } from './build-form';

const catalog = builtinEntries();
const ctx: ToolContext = {
  draft: emptySchema(),
  base: emptySchema(),
  rules: emptyRules(),
  catalog,
  validateForm: validateFormSchema,
};

const GRAMMAR = '# intent — grammar\n(ответ сервиса)';
const DOWN = 'The ReFormer service is not connected: no API key.';

/** Компилятор с заданными ответами; вызовы судьи — в журнал. */
function compilerOf(answers: Partial<FormCompiler>): FormCompiler & { judged: unknown[] } {
  const judged: unknown[] = [];
  return {
    judged,
    grammar: answers.grammar ?? (async () => ({ ok: false, message: DOWN })),
    judge: async (intent, entries, signal) => {
      judged.push(intent);
      return answers.judge ? answers.judge(intent, entries, signal) : { ok: false, message: DOWN };
    },
  };
}

describe('build_form над сервисом ReFormer', () => {
  it('без intent — грамматика сервиса и правила, куда встаёт сборка', async () => {
    const tool = createBuildFormTool(
      compilerOf({
        grammar: async () => ({ ok: true, value: { grammar: GRAMMAR, sampleNames: [] } }),
      })
    );
    const out = await tool.run({}, ctx);
    expect(out.ok, out.text).toBe(true);
    expect(out.text.startsWith(GRAMMAR)).toBe(true);
    expect(out.text).toContain('## Where it lands');
  });

  it('сервис недоступен для грамматики — UNAVAILABLE с его причиной', async () => {
    const out = await createBuildFormTool(compilerOf({})).run({}, ctx);
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('UNAVAILABLE');
    expect(out.error?.message).toContain(DOWN);
  });

  it('сервис недоступен для судьи — UNAVAILABLE, черновик не тронут', async () => {
    const out = await createBuildFormTool(compilerOf({})).run(
      { intent: { fields: [{ name: 'email', component: 'Input' }] } },
      ctx
    );
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('UNAVAILABLE');
    expect(out.schema).toBeUndefined();
  });

  it('intent прочитан не целиком — отказ находками судьи, без своих проверок сборки', async () => {
    const verdict = {
      unread: true,
      errors: [{ code: 'not-an-object', message: 'intent must be a JSON object' }],
      warnings: [],
      // Прочитанного intent нет: свои проверки сборки (пустой intent, раскладка) не к чему применять.
      intent: {},
      document: {},
      sampleNames: [],
    } as unknown as IntentVerdict;
    const compiler = compilerOf({ judge: async () => ({ ok: true, value: verdict }) });
    const out = await createBuildFormTool(compiler).run({ intent: 'not json' }, ctx);
    expect(compiler.judged).toEqual(['not json']);
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_PARAMS');
    expect(out.error?.message).toContain('The intent was not read');
    expect(out.error?.message).toContain('intent must be a JSON object');
    expect(out.error?.message).toContain('1 problem:');
    expect(out.error?.message).toContain('Call build_form without intent for the grammar.');
  });
});
