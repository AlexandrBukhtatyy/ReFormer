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
import { normalizeWith, validationRuleBlock } from '../src/emit.js';

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
