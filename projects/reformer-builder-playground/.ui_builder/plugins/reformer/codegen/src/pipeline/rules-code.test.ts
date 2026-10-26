/**
 * Правила формы живут в коде модуля — печать и чтение обязаны сходиться.
 *
 * Читатель (`core/codegen/rules-code`) узнаёт то, что печатает эта генерация, и ничего сверх. Два
 * свойства держат его в паре с печатью:
 *
 * - **чтение напечатанного** даёт исходные правила в канонической форме (`normalizeRules`):
 *   ничего не потеряно сверх того, что потерять названо;
 * - **печать прочитанного** байт в байт совпадает с первой печатью: генерация, которая читает
 *   правила из кода, перепечатывает модуль в то же самое — это и делает код источником истины.
 *
 * Наборы — все золотые наборы с правилами и корпус, в котором есть каждый вид правила.
 *
 * @module plugins/reformer/codegen/pipeline/rules-code.test
 */

import { describe, expect, it } from 'vitest';
import {
  builtinKit,
  partsRules,
  partsSchema,
  partsWizardSchema,
  plainSchema,
  rowRules,
  rowRulesSchema,
  seededRules,
  wizardRules,
  wizardRulesSchema,
  wizardSchema,
  wizardSlugsSchema,
} from '../../../core/testing';
import type { CodegenInput } from '../../../core/codegen';
import {
  isRuleCodePath,
  normalizeRules,
  readRulesFromCode,
  regenerableRules,
  RULE_TARGET_IDS,
  RULES_CODEGEN_STACK,
  type ModuleRuleCode,
} from '../../../core/codegen/rules-code';
import type { FormRules } from '../../../core/form-model';
import { generateModule } from './generate';
import { BUILTIN_TARGETS, CODEGEN_STACK_ID } from './targets';

const FORM_NAME = 'Заявка на кредит';

/** Корпус: каждый вид проверки и каждая из двенадцати связей, в форме и в строке массива. */
function corpus(): FormRules {
  return {
    validation: [
      { target: 'hasReferences', rules: ['required'] },
      { target: 'email', rules: ['required', 'email'] },
      {
        target: 'email2',
        rules: ["required({ code: 'email2.required' })"],
        code: 'email2.required',
        message: 'Укажите почту',
      },
      {
        target: 'confirm',
        rules: ['required'],
        cross: 'values.confirm === values.email',
        code: 'confirm.mismatch',
        message: 'Почты не совпадают',
      },
      { target: 'nick', rules: [], async: 'checkNick' },
      { target: 'phone', rules: ['minLength(5)'], when: 'model.hasReferences === true' },
      { target: 'references.name', each: 'references', rules: ['required', 'minLength(2)'] },
      {
        target: 'phone',
        each: 'references',
        rules: ['required'],
        when: 'model.hasReferences',
      },
      {
        target: 'references.noPhone',
        each: 'references',
        rules: [],
        cross: 'values.noPhone !== null',
      },
    ],
    behavior: [
      { kind: 'compute', target: 'total', sources: [], expr: 'model.price * model.qty' },
      {
        kind: 'computeFrom',
        target: 'fullName',
        sources: ['first', 'last'],
        expr: '`${first} ${last}`',
      },
      { kind: 'copyFrom', target: 'billing', sources: ['shipping'], options: { when: 'always' } },
      { kind: 'syncFields', target: 'a', sources: ['b'] },
      { kind: 'onChange', target: 'country', sources: [], expr: 'console.info(value);' },
      { kind: 'enableWhen', target: 'phone', sources: [], expr: 'model.hasReferences' },
      { kind: 'disableWhen', target: 'email', sources: [], expr: '!model.hasReferences' },
      {
        kind: 'resetWhen',
        target: 'city',
        sources: [],
        expr: 'model.country === null',
        options: { resetValue: '' },
      },
      { kind: 'transformValue', target: 'nick', sources: [], expr: 'value.trim()' },
      { kind: 'revalidateWhen', target: 'confirm', sources: ['email', 'confirm'] },
      { kind: 'exclusiveFlag', target: 'references.primary', each: 'references', sources: [] },
      { kind: 'aggregateInto', target: 'references', sources: [], expr: 'rows.length' },
      {
        kind: 'computeFrom',
        target: 'references.title',
        each: 'references',
        sources: ['references.name'],
        expr: 'name.toUpperCase()',
      },
      {
        kind: 'enableWhen',
        target: 'phone',
        each: 'references',
        sources: [],
        expr: '!item.noPhone',
      },
    ],
    render: rowRules().render,
  };
}

interface Case {
  readonly name: string;
  readonly input: CodegenInput;
}

const CASES: readonly Case[] = [
  { name: 'plain-rules', input: { schema: plainSchema(), rules: seededRules() } },
  { name: 'rows-rules', input: { schema: rowRulesSchema(), rules: rowRules() } },
  { name: 'parts-rules', input: { schema: partsSchema(), rules: partsRules() } },
  { name: 'parts-wizard-rules', input: { schema: partsWizardSchema(), rules: partsRules() } },
  { name: 'wizard-rules', input: { schema: wizardRulesSchema(), rules: wizardRules() } },
  { name: 'corpus', input: { schema: rowRulesSchema(), rules: corpus() } },
].map((c) => ({
  name: c.name,
  input: { ...c.input, formName: FORM_NAME, kit: builtinKit() } as CodegenInput,
}));

/** Файлы правил модуля — так, как их отдаст загрузчик. */
function ruleCodeOf(files: readonly { path: string; content: string }[]): ModuleRuleCode {
  const text = (path: string) => {
    const file = files.find((f) => f.path === path);
    return file === undefined ? undefined : { path, text: file.content };
  };
  const behavior = text('behavior/index.ts');
  const messages = text('validation/messages.ts');
  return {
    validation: files
      .filter((f) => /^validation\/[^/]+\.ts$/.test(f.path) && f.path !== 'validation/messages.ts')
      .map((f) => ({ path: f.path, text: f.content })),
    ...(behavior === undefined ? {} : { behavior }),
    ...(messages === undefined ? {} : { messages }),
    constants: files
      .filter((f) => /^constants\/[^/]+\.ts$/.test(f.path))
      .map((f) => ({ path: f.path, text: f.content })),
  };
}

/** Набор без порядка: у визарда правила разложены по файлам шагов, и порядок файлов — свой. */
const unordered = (list: readonly unknown[]) => list.map((item) => JSON.stringify(item)).sort();

describe.each(CASES)('правила в коде: $name', ({ input }) => {
  it('чтение напечатанного — исходные правила в канонической форме', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input);
    expect(module.problems).toEqual([]);
    const read = readRulesFromCode(ruleCodeOf(module.files));
    const expected = normalizeRules(input.rules!);

    expect(read.files.flatMap((file) => file.foreign)).toEqual([]);
    expect(unordered(read.rules.validation)).toEqual(unordered(expected.validation));
    expect(unordered(read.rules.behavior)).toEqual(unordered(expected.behavior));
    expect(unordered(read.rules.render)).toEqual(unordered(expected.render));
  });

  // Авторские файлы (тексты, константы, отправка) генерация пишет один раз и не перепечатывает:
  // их байты после первой печати — забота человека, а не неподвижной точки.
  it('печать прочитанного — байт в байт первая печать', async () => {
    const first = await generateModule(BUILTIN_TARGETS, input);
    const read = readRulesFromCode(ruleCodeOf(first.files));
    const second = await generateModule(BUILTIN_TARGETS, {
      ...input,
      rules: regenerableRules(read),
    });

    expect(second.problems).toEqual([]);
    expect(second.files.map((f) => f.path)).toEqual(first.files.map((f) => f.path));
    for (const file of second.files.filter((f) => f.cls === 'derived' || f.regenerable)) {
      expect(file.content, file.path).toBe(first.files.find((f) => f.path === file.path)?.content);
    }
  });
});

describe('правила в коде: заготовка', () => {
  it.each([
    ['простая форма', plainSchema()],
    ['визард', wizardSlugsSchema()],
  ])('%s без правил — заготовка из флагов схемы правилами не читается', async (_name, schema) => {
    const module = await generateModule(BUILTIN_TARGETS, {
      schema,
      formName: FORM_NAME,
      kit: builtinKit(),
    });
    const read = readRulesFromCode(ruleCodeOf(module.files));

    expect(read.rules.validation).toEqual([]);
    expect(read.files.some((file) => file.scaffold)).toBe(true);
  });

  it('визард без обязательных полей — заготовки нет, и правил тоже', async () => {
    const module = await generateModule(BUILTIN_TARGETS, {
      schema: wizardSchema(),
      formName: FORM_NAME,
      kit: builtinKit(),
    });
    expect(readRulesFromCode(ruleCodeOf(module.files)).rules.validation).toEqual([]);
  });

  it('заготовку правили руками — её операторы становятся правилами', async () => {
    const module = await generateModule(BUILTIN_TARGETS, {
      schema: plainSchema(),
      formName: FORM_NAME,
      kit: builtinKit(),
    });
    const code = ruleCodeOf(module.files);
    const edited = code.validation.map((file) => ({
      ...file,
      text: file.text.replace('[required()]', '[required(), minLength(3)]'),
    }));
    const read = readRulesFromCode({ ...code, validation: edited });

    expect(read.files[0]?.origin).toBe('edited');
    expect(read.rules.validation).toEqual([
      { target: 'fullName', rules: ['required()', 'minLength(3)'] },
    ]);
  });
});

describe('правила в коде: цели файлов правил', () => {
  it('список ядра — ровно встроенные цели, печатающие файлы правил', () => {
    // Им ассистент заказывает «только файлы правил»: цель, которой в нём нет, правила не запишет.
    const printing = BUILTIN_TARGETS.filter((target) =>
      isRuleCodePath(target.path.replace('{step}', 'step').replace('{dir}', 'form'))
    ).map((target) => target.id);
    expect([...printing].sort()).toEqual([...RULE_TARGET_IDS].sort());
  });

  it('вход с правилами адресован этому стеку', () => {
    expect(RULES_CODEGEN_STACK).toBe(CODEGEN_STACK_ID);
  });
});
