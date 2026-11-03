/**
 * `build_form` целым ходом: мост ассистента, стек форм за флагом и настоящая генерация кода.
 *
 * Юнит-тесты инструмента проверяют сборку над черновиком. Здесь — что сборка доходит до проекта
 * так же, как правки остальных инструментов: документ формы — одной записью хода, правила — в код
 * модуля, отказ — без следа в документе. Модель сценарная (`providers/fake`): сети здесь нет.
 *
 * @module plugins/reformer/integration/assistant-build-form.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '../core/testing';
import { collectModelPaths } from '../core/form-model';
import { readRuleCode } from '../ai/src/stack/rule-code';
import { parseSchemaText, printSchemaText } from '../ai/src/model/schema-text';
import { createFakeFiles } from '../ai/src/stack/testing';
import { createSchemaFormStack } from '../ai/src/stack';
import { BUILD_FORM_EXAMPLE } from '../ai/src/tools/build-form/grammar';
import { createAgentBridge } from '../../forms/ai/src/session/bridge';
import { createAiSession } from '../../forms/ai/src/session/session';
import { createProviderRegistry } from '../../forms/ai/src/providers/registry';
import { createFakeProvider, type FakeStep } from '../../forms/ai/src/providers/fake';
import type { AiAssistant } from '../../forms/ai/src/plugin';
import { createFakeHost } from '../../forms/ai/src/testing';
import { generatorOver } from './codegen-harness';

const DOCUMENT = 'forms/eval/schema/form.schema.json';

const EMPTY: JsonFormSchema = {
  format: 2,
  version: '1.0',
  root: { component: '$component(Box)', componentProps: { className: 'space-y-4' }, children: [] },
} as unknown as JsonFormSchema;

/** Ход по пустой форме со сценарием модели; стек — с `build_form` или без. */
async function turn(script: readonly FakeStep[], buildForm = true) {
  const files = createFakeFiles();
  const host = createFakeHost(files);
  const codegen = generatorOver({ files, documentOf: (id) => host.documentOf(id) });
  files.put(DOCUMENT, printSchemaText(EMPTY));
  host.openDocument(DOCUMENT, printSchemaText(EMPTY));

  const providers = createProviderRegistry();
  const provider = createFakeProvider(script);
  const seen: string[][] = [];
  providers.register({
    ...provider,
    stream: (req, signal) => {
      seen.push(req.tools.map((tool) => tool.name));
      return provider.stream(req, signal);
    },
  });
  const assistant = {
    providers,
    loadConfig: () => Promise.resolve({ kind: 'anthropic' as const }),
    saveConfig: () => Promise.resolve(),
    clearConfig: () => Promise.resolve(),
    models: () => Promise.resolve([]),
    activate: () => Promise.reject(new Error('не нужно в тесте')),
    restore: () => Promise.resolve(null),
  } as unknown as AiAssistant;

  const session = createAiSession();
  const stack = createSchemaFormStack({
    catalog: () => builtinEntries(),
    validateForm: () => Promise.resolve(validateFormSchema),
    scopeOf: (id) => files.scopeOf(id),
    generator: () => codegen,
    ...(buildForm ? { buildForm: true } : {}),
  });
  const bridge = createAgentBridge({
    assistant,
    host,
    session,
    agentCommands: () => [],
    executeCommand: () => Promise.resolve(undefined),
    stacks: () => [stack],
    generator: () => codegen,
    formCreator: () => undefined,
  });
  await bridge.send('Собери форму.');

  const text = host.documentOf(DOCUMENT)?.getText() ?? '';
  const { rules } = await readRuleCode(files, DOCUMENT, DOCUMENT);
  const tools = session
    .get()
    .entries.filter((entry) => entry.role === 'assistant')
    .flatMap((entry) => entry.tools);
  return { schema: parseSchemaText(text), rules, tools, seen, host };
}

describe('build_form целым ходом', () => {
  it('форма и правила примера ложатся в документ и код модуля', async () => {
    const { schema, rules, tools } = await turn([
      { tool: 'build_form', args: { intent: BUILD_FORM_EXAMPLE } },
      { text: 'Готово.' },
    ]);
    const build = tools.find((tool) => tool.name === 'build_form');
    expect(build?.ok, build?.error).toBe(true);
    expect(collectModelPaths(schema)).toEqual(
      expect.arrayContaining(['email', 'kind', 'inn', 'price', 'qty', 'total'])
    );
    expect(rules.validation.map((r) => r.target)).toEqual(
      expect.arrayContaining(['email', 'inn', 'qty'])
    );
    expect(rules.behavior.map((b) => b.kind)).toEqual(
      expect.arrayContaining(['compute', 'copyFrom', 'enableWhen'])
    );
    expect(rules.render).toEqual([expect.objectContaining({ kind: 'hideWhen' })]);
  });

  it('отказ сборки не оставляет следа в документе', async () => {
    const { schema, tools } = await turn([
      { tool: 'build_form', args: { intent: { fields: [{ name: 'a', component: 'NoSuch' }] } } },
      { text: 'Не вышло.' },
    ]);
    expect(tools.find((tool) => tool.name === 'build_form')?.ok).toBe(false);
    expect(collectModelPaths(schema)).toEqual([]);
  });

  it('без флага модели build_form не виден', async () => {
    const flagged = await turn([{ text: 'Ок.' }]);
    const plain = await turn([{ text: 'Ок.' }], false);
    expect(flagged.seen[0]).toContain('build_form');
    expect(plain.seen[0]).not.toContain('build_form');
  });
});
