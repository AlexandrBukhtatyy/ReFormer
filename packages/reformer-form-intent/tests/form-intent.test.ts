import { describe, expect, it } from 'vitest';
import {
  buildBehaviorTs,
  buildValidationSchemaTs,
  collectSteps,
  deriveComponentName,
  deriveInterfaceName,
  findCycle,
  INTENT_CONTRACT_VERSION,
  mergeFieldChecks,
  modelPaths,
  normalizeIntent,
  stepKeyOf,
  type LayoutNode,
  type ValidationRuleIntent,
} from '../src/index.js';
import {
  fieldTsType,
  hoistRuleConstants,
  normalizeWith,
  optionalText,
  schemaBody,
  unionMembers,
  validationRuleBlock,
  validationRuleParts,
} from '../src/emit.js';

const OPTS = { interfaceName: 'T', exportName: 'v', typeImport: './types' };

describe('контракт', () => {
  it('версия контракта — число, которое потребитель сверяет со своей', () => {
    expect(INTENT_CONTRACT_VERSION).toBeTypeOf('number');
  });

  it('имена: кириллица транслитерируется, пустое имя даёт умолчание', () => {
    expect(deriveInterfaceName('Заявка на кредит')).toBe('ZayavkaNaKreditShape');
    expect(deriveInterfaceName('Credit application')).toBe('CreditApplicationShape');
    expect(deriveInterfaceName('—')).toBe('FormShape');
    expect(deriveComponentName('Заявка на кредит')).toBe('ZayavkaNaKreditForm');
    expect(deriveComponentName('Order form')).toBe('OrderForm');
    expect(deriveComponentName('—')).toBeNull();
  });
});

describe('normalizeIntent', () => {
  it('расставляет умолчания: modelPath и selector поля — его имя', () => {
    const intent = normalizeIntent({
      formName: 'Order',
      fields: [{ name: 'email', type: 'string', component: 'Input' }],
    });
    expect(intent.interfaceName).toBe('OrderShape');
    expect(intent.fields[0]).toMatchObject({
      name: 'email',
      modelPath: 'email',
      selector: 'email',
    });
    expect(intent.validation).toEqual([]);
    expect(intent.behavior).toEqual([]);
  });

  it('безымянная запись выбрасывается с предупреждением, а не роняет вызов', () => {
    const intent = normalizeIntent({
      formName: 'Order',
      fields: [
        { name: '', type: 'string', component: 'Input' } as never,
        { name: 'email', type: 'string', component: 'Input' },
      ],
    });
    expect(intent.fields.map((f) => f.name)).toEqual(['email']);
    expect(intent.warnings.length).toBeGreaterThan(0);
  });

  it('normalizeWith из emit — та же нормализация с кодами предупреждений', () => {
    const notices: Parameters<typeof normalizeWith>[1] = [];
    const intent = normalizeWith({ formName: 'Order' }, notices, {
      found: false,
      fields: {},
      exports: {},
      subpaths: {},
      groups: {},
    } as never);
    expect(intent.formName).toBe('Order');
    expect(Array.isArray(notices)).toBe(true);
  });

  it('modelPaths — пути полей и массивов модели', () => {
    const intent = normalizeIntent({
      formName: 'Order',
      fields: [{ name: 'email', type: 'string', component: 'Input' }],
      arrays: [
        {
          name: 'items',
          itemInterfaceName: 'Item',
          initialValue: [],
          itemFields: [{ name: 'qty', type: 'number', component: 'InputNumber' }],
        },
      ],
    });
    const paths = modelPaths(intent);
    expect(paths.has('email')).toBe(true);
    expect(paths.has('items')).toBe(true);
  });
});

describe('печать валидации', () => {
  it('модуль шага: своё имя экспорта, свой путь до типа, импорты ровно под свои правила', () => {
    const ts = buildValidationSchemaTs([{ target: 'name', rules: ['required', 'minLength(2)'] }], {
      interfaceName: 'MixForm',
      exportName: 'stepValidation',
      typeImport: '../../types',
    });
    expect(ts).toBe(
      [
        "import { validate, defineValidation } from '@reformer/core/validation';",
        "import { minLength, required } from '@reformer/core/validators';",
        "import type { MixForm } from '../../types';",
        '',
        'export const stepValidation = defineValidation<MixForm>(({ model }) => {',
        '  validate(model.$.name, [required(), minLength(2)]);',
        '});',
        '',
      ].join('\n')
    );
  });

  it('операторы берутся по подмножеству: applyEach — только когда есть правило строки', () => {
    const each = buildValidationSchemaTs(
      [{ target: 'amount', each: 'items', rules: ['required', 'min(1)'] }],
      OPTS
    );
    expect(each).toContain('import { validate, defineValidation, applyEach } from');
    expect(each).not.toContain('validateWhen');
    const plain = buildValidationSchemaTs([{ target: 'name', rules: ['required'] }], OPTS);
    expect(plain).not.toContain('applyEach');
  });

  it('кросс-проверка получает cross в параметрах схемы', () => {
    const ts = buildValidationSchemaTs(
      [
        {
          target: 'confirm',
          rules: [],
          cross: 'values.confirm === values.password',
          code: 'passwordMismatch',
        },
      ],
      OPTS
    );
    expect(ts).toContain('defineValidation<T>(({ model, cross }) => {');
    expect(ts).toContain('values.confirm === values.password');
  });

  it('mergeFieldChecks: проверки одного поля — одним списком, повтор отбрасывается', () => {
    const rules: ValidationRuleIntent[] = [
      { target: 'name', rules: ['required'] },
      { target: 'name', rules: ['minLength(2)', 'required'] },
      { target: 'email', rules: ['email()'] },
    ];
    const merged = mergeFieldChecks(rules);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ target: 'name', rules: ['required', 'minLength(2)'] });
  });

  it('блок правила из emit печатает тот же validate, что и схема', () => {
    const block = validationRuleBlock({ target: 'name', rules: ['required'] });
    expect(block).toContain('validate(model.$.name, [required()]);');
  });

  it('правила с одним условием — один validateWhen на месте первого из них', () => {
    const ts = buildValidationSchemaTs(
      [
        { target: 'company.name', rules: ['required'], when: "model.type === 'company'" },
        { target: 'email', rules: ['email()'] },
        { target: 'company.inn', rules: ['required'], when: " model.type === 'company' " },
        { target: 'birthDate', rules: ['required'], when: "model.type === 'person'" },
        { target: 'price', each: 'items', rules: ['min(0)'], when: "model.type === 'company'" },
      ],
      OPTS
    );
    expect(ts.match(/validateWhen\(/g)).toHaveLength(2); // два условия — два блока
    expect(ts).toContain(
      [
        "  validateWhen(() => model.type === 'company', () => {",
        '    validate(model.$.company.name, [required()]);',
        '    validate(model.$.company.inn, [required()]);',
        '    applyEach(model.$.items, ({ model: item }) => {',
        '      validate(item.$.price, [min(0)]);',
        '    });',
        '  });',
        '  validate(model.$.email, [email()]);',
        "  validateWhen(() => model.type === 'person', () => {",
        '    validate(model.$.birthDate, [required()]);',
        '  });',
      ].join('\n')
    );
  });
});

describe('правила-константы модуля', () => {
  const hoist = (rules: ValidationRuleIntent[], taken = new Set<string>()) =>
    hoistRuleConstants(rules, {
      valueType: (rule) =>
        rule.each ? `Item['${rule.target}']` : `Order['${rule.target.split('.').join("']['")}']`,
      taken,
    });

  it('проверка, читающая только своё поле, — правило в списке validate', () => {
    const { rules, constants } = hoist([
      { target: 'total', rules: ['min(0)'] },
      {
        target: 'total',
        rules: [],
        cross: 'values.total <= 100000',
        code: 'total.large',
        severity: 'warning',
        params: { limit: '100000' },
      },
    ]);
    expect(constants).toEqual([
      {
        name: 'totalLargeRule',
        type: 'Rule',
        lines: [
          '/** Проверка поля `total`: читает только его значение. */',
          // Одним оператором и без лишних скобок у условия — как его оставит prettier.
          "const totalLargeRule: Rule<Order['total']> = (value) => (value <= 100000 ? null : { code: 'total.large', severity: 'warning', params: { limit: 100000 } });",
        ],
      },
    ]);
    expect(rules[1]).toMatchObject({ target: 'total', rules: ['totalLargeRule'] });
    expect(rules[1]?.cross).toBeUndefined();
    // Имя константы — готовое правило: скобки фабрики ему не дописываются, и это одно `validate`.
    const body = schemaBody(validationRuleParts(rules, new Set(['totalLargeRule'])));
    expect(body).toEqual(['  validate(model.$.total, [min(0), totalLargeRule]);']);
  });

  it('проверка по другим полям остаётся cross', () => {
    const source: ValidationRuleIntent[] = [
      {
        target: 'paymentMethod',
        rules: [],
        cross: "values.paymentMethod !== 'invoice' || values.customerType === 'company'",
      },
      { target: 'company.inn', rules: [], cross: 'values.company.innKpp.length > 0' },
      { target: 'tags', rules: [], cross: 'values.tags.every((value) => value.length < 5)' },
      { target: 'end', rules: [], cross: 'values.end > 0', params: { start: 'values.start' } },
    ];
    const { rules, constants } = hoist(source);
    expect(constants).toEqual([]);
    expect(rules).toEqual(source);
  });

  it('вложенный путь и строка массива: значение — своё поле области', () => {
    const { rules, constants } = hoist([
      { target: 'company.inn', rules: [], cross: 'String(values.company.inn ?? "").length === 10' },
      { target: 'items.price', each: 'items', rules: [], cross: 'values.price >= 0' },
    ]);
    expect(constants.map((constant) => constant.lines[1])).toEqual([
      "const companyInnCheckRule: Rule<Order['company']['inn']> = (value) => (String(value ?? \"\").length === 10 ? null : { code: 'cross' });",
      "const itemsPriceCheckRule: Rule<Item['items.price']> = (value) => (value >= 0 ? null : { code: 'cross' });",
    ]);
    // Скобки у условия — только там, где без них смысл другой.
    const ternary = hoist([
      { target: 'total', rules: [], cross: 'values.total > 0 ? values.total < 10 : true' },
    ]);
    expect(ternary.constants[0]?.lines[1]).toBe(
      "const totalCheckRule: Rule<Order['total']> = (value) => ((value > 0 ? value < 10 : true) ? null : { code: 'cross' });"
    );
    expect(rules.map((rule) => rule.rules)).toEqual([
      ['companyInnCheckRule'],
      ['itemsPriceCheckRule'],
    ]);
  });

  it('асинхронная стрелка — константа AsyncRule, ссылка на функцию остаётся', () => {
    const taken = new Set(['promoCodeUnknownRule']);
    const { rules, constants } = hoist(
      [
        {
          target: 'promoCode',
          rules: [],
          async: 'async (value) => (value === "SALE" ? null : { code: "promoCode.unknown" })',
          code: 'promoCode.unknown',
        },
        { target: 'login', rules: [], async: 'checkLogin' },
        {
          target: 'captcha',
          rules: [],
          async: 'async (value) => model.strict && !value ? x : null',
        },
      ],
      taken
    );
    expect(constants).toHaveLength(1);
    expect(constants[0]).toMatchObject({ name: 'promoCodeUnknownRule2', type: 'AsyncRule' });
    expect(constants[0]?.lines[1]).toBe(
      'const promoCodeUnknownRule2: AsyncRule<Order[\'promoCode\']> = async (value) => (value === "SALE" ? null : { code: "promoCode.unknown" });'
    );
    expect(rules.map((rule) => rule.async)).toEqual([
      'promoCodeUnknownRule2',
      'checkLogin',
      'async (value) => model.strict && !value ? x : null',
    ]);
    expect(taken.has('promoCodeUnknownRule2')).toBe(true);
  });

  it('тип значения неизвестен — правило остаётся в схеме', () => {
    const source: ValidationRuleIntent[] = [{ target: 'a', rules: [], cross: 'values.a > 0' }];
    const result = hoistRuleConstants(source, { valueType: () => null, taken: new Set() });
    expect(result).toEqual({ rules: source, constants: [] });
  });

  it('печать одной схемы с типом значения — константы над схемой, как у сервера', () => {
    const rules: ValidationRuleIntent[] = [
      { target: 'total', rules: ['required'], cross: 'values.total <= 100' },
      { target: 'promo', rules: [], async: 'async (value) => (value ? null : { code: "promo" })' },
    ];
    const options = { interfaceName: 'Order', exportName: 'rules', typeImport: './types' };
    const ts = buildValidationSchemaTs(rules, {
      ...options,
      valueType: (rule) => `Order['${rule.target}']`,
    });
    expect(ts).toBe(
      [
        "import { validate, defineValidation, validateAsync } from '@reformer/core/validation';",
        "import type { AsyncRule, Rule } from '@reformer/core/validation';",
        "import { required } from '@reformer/core/validators';",
        "import type { Order } from './types';",
        '',
        '/** Проверка поля `total`: читает только его значение. */',
        "const totalCheckRule: Rule<Order['total']> = (value) => (value <= 100 ? null : { code: 'cross' });",
        '',
        '/** Асинхронная проверка поля `promo`. Константа модуля: ядро помнит ответ по ссылке на правило. */',
        'const promoAsyncRule: AsyncRule<Order[\'promo\']> = async (value) => (value ? null : { code: "promo" });',
        '',
        'export const rules = defineValidation<Order>(({ model }) => {',
        '  validate(model.$.total, [required(), totalCheckRule]);',
        '  validateAsync(model.$.promo, [promoAsyncRule]);',
        '});',
        '',
      ].join('\n')
    );
    // Без типа значения печать прежняя: проверка — cross, асинхронное правило — в схеме.
    const plain = buildValidationSchemaTs(rules, options);
    expect(plain).toContain('cross(model.$.total');
    expect(plain).not.toContain('AsyncRule');
  });
});

describe('типы полей модели', () => {
  const OPTIONS = [
    { value: 'person', label: 'Физическое лицо' },
    { value: 'company', label: 'Юридическое лицо' },
  ];
  const SOURCES = [
    { name: 'CHANNELS', values: ['search', { value: 'friends', label: 'Друзья' }] },
    { name: 'CITIES' },
  ];
  const field = (extra: Record<string, unknown>) =>
    ({ name: 'f', type: 'string', component: 'Select', ...extra }) as Parameters<
      typeof fieldTsType
    >[0];

  it('варианты поля — объединение литералов их значений', () => {
    const radio = field({
      component: 'RadioGroup',
      initialValue: 'person',
      componentProps: { options: OPTIONS },
    });
    expect(fieldTsType(radio)).toBe("'person' | 'company'");
    const sourced = field({ initialValue: 'search', optionsSource: 'CHANNELS' });
    expect(fieldTsType(sourced, new Set(), SOURCES)).toBe("'search' | 'friends'");
  });

  it('начальное значение вне вариантов входит в тип; null — отдельным членом', () => {
    const empty = field({ initialValue: '', componentProps: { options: OPTIONS } });
    expect(fieldTsType(empty)).toBe("'' | 'person' | 'company'");
    const unset = field({ initialValue: null, componentProps: { options: OPTIONS } });
    expect(fieldTsType(unset)).toBe("'person' | 'company' | null");
  });

  it('мультивыбор — массив объединения, а не unknown[]', () => {
    const multi = field({ type: 'array', initialValue: [], optionsSource: 'CHANNELS' });
    expect(fieldTsType(multi, new Set(), SOURCES)).toBe("Array<'search' | 'friends'>");
    // Начальное значение вне вариантов: тип остаётся общим, иначе модель не соберётся.
    const odd = field({ type: 'array', initialValue: ['ads'], optionsSource: 'CHANNELS' });
    expect(fieldTsType(odd, new Set(), SOURCES)).toBe('unknown[]');
  });

  it('вариантов списком нет или значение не строка — тип общий', () => {
    expect(fieldTsType(field({ optionsSource: 'CITIES' }), new Set(), SOURCES)).toBe('string');
    expect(fieldTsType(field({ optionsSource: 'UNKNOWN' }), new Set(), SOURCES)).toBe('string');
    expect(fieldTsType(field({ componentProps: { options: [1, 2] } }))).toBe('string');
    const number = field({ type: 'number', componentProps: { options: ['1', '2'] } });
    expect(fieldTsType(number)).toBe('number');
  });

  it('optionalText: null — у текста без required, но не у выбора, который не опустошается', () => {
    const intent = normalizeIntent({
      formName: 'f',
      interfaceName: 'F',
      target: 'renderer-react',
      fields: [
        { name: 'note', type: 'string', component: 'Input', initialValue: '' },
        {
          name: 'kind',
          type: 'string',
          component: 'RadioGroup',
          initialValue: 'person',
          componentProps: { options: OPTIONS },
        },
        {
          name: 'channel',
          type: 'string',
          component: 'Select',
          initialValue: 'search',
          optionsSource: 'CHANNELS',
        },
        {
          name: 'cleared',
          type: 'string',
          component: 'Select',
          initialValue: 'search',
          optionsSource: 'CHANNELS',
          componentProps: { clearable: true },
        },
        { name: 'city', type: 'string', component: 'Select', optionsSource: 'CITIES' },
      ],
      dataSources: SOURCES,
    });
    const optional = optionalText(intent);
    const typeOf = (name: string) =>
      fieldTsType(intent.fields.find((item) => item.name === name)!, optional, intent.dataSources);
    expect(typeOf('note')).toBe('string | null');
    expect(typeOf('kind')).toBe("'person' | 'company'");
    expect(typeOf('channel')).toBe("'search' | 'friends'");
    // Крестик сброса пишет в модель null.
    expect(typeOf('cleared')).toBe("'search' | 'friends' | null");
    // Варианты с сервера: поле — прежний необязательный текст.
    expect(typeOf('city')).toBe('string | null');
  });

  it('unionMembers делит только верхний уровень', () => {
    expect(unionMembers("'a' | 'b' | null")).toEqual(["'a'", "'b'", 'null']);
    expect(unionMembers("Array<'a' | 'b'>")).toEqual(["Array<'a' | 'b'>"]);
    expect(unionMembers("'yes | no' | 'null'")).toEqual(["'yes | no'", "'null'"]);
    expect(unionMembers('Date | null')).toEqual(['Date', 'null']);
  });
});

describe('печать поведения', () => {
  it('compute печатается оператором ядра, импорт — ровно под используемые операторы', () => {
    const intent = normalizeIntent({
      formName: 'Order',
      fields: [
        { name: 'price', type: 'number', component: 'InputNumber' },
        { name: 'qty', type: 'number', component: 'InputNumber' },
        { name: 'total', type: 'number', component: 'InputNumber' },
      ],
      behavior: [
        {
          kind: 'compute',
          target: 'total',
          sources: ['price', 'qty'],
          expr: 'model.price.value * model.qty.value',
        },
      ],
    });
    const ts = buildBehaviorTs(intent);
    expect(ts).toContain("import { defineFormBehavior, compute } from '@reformer/core/behaviors';");
    expect(ts).toContain('import type { OrderShape } from');
    expect(ts).toContain('model.price.value * model.qty.value');
  });

  it('без поведения — пустая схема с подсказкой', () => {
    const ts = buildBehaviorTs(normalizeIntent({ formName: 'Order' }));
    expect(ts).toContain("import { defineFormBehavior } from '@reformer/core/behaviors';");
    expect(ts).toContain('Поведения в intent не было');
  });
});

describe('раскладка и граф', () => {
  it('collectSteps находит шаги мастера, stepKeyOf даёт им ключи', () => {
    const root: LayoutNode = {
      kind: 'container',
      component: 'FormWizard',
      children: [
        { kind: 'step', title: 'Контакты', children: [{ kind: 'field', ref: 'email' }] },
        { kind: 'step', title: 'Оплата', selector: 'pay', children: [] },
      ],
    };
    const steps = collectSteps(root);
    expect(steps.map((s) => s.title)).toEqual(['Контакты', 'Оплата']);
    expect(stepKeyOf(steps[1]!, 1)).toBeTypeOf('string');
  });

  it('findCycle находит цикл и молчит без него', () => {
    expect(
      findCycle([
        { target: 'a', reads: ['b'] },
        { target: 'b', reads: ['a'] },
      ])
    ).toEqual(['a', 'b', 'a']);
    expect(findCycle([{ target: 'a', reads: ['b'] }])).toBeNull();
  });
});
