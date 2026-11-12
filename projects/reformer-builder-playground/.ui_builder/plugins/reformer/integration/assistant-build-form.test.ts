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
import { collectModelPaths } from '../core/form-model';
import { DOCUMENT_GRAMMAR_EXAMPLE } from '@reformer/mcp/intent';
import { createFakeProvider, type FakeStep } from '../../forms/ai/src/providers/fake';
import { bridgeTurn } from './bridge-turn';

const turn = (script: readonly FakeStep[], buildForm = true) =>
  bridgeTurn({ provider: createFakeProvider(script), buildForm });

describe('build_form целым ходом', () => {
  it('форма и правила примера ложатся в документ и код модуля', async () => {
    const { schema, rules, tools } = await turn([
      { tool: 'build_form', args: { intent: DOCUMENT_GRAMMAR_EXAMPLE } },
      { text: 'Готово.' },
    ]);
    const build = tools.find((tool) => tool.name === 'build_form');
    expect(build?.ok, build?.error).toBe(true);
    expect(collectModelPaths(schema)).toEqual(
      expect.arrayContaining(['loanType', 'price', 'quantity', 'total', 'propertyValue'])
    );
    expect(rules.validation.map((r) => r.target)).toEqual(
      expect.arrayContaining(['price', 'propertyValue', 'confirm'])
    );
    expect(rules.behavior.map((b) => b.kind)).toEqual(
      expect.arrayContaining(['compute', 'enableWhen', 'copyFrom', 'onChange'])
    );
    // Опции связи пережили печать в код модуля и обратное чтение (аудит 2026-11, D4).
    expect(rules.behavior.find((b) => b.kind === 'enableWhen')).toMatchObject({
      options: { resetOnDisable: true },
    });
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
