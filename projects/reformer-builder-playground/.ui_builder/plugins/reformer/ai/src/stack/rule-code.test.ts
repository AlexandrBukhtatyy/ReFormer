/**
 * Правила формы глазами хода: чтение из кода модуля, сверка, отказы запертых правил.
 *
 * Запись генерацией проверяется с настоящим генератором — в интеграции
 * (`reformer/integration/assistant-bridge.test`).
 *
 * @module plugins/reformer/ai/stack/rule-code.test
 */

import { describe, expect, it } from 'vitest';
import { withMarker } from '@reformer/builder-toolkit';
import { legacyRulesText as printRulesText } from '../../../core/testing';
import { readRuleCode, ruleFilesUnchanged, rulesLockOf, sameRules } from './rule-code';
import { createFakeFiles } from './testing';

const DOC = 'forms/login/schema/form.schema.json';
const FORM_RULES = 'forms/login/validation/form.ts';
const BEHAVIOR = 'forms/login/behavior/index.ts';

/** Файл правил формы, как его печатает генерация: одно правило на почту. */
const formRules = (body: string) =>
  withMarker(
    "import { defineValidation, validate } from '@reformer/core/validation';\n" +
      "import { required } from '@reformer/core/validators';\n\n" +
      `export const formRules = defineValidation<LoginForm>(({ model }) => {\n${body}});\n`
  );

describe('код правил на начало хода', () => {
  it('правила — из кода модуля; код у модуля есть, запертых файлов нет', async () => {
    const files = createFakeFiles({
      [DOC]: '{}',
      [FORM_RULES]: formRules('  validate(model.$.email, [required()]);\n'),
    });
    const read = await readRuleCode(files, DOC, DOC);

    expect(read.rules.validation).toEqual([{ target: 'email', rules: ['required()'] }]);
    expect(read.hasCode).toBe(true);
    expect(read.locked).toEqual([]);
    expect(read.texts.get(FORM_RULES)).toBe(files.text(FORM_RULES));
  });

  it('модуля нет — кода нет, правил нет', async () => {
    const read = await readRuleCode(createFakeFiles({ [DOC]: '{}' }), DOC, DOC);
    expect(read.hasCode).toBe(false);
    expect(read.rules.validation).toEqual([]);
  });

  it('правленный руками файл правил — заперт', async () => {
    const files = createFakeFiles({
      [DOC]: '{}',
      [FORM_RULES]: `${formRules('  validate(model.$.email, [required()]);\n')}// правка\n`,
    });
    const read = await readRuleCode(files, DOC, DOC);
    expect(read.locked).toEqual(['validation/form.ts']);
    // Правила правленого файла ход всё равно видит: их показывают модели.
    expect(read.rules.validation).toHaveLength(1);
  });

  it('в коде правил нет — правила хода начинаются с прежнего form.rules.json', async () => {
    const legacy = {
      validation: [{ target: 'email', rules: ['required'] }],
      behavior: [],
      render: [],
    };
    const files = createFakeFiles({
      [DOC]: '{}',
      'forms/login/schema/form.rules.json': printRulesText(legacy),
    });
    const read = await readRuleCode(files, DOC, DOC);
    expect(sameRules(read.rules, legacy)).toBe(true);
  });

  it('сверка: правка любого прочитанного файла правил — расхождение', async () => {
    const files = createFakeFiles({
      [DOC]: '{}',
      [FORM_RULES]: formRules('  validate(model.$.email, [required()]);\n'),
    });
    const read = await readRuleCode(files, DOC, DOC);
    expect(await ruleFilesUnchanged(files, read)).toBe(true);
    files.put(FORM_RULES, formRules(''));
    expect(await ruleFilesUnchanged(files, read)).toBe(false);
  });
});

describe('запертые правила', () => {
  const base = {
    root: 'forms/login',
    rootPath: 'forms/login',
    texts: new Map(),
    hasCode: true,
  };

  it('без генерации заперто всё — «недоступно»', () => {
    const lock = rulesLockOf({ ...base, locked: [] }, false);
    expect(lock?.validation?.code).toBe('UNAVAILABLE');
    expect(lock?.behavior?.code).toBe('UNAVAILABLE');
    expect(lock?.dataSources?.code).toBe('UNAVAILABLE');
  });

  it('правленный файл валидации запирает валидацию, но не поведение', () => {
    const lock = rulesLockOf({ ...base, locked: ['validation/form.ts'] }, true);
    expect(lock?.validation).toMatchObject({ code: 'REFUSED' });
    expect(lock?.validation?.message).toContain('validation/form.ts');
    expect(lock?.behavior).toBeUndefined();
  });

  it('правленный файл поведения запирает поведение', () => {
    const lock = rulesLockOf({ ...base, locked: [BEHAVIOR.slice('forms/login/'.length)] }, true);
    expect(lock?.behavior).toMatchObject({ code: 'REFUSED' });
    expect(lock?.validation).toBeUndefined();
  });

  it('ничего не заперто — отказов нет', () => {
    expect(rulesLockOf({ ...base, locked: [] }, true)).toBeUndefined();
  });
});
