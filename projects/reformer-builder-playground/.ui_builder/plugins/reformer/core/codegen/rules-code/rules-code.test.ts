/**
 * Читатель правил из кода — на том, чего нет в отпечатках генерации: записи, которые оставляет
 * prettier, чужие операторы, происхождение файла, тексты и значения источников, загрузчик и
 * точечная правка авторских файлов.
 *
 * Пара «печать — чтение» на всех видах правил держится тестом рядом с генерацией
 * (`codegen/src/pipeline/rules-code.test.ts`).
 *
 * @module plugins/reformer/core/codegen/rules-code/rules-code.test
 */

import { describe, expect, it } from 'vitest';
import { withMarker } from '@reformer/builder-toolkit';
import {
  isRuleCodePath,
  loadRulesFromModule,
  readRulesFromCode,
  regenerableRules,
  type ModuleRuleCode,
} from '.';
import { patchConstants, patchMessages } from './patch';

const VALIDATION = `
import { defineValidation, validate, validateWhen, cross } from '@reformer/core/validation';

export const formRules = defineValidation<Form>(({ model, cross }) => {
  validate(model.$.email, [
    required({ code: 'email.required' }),
  ]);
  // кросс-проверка — уже после prettier: одни скобки вместо двух
  cross(model.$.confirm, (values) => (values.confirm === values.email ? null : { code: 'confirm.mismatch' }));
  validateWhen(
    () => model.hasPhone,
    () => {
      validate(model.$.phone, [required(), minLength(5)]);
    },
  );
});
`;

const code = (validation: string, extra: Partial<ModuleRuleCode> = {}): ModuleRuleCode => ({
  validation: [{ path: 'validation/form.ts', text: validation }],
  constants: [],
  ...extra,
});

describe('валидация', () => {
  it('записи после prettier читаются теми же правилами', () => {
    const read = readRulesFromCode(code(VALIDATION));
    expect(read.rules.validation).toEqual([
      { target: 'email', rules: ["required({ code: 'email.required' })"], code: 'email.required' },
      {
        target: 'confirm',
        rules: [],
        cross: 'values.confirm === values.email',
        code: 'confirm.mismatch',
      },
      // Несколько проверок одного validate — правило на проверку: у каждой свой код и текст.
      { target: 'phone', when: 'model.hasPhone', rules: ['required()'] },
      { target: 'phone', when: 'model.hasPhone', rules: ['minLength(5)'] },
    ]);
    expect(read.files[0]?.foreign).toEqual([]);
  });

  it('тексты проверок одного validate — у каждой свой, из словаря по её коду', () => {
    const text = `export const formRules = defineValidation<Form>(({ model }) => {
  validate(model.$.price, [required({ code: 'price.required' }), min(1, { code: 'price.min' }), max(9)]);
});`;
    const messages = `export const formMessages = defineIssueMessages({
  'price.required': 'Укажите цену',
  'price.min': 'Не меньше 1',
});`;
    const read = readRulesFromCode(
      code(text, { messages: { path: 'validation/messages.ts', text: messages } })
    );
    expect(read.rules.validation).toEqual([
      {
        target: 'price',
        rules: ["required({ code: 'price.required' })"],
        code: 'price.required',
        message: 'Укажите цену',
      },
      {
        target: 'price',
        rules: ["min(1, { code: 'price.min' })"],
        code: 'price.min',
        message: 'Не меньше 1',
      },
      { target: 'price', rules: ['max(9)'] },
    ]);
  });

  it('текст правила — из словаря по его коду', () => {
    const messages = `export const formMessages = defineIssueMessages({
  required: 'Обязательное поле',
  'email.required': 'Укажите email',
  'confirm.mismatch': 'Почты не совпадают',
});`;
    const read = readRulesFromCode(
      code(VALIDATION, { messages: { path: 'validation/messages.ts', text: messages } })
    );
    expect(read.rules.validation.map((rule) => rule.message)).toEqual([
      'Укажите email',
      'Почты не совпадают',
      undefined,
      undefined,
    ]);
  });

  it('оператор, которого читатель не знает, — чужой, со строкой, а не потерян молча', () => {
    const text = `export const formRules = defineValidation<Form>(({ model }) => {
  validate(model.$.a, [required()]);
  if (model.b) validate(model.$.b, [required()]);
  validate(form.c, [required()]);
});`;
    const read = readRulesFromCode(code(text));
    expect(read.rules.validation).toEqual([{ target: 'a', rules: ['required()'] }]);
    expect(read.files[0]?.foreign.map((piece) => piece.line)).toEqual([3, 4]);
  });

  it('происхождение — по маркеру: правленный файл генерации в перепечать не идёт', () => {
    const generated = withMarker(VALIDATION);
    const edited = generated.replace('minLength(5)', 'minLength(6)');
    expect(readRulesFromCode(code(generated)).files[0]?.origin).toBe('generated');
    const read = readRulesFromCode(code(edited));
    expect(read.files[0]?.origin).toBe('edited');
    expect(read.rules.validation).toHaveLength(4);
    expect(regenerableRules(read).validation).toEqual([]);
  });
});

describe('поведение', () => {
  const BEHAVIOR = `
const referencesRow = defineFormBehavior<Row>(({ model, schema }) => {
  hideWhen(schema.node('ref-phone'), () => model.noPhone);
});

export function behaviorRules({ model, form, schema }: BehaviorScope<Form>): void {
  // Связи над моделью
  computeFrom([model.$.price, model.$.qty], model.$.total, (price, qty) => price * qty);
  applyEach(
    model.$.items,
    defineFormBehavior(({ model: item }) => {
      compute(item.$.sum, () => item.price * item.qty);
    }),
  );
  schema.node('full-name').patchProps({ placeholder: 'Иванов', disabled: !form.agreed.value.value });
  onComponentEvent(schema.node('full-name'), 'onBlur', async (...args: unknown[]) => {
    void args;
    await save(form);
  });
  applyEach(model.$.references, referencesRow);
}

export const formBehavior = defineFormBehavior<Form>(behaviorRules);
`;

  it('связи, связи строк, правила узлов всех областей; ссылки на области — каркас', () => {
    const read = readRulesFromCode({
      validation: [],
      behavior: { path: 'behavior/index.ts', text: BEHAVIOR },
      constants: [],
    });
    expect(read.files[0]?.foreign).toEqual([]);
    expect(read.rules.behavior).toEqual([
      {
        kind: 'computeFrom',
        target: 'total',
        sources: ['price', 'qty'],
        expr: 'price * qty',
      },
      {
        kind: 'compute',
        target: 'items.sum',
        each: 'items',
        sources: ['items.price', 'items.qty'],
        expr: 'item.price * item.qty',
      },
    ]);
    expect(read.rules.render).toEqual([
      { kind: 'hideWhen', selector: 'ref-phone', condition: 'model.noPhone' },
      {
        kind: 'patchProps',
        selector: 'full-name',
        props: { placeholder: 'Иванов', disabled: '$expr(!form.agreed.value.value)' },
      },
      {
        kind: 'onEvent',
        selector: 'full-name',
        event: 'onBlur',
        body: 'await save(form);',
        async: true,
      },
    ]);
  });
});

describe('копирование с условием', () => {
  const BEHAVIOR = `
export function behaviorRules({ model }: BehaviorScope<Form>): void {
  copyFrom(model.$.email, model.$.billing, { when: () => model.same === true });
  copyFrom(model.$.city, model.$.residence);
}

export const formBehavior = defineFormBehavior<Form>(behaviorRules);
`;

  it('условие when читается обратно в expr связи — так его печатает генерация', () => {
    const read = readRulesFromCode({
      validation: [],
      behavior: { path: 'behavior/index.ts', text: BEHAVIOR },
      constants: [],
    });
    expect(read.files[0]?.foreign).toEqual([]);
    expect(read.rules.behavior).toEqual([
      { kind: 'copyFrom', target: 'billing', sources: ['email'], expr: 'model.same === true' },
      { kind: 'copyFrom', target: 'residence', sources: ['city'] },
    ]);
  });
});

describe('вычисление с условием', () => {
  // MCP печатает `when` связи вычисления третьим (у computeFrom — четвёртым) аргументом
  // (ReFormer-j356.4.21, A8); без чтения его обратно сторож записи не пустил бы файл правил.
  const BEHAVIOR = `
export function behaviorRules({ model }: BehaviorScope<Form>): void {
  compute(model.$.fee, () => model.price * 0.01, { when: () => model.kind === 'm' });
  computeFrom([model.$.price], model.$.down, (price) => price * 0.2, { when: () => model.kind === 'm' });
  compute(model.$.total, () => model.price * 2);
}

export const formBehavior = defineFormBehavior<Form>(behaviorRules);
`;

  it('when читается обратно в when связи, без него — как было', () => {
    const read = readRulesFromCode({
      validation: [],
      behavior: { path: 'behavior/index.ts', text: BEHAVIOR },
      constants: [],
    });
    expect(read.files[0]?.foreign).toEqual([]);
    expect(read.rules.behavior).toEqual([
      {
        kind: 'compute',
        target: 'fee',
        sources: ['price'],
        expr: 'model.price * 0.01',
        when: "model.kind === 'm'",
      },
      {
        kind: 'computeFrom',
        target: 'down',
        sources: ['price'],
        expr: 'price * 0.2',
        when: "model.kind === 'm'",
      },
      // Источники вычисления выводятся из выражения.
      { kind: 'compute', target: 'total', sources: ['price'], expr: 'model.price * 2' },
    ]);
  });
});

describe('выражение с константами', () => {
  // Проверку и формулу, читающие подвыражение несколько раз, генерация печатает блоком: строки
  // `const` и `return`. В правилах это одно выражение — немедленно применённая стрелка.
  const VALIDATION_BLOCKS = `export const formRules = defineValidation<Form>(({ model, cross }) => {
  cross(model.$.inn, (values) => {
    const digits = String(values.inn ?? '');
    const weights = [2, 4, 10];
    const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
    return digits.length === 10 && sum % 11 === Number(digits[9]) ? null : { code: 'inn.checksum' };
  });
  cross(model.$.total, (values) => {
    // пояснение, которому в выражении правила нет места
    const net = values.price * values.qty;
    return net > 0 && net < 1000 ? null : { code: 'total.range' };
  });
  cross(model.$.qty, (values) => {
    let half = values.qty / 2;
    return half > 1 ? null : { code: 'qty.half' };
  });
});`;

  it('блок проверки читается одним выражением; блок с комментарием или не из const — чужой', () => {
    const read = readRulesFromCode(code(VALIDATION_BLOCKS));
    expect(read.rules.validation).toEqual([
      {
        target: 'inn',
        rules: [],
        // Константы, которые друг друга не читают, — параметры одной стрелки; читающая — глубже.
        cross:
          "((digits, weights) => ((sum) => digits.length === 10 && sum % 11 === Number(digits[9]))(weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0)))(String(values.inn ?? ''), [2, 4, 10])",
        code: 'inn.checksum',
      },
    ]);
    expect(read.files[0]?.foreign.map((piece) => piece.line)).toEqual([8, 13]);
  });

  it('блок формулы вычисления читается одним выражением, условие пересчёта — как было', () => {
    const behavior = `
export function behaviorRules({ model }: BehaviorScope<Form>): void {
  compute(
    model.$.total,
    () => {
      const net = model.price * model.qty;
      return net > 1000 ? net * 0.9 : net;
    },
    { when: () => model.kind === 'm' },
  );
  compute(model.$.fee, () => {
    console.info(model.price);
    return model.price * 0.01;
  });
}

export const formBehavior = defineFormBehavior<Form>(behaviorRules);
`;
    const read = readRulesFromCode({
      validation: [],
      behavior: { path: 'behavior/index.ts', text: behavior },
      constants: [],
    });
    expect(read.rules.behavior).toEqual([
      {
        kind: 'compute',
        target: 'total',
        sources: ['price', 'qty'],
        expr: '((net) => net > 1000 ? net * 0.9 : net)(model.price * model.qty)',
        when: "model.kind === 'm'",
      },
    ]);
    expect(read.files[0]?.foreign.map((piece) => piece.line)).toEqual([11]);
  });
});

describe('правила-константы модуля', () => {
  // Генерация выносит проверку своего поля и асинхронное правило-стрелку в константы над схемой,
  // как сервер MCP: ссылка на правило одна на все прогоны схемы.
  const CONSTANTS = `import { defineValidation, validate, validateAsync } from '@reformer/core/validation';
import type { AsyncRule, Rule } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { Form } from '../types';

/** Проверка поля \`total\`: читает только его значение. */
const totalLimitRule: Rule<Form['total']> = (value) =>
  value <= 100 ? null : { code: 'total.limit' };

const innLengthRule: Rule<Form['company']['inn']> = (value) => {
  const digits = String(value ?? '');
  return digits.length === 10 ? null : { code: 'cross' };
};

const nameCheckRule: Rule<Form['items'][number]['name']> = (value) => (value !== '' ? null : { code: 'cross' });

const promoAsyncRule: AsyncRule<Form['promo']> = async (value) =>
  value === 'SALE' ? null : { code: 'promo.unknown' };

const strangeRule: Rule<Form['note']> = (value) => (value ? null : { code: 'note', params: { max: 3 } });

export const formRules = defineValidation<Form>(({ model }) => {
  validate(model.$.total, [required(), totalLimitRule]);
  validate(model.$.company.inn, [innLengthRule]);
  validateAsync(model.$.promo, [promoAsyncRule]);
  applyEach(model.$.items, ({ model: item }) => {
    validate(item.$.name, [nameCheckRule]);
  });
  validate(model.$.note, [strangeRule]);
  validateAsync(model.$.total, [totalLimitRule]);
});`;

  it('константа проверки — обратно условием cross над снимком, асинхронная — выражением async', () => {
    const read = readRulesFromCode(code(CONSTANTS));
    expect(read.rules.validation).toEqual([
      { target: 'total', rules: ['required()'] },
      { target: 'total', rules: [], cross: 'values.total <= 100', code: 'total.limit' },
      {
        target: 'company.inn',
        rules: [],
        cross: "((digits) => digits.length === 10)(String(values.company.inn ?? ''))",
      },
      // Тело-тернарный оператор, перенесённое печатью на строку ниже, — снова в скобках.
      {
        target: 'promo',
        rules: [],
        async: "async (value) => (value === 'SALE' ? null : { code: 'promo.unknown' })",
      },
      // У строки массива путь значения — от строки.
      { target: 'items.name', each: 'items', rules: [], cross: "values.name !== ''" },
    ]);
  });

  it('константа, которую читатель не разобрал, и константа не того вида — чужой код', () => {
    const read = readRulesFromCode(code(CONSTANTS));
    // `strangeRule` несёт параметры текста, `totalLimitRule` в validateAsync — синхронное правило:
    // подставить их правилом формы молча значило бы потерять смысл.
    expect(read.files[0]?.foreign.map((piece) => piece.text)).toEqual([
      'validate(model.$.note, [strangeRule])',
      'validateAsync(model.$.total, [totalLimitRule])',
    ]);
  });
});

describe('значения источников данных', () => {
  it('варианты и скаляры — значениями, подписи-функции пропускаются', () => {
    const constants = `// constants/anketa.ts
import type { SelectOption } from '../types/anketa';

export const REGIONS: SelectOption[] = [
  { value: 'msk', label: 'Москва' },
];
export const LIMIT = 10;
export const rowLabel = (row: { name: string }) => row.name;
`;
    const read = readRulesFromCode({
      validation: [],
      constants: [{ path: 'constants/anketa.ts', text: constants }],
    });
    expect(read.rules.dataSources).toEqual({
      REGIONS: [{ value: 'msk', label: 'Москва' }],
      LIMIT: 10,
    });
  });
});

describe('загрузчик', () => {
  const files: Record<string, string> = {
    'validation/form.ts': VALIDATION,
    'validation/kontakty.ts': `export const stepRules = defineValidation<Form>(({ model }) => {
  validate(model.$.contacts.email, [email()]);
});`,
    'validation/messages.ts': 'export const formMessages = defineIssueMessages({});',
  };
  const source = {
    read: async (path: string) => files[path] ?? null,
    list: async (dir: string) =>
      dir === 'validation' ? ['form.ts', 'kontakty.ts', 'messages.ts'] : null,
  };

  it('читает все файлы каталога валидации, кроме словаря', async () => {
    const read = await loadRulesFromModule(source);
    expect(read.files.map((file) => file.path)).toEqual([
      'validation/form.ts',
      'validation/kontakty.ts',
    ]);
    expect(read.rules.validation.map((rule) => rule.target)).toContain('contacts.email');
  });

  it('без листинга — по ожидаемым путям', async () => {
    const read = await loadRulesFromModule(
      { read: source.read },
      { validation: ['validation/form.ts'] }
    );
    expect(read.files.map((file) => file.path)).toEqual(['validation/form.ts']);
  });

  it('файлы правил узнаются по пути', () => {
    expect(isRuleCodePath('validation/form.ts')).toBe(true);
    expect(isRuleCodePath('validation/messages.ts')).toBe(true);
    expect(isRuleCodePath('behavior/index.ts')).toBe(true);
    expect(isRuleCodePath('constants/anketa.ts')).toBe(true);
    expect(isRuleCodePath('schema/form.schema.json')).toBe(false);
    expect(isRuleCodePath('types/anketa.ts')).toBe(false);
  });
});

describe('правка словаря текстов', () => {
  const MESSAGES = `// validation/messages.ts — тексты
import { defineIssueMessages } from '@reformer/core/i18n';

/** Тексты. */
export const formMessages = defineIssueMessages({
  required: 'Обязательное поле',
  'email.required': 'Укажите email',
});
`;

  it('без комментариев внутри — словарь печатается заново, остальное как было', () => {
    const result = patchMessages(MESSAGES, {
      'email.required': 'Почта обязательна',
      'phone.required': 'Укажите телефон',
      required: null,
    });
    expect(result).toEqual({
      ok: true,
      text: MESSAGES.replace(
        /export const formMessages[\s\S]*\);/,
        `export const formMessages = defineIssueMessages({
  'email.required': 'Почта обязательна',
  'phone.required': 'Укажите телефон',
});`
      ),
    });
  });

  it('с комментарием внутри — запись правится по месту, комментарий остаётся', () => {
    const commented = MESSAGES.replace(
      "  required: 'Обязательное поле',",
      "  // своё\n  required: 'Обязательное поле',"
    );
    const result = patchMessages(commented, { 'email.required': 'Почта', 'x.y': 'Новое' });
    expect(result.ok).toBe(true);
    const text = result.ok ? result.text : '';
    expect(text).toContain('// своё');
    expect(text).toContain("'email.required': 'Почта'");
    expect(text).toContain("'x.y': 'Новое',");
    expect(text).toContain("required: 'Обязательное поле'");
  });

  it('файл без словаря не правится — с причиной', () => {
    expect(patchMessages('export const x = 1;\n', { a: 'b' })).toMatchObject({ ok: false });
  });
});

describe('правка констант', () => {
  const CONSTANTS = `// constants/anketa.ts — значения
import type { SelectOption } from '../types/anketa';

export const REGIONS: SelectOption[] = [{ value: 'a', label: 'A' }];

// своё
export const LIMIT = 10;
`;

  it('объявление заменяется на месте, новое — дописывается, своё остаётся', () => {
    const result = patchConstants(CONSTANTS, {
      REGIONS: "export const REGIONS: SelectOption[] = [{ value: 'msk', label: 'Москва' }];",
      CITY: "export const CITY = 'Москва';",
      LIMIT: null,
    });
    expect(result).toEqual({
      ok: true,
      text: `// constants/anketa.ts — значения
import type { SelectOption } from '../types/anketa';

export const REGIONS: SelectOption[] = [{ value: 'msk', label: 'Москва' }];

// своё
export const LIMIT = 10;

export const CITY = 'Москва';
`,
    });
  });

  it('заглушка пустого файла уступает место объявлению, импорт дописывается', () => {
    const stub = `// constants/anketa.ts — значения

// Источников данных в схеме нет.
export {};
`;
    const result = patchConstants(stub, { REGIONS: 'export const REGIONS: SelectOption[] = [];' }, [
      "import type { SelectOption } from '../types/anketa';",
    ]);
    expect(result.ok && result.text).toBe(`// constants/anketa.ts — значения

// Источников данных в схеме нет.
import type { SelectOption } from '../types/anketa';

export const REGIONS: SelectOption[] = [];
`);
  });
});
