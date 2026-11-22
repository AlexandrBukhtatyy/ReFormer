/**
 * Правила формы глазами хода: чтение из кода модуля, сверка, отказы запертых правил.
 *
 * Запись генерацией с настоящим генератором проверяет интеграция
 * (`reformer/integration/assistant-bridge.test`); здесь — дверь записи хода с генератором-двойником.
 *
 * @module plugins/reformer/ai/stack/rule-code.test
 */

import { describe, expect, it } from 'vitest';
import type { GenerateRequest, ModuleGeneratorService } from '@reformer/builder-plugin-api';
import { emptyRules } from '../../../core/form-model';
import { withMarker } from '@reformer/builder-toolkit';
import { legacyRulesText as printRulesText } from '../../../core/testing';
import {
  readRuleCode,
  ruleFilesUnchanged,
  rulesLockOf,
  sameRules,
  writeModuleCode,
} from './rule-code';
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

describe('печать модуля после хода', () => {
  /** Генератор-двойник: печатает `printed` дверью заказчика и запоминает заказ. */
  function printing(
    printed: Readonly<Record<string, string>>,
    skipped: { path: string; reason: 'edited' | 'authored' | 'refused' }[] = []
  ) {
    const requests: GenerateRequest[] = [];
    const generator: ModuleGeneratorService = {
      async generate(_document, request = {}) {
        requests.push(request);
        const written: string[] = [];
        for (const [path, text] of Object.entries(printed)) {
          const refused = await request.write?.(`forms/login/${path}`, text);
          if (refused === null || refused === undefined) written.push(path);
          else skipped.push({ path, reason: 'refused' });
        }
        return { ok: true, formName: 'login', dir: 'forms/login', written, skipped, failed: [] };
      },
    };
    return { generator, requests };
  }

  const baseOf = async (files: ReturnType<typeof createFakeFiles>) => {
    const { rules: _rules, ...base } = await readRuleCode(files, DOC, DOC);
    return base;
  };

  it('модуль — целиком; тот же текст не пишется, созданный файл — без «до»', async () => {
    const files = createFakeFiles({
      [DOC]: '{}',
      'forms/login/application/create.ts': 'тот же\n',
      'forms/login/model/model.ts': 'старый\n',
    });
    const { generator, requests } = printing({
      'application/create.ts': 'тот же\n',
      'model/model.ts': 'новый\n',
      'application/flow.ts': 'поток\n',
    });

    const outcome = await writeModuleCode(
      { files, generator, refuse: () => null },
      {
        document: DOC,
        base: await baseOf(files),
        rules: emptyRules(),
        rulesChanged: false,
        mark: { origin: 'agent', txId: 't1' },
      }
    );

    // Заказ — весь модуль, с правилами хода.
    expect(requests[0].only).toBeUndefined();
    expect(requests[0].stackInput).toBeDefined();
    expect(outcome.companions).toEqual([
      { id: 'forms/login/model/model.ts', before: 'старый\n', after: 'новый\n' },
      { id: 'forms/login/application/flow.ts', before: null, after: 'поток\n' },
    ]);
    expect(files.writes.map((write) => write.path)).toEqual([
      'forms/login/model/model.ts',
      'forms/login/application/flow.ts',
    ]);
    expect(files.writes.every((write) => write.mark?.txId === 't1')).toBe(true);
    expect(outcome.code).toEqual({ dir: 'forms/login', written: 2, kept: [] });
    expect(outcome.problem).toBeUndefined();
  });

  it('документ формы дверь не отдаёт — генерация его не пишет', async () => {
    const files = createFakeFiles({ [DOC]: '{}' });
    const { generator } = printing({ 'schema/form.schema.json': '{"x":1}', 'index.ts': 'i\n' });

    const outcome = await writeModuleCode(
      { files, generator, refuse: (id) => (id === DOC ? 'the form document' : null) },
      { document: DOC, base: await baseOf(files), rules: emptyRules(), rulesChanged: false }
    );

    expect(files.text(DOC)).toBe('{}');
    expect(outcome.companions.map((file) => file.id)).toEqual(['forms/login/index.ts']);
  });

  it('правленный руками файл правил — отказ, только когда ход менял правила', async () => {
    const files = createFakeFiles({ [DOC]: '{}' });
    const edited = [{ path: 'validation/form.ts', reason: 'edited' as const }];
    const request = {
      document: DOC,
      base: await baseOf(files),
      rules: emptyRules(),
    };

    const kept = await writeModuleCode(
      { files, generator: printing({}, [...edited]).generator, refuse: () => null },
      { ...request, rulesChanged: false }
    );
    expect(kept.problem).toBeUndefined();
    expect(kept.code?.kept).toEqual(['validation/form.ts']);

    const refused = await writeModuleCode(
      { files, generator: printing({}, [...edited]).generator, refuse: () => null },
      { ...request, rulesChanged: true }
    );
    expect(refused.problem).toEqual({
      id: FORM_RULES,
      error: 'the file was edited by hand, code generation keeps it',
    });
  });

  it('генерация упала — отказ с причиной, а не исключение', async () => {
    const files = createFakeFiles({ [DOC]: '{}' });
    const generator: ModuleGeneratorService = {
      generate: () => Promise.reject(new Error('печатник упал')),
    };

    const outcome = await writeModuleCode(
      { files, generator, refuse: () => null },
      { document: DOC, base: await baseOf(files), rules: emptyRules(), rulesChanged: true }
    );

    expect(outcome.problem?.error).toBe('печатник упал');
    expect(outcome.code).toBeUndefined();
  });
});
