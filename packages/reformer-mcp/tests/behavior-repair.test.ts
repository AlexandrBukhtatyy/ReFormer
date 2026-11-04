/**
 * Связи, которые собирались с ✓ и молча не работали, и тексты ошибок правила с несколькими кодами.
 *
 * Все три случая — из формы кредита, собранной агентом через `form_build` (clean-test-2, батч
 * 78d1): контракт сценария их не видел, расхождения нашёл проход по форме в браузере.
 * - ReFormer-j356.12: `resetWhen` с условием `true` и `sources` не сбрасывал модель при смене марки.
 * - ReFormer-j356.13: вычисляемый взнос с `enableWhen` был открыт для ввода.
 * - ReFormer-j356.10: общий текст `[required, email]` отклонял сборку («тексты ошибок потеряны»).
 */

import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { buildBundle, buildMessagesTs } from '../src/core/generate/builders';
import { crossCheckBundle } from '../src/core/generate/cross-check';
import { readIntent } from '../src/core/generate/form-intent';

const credit = (behavior: unknown[]) => ({
  formName: 'Кредит',
  target: 'renderer-react',
  fields: [
    {
      name: 'loanType',
      type: 'string',
      component: 'Select',
      initialValue: 'consumer',
      componentProps: {
        options: [
          { value: 'consumer', label: 'Потребительский' },
          { value: 'mortgage', label: 'Ипотека' },
        ],
      },
    },
    { name: 'propertyValue', type: 'number', component: 'InputNumber', initialValue: null },
    { name: 'initialPayment', type: 'number', component: 'InputNumber', initialValue: null },
    { name: 'carBrand', type: 'string', component: 'Input', initialValue: null },
    { name: 'carModel', type: 'string', component: 'Input', initialValue: null },
    { name: 'city', type: 'string', component: 'Input', initialValue: '' },
  ],
  arrays: [
    {
      name: 'cars',
      itemInterfaceName: 'Car',
      initialValue: [],
      itemFields: [
        { name: 'brand', type: 'string', component: 'Input', initialValue: '' },
        { name: 'model', type: 'string', component: 'Input', initialValue: '' },
      ],
    },
  ],
  layoutRoot: {
    kind: 'container',
    component: 'Box',
    children: [
      'loanType',
      'propertyValue',
      'initialPayment',
      'carBrand',
      'carModel',
      'city',
      { kind: 'array', ref: 'cars' },
    ],
  },
  behavior,
});

const behaviorTs = (intent: ReturnType<typeof readIntent>['intent']) =>
  buildBundle(intent, CATALOGS).files.find((file) => file.path === 'form.behavior.ts')?.content ??
  '';

describe('resetWhen с условием без модели (ReFormer-j356.12)', () => {
  it('при источниках становится onChange на каждом, с замечанием', () => {
    const { intent, problems, notices } = readIntent(
      credit([
        {
          kind: 'resetWhen',
          target: 'carModel',
          sources: ['carBrand'],
          expr: 'true',
          options: { resetValue: null },
        },
        { kind: 'resetWhen', target: 'city', sources: ['loanType', 'carBrand'], expr: 'true' },
      ])
    );
    expect(problems).toEqual([]);
    expect(intent.behavior).toEqual([
      { kind: 'onChange', target: 'carBrand', sources: [], expr: 'model.carModel = null;' },
      { kind: 'onChange', target: 'loanType', sources: [], expr: "model.city = '';" },
      { kind: 'onChange', target: 'carBrand', sources: [], expr: "model.city = '';" },
    ]);
    expect(notices.filter((n) => n.code === 'reset-as-on-change').map((n) => n.at)).toEqual([
      'carModel',
      'city',
    ]);
    const code = behaviorTs(intent);
    expect(code).toContain('onChange(model.$.carBrand, () => { model.carModel = null; });');
    expect(code).not.toContain('resetWhen');
  });

  it('в строке массива пишет строку через item', () => {
    const { intent } = readIntent(
      credit([
        {
          kind: 'resetWhen',
          target: 'cars.model',
          each: 'cars',
          sources: ['cars.brand'],
          expr: 'true',
        },
      ])
    );
    expect(intent.behavior).toEqual([
      {
        kind: 'onChange',
        target: 'cars.brand',
        each: 'cars',
        sources: [],
        expr: "item.model = '';",
      },
    ]);
    expect(behaviorTs(intent)).toContain("onChange(item.$.brand, () => { item.model = ''; });");
  });

  it('без источников — проблема, а не тихий сброс при создании', () => {
    const { problems } = readIntent(
      credit([{ kind: 'resetWhen', target: 'carModel', sources: [], expr: 'true' }])
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].expected).toContain('onChange');
  });

  it('условие над моделью остаётся resetWhen', () => {
    const reset = {
      kind: 'resetWhen',
      target: 'carModel',
      sources: ['carBrand'],
      expr: '!model.carBrand',
    };
    const { intent, notices } = readIntent(credit([reset]));
    expect(intent.behavior).toEqual([reset]);
    expect(notices.some((n) => n.code === 'reset-as-on-change')).toBe(false);
  });
});

describe('вычисляемое поле с enableWhen (ReFormer-j356.13)', () => {
  const mortgage = "model.loanType === 'mortgage'";
  const compute = (when?: string) => ({
    kind: 'compute',
    target: 'initialPayment',
    sources: ['propertyValue'],
    expr: 'model.propertyValue == null ? null : Math.round(model.propertyValue * 0.2)',
    ...(when ? { when } : {}),
  });
  const enable = {
    kind: 'enableWhen',
    target: 'initialPayment',
    sources: ['loanType'],
    expr: mortgage,
    options: { resetOnDisable: true },
  };

  it('включение на время расчёта → сброс по ложному условию, поле заблокировано', () => {
    const { intent, problems, notices } = readIntent(credit([enable, compute(mortgage)]));
    expect(problems).toEqual([]);
    expect(intent.behavior).toEqual([
      {
        kind: 'resetWhen',
        target: 'initialPayment',
        sources: ['loanType'],
        expr: `!(${mortgage})`,
        options: { resetValue: null },
      },
      compute(mortgage),
    ]);
    expect(notices.find((n) => n.code === 'computed-toggle-replaced')?.at).toBe('initialPayment');

    const { files, layoutJson } = buildBundle(intent, CATALOGS);
    expect(crossCheckBundle(intent, JSON.parse(layoutJson)).errors).toEqual([]);
    const schema = files.find((file) => file.path === 'form.schema.ts')?.content ?? '';
    expect(schema).toMatch(
      /selector: 'initialPayment',\s*model: model\.\$\.initialPayment,\s*disabled: true/
    );
    expect(behaviorTs(intent)).not.toContain('enableWhen');
  });

  it('расчёт без when получает условие включения', () => {
    const { intent } = readIntent(credit([compute(), enable]));
    expect(intent.behavior[0]).toEqual(compute(mortgage));
    expect(intent.behavior[1].kind).toBe('resetWhen');
  });

  it('без resetOnDisable включение просто снимается', () => {
    const { intent } = readIntent(credit([compute(mortgage), { ...enable, options: undefined }]));
    expect(intent.behavior).toEqual([compute(mortgage)]);
  });

  it('«расчёт или ручной ввод» — включение при другом условии — не трогается', () => {
    const manual = { ...enable, expr: "model.loanType !== 'mortgage'" };
    const { intent, notices } = readIntent(credit([compute(mortgage), manual]));
    expect(intent.behavior).toEqual([compute(mortgage), manual]);
    expect(notices.some((n) => n.code === 'computed-toggle-replaced')).toBe(false);
  });

  it('условие сравнивается без пробелов и внешних скобок', () => {
    const { intent } = readIntent(
      credit([compute(`( ${mortgage} )`), { ...enable, expr: "model.loanType==='mortgage'" }])
    );
    expect(intent.behavior.map((b) => b.kind)).toEqual(['compute', 'resetWhen']);
  });
});

describe('общий текст правила с несколькими кодами (ReFormer-j356.10)', () => {
  const messages = (validation: unknown[]) => {
    const { intent } = readIntent({ ...credit([]), validation });
    return buildMessagesTs(intent);
  };

  it('текст получает каждый код правила, без предупреждений', () => {
    const { content, warnings } = messages([
      {
        target: 'carBrand',
        rules: ["required({ code: 'brand.required' })", "minLength(2, { code: 'brand.min' })"],
        message: 'Укажите марку (от 2 символов)',
      },
    ]);
    expect(warnings).toEqual([]);
    expect(content).toContain("'brand.required': 'Укажите марку (от 2 символов)'");
    expect(content).toContain("'brand.min': 'Укажите марку (от 2 символов)'");
  });

  it('своя строка кода главнее общего текста, где бы она ни стояла', () => {
    const { content, warnings } = messages([
      {
        target: 'carBrand',
        rules: ["required({ code: 'brand.required' })", "minLength(2, { code: 'brand.min' })"],
        message: 'Марка от 2 символов',
      },
      {
        target: 'carBrand',
        rules: ["required({ code: 'brand.required' })"],
        message: 'Укажите марку',
      },
    ]);
    expect(warnings).toEqual([]);
    expect(content).toContain("'brand.required': 'Укажите марку'");
    expect(content).toContain("'brand.min': 'Марка от 2 символов'");
  });

  it('текст без кода у проверок по-прежнему потерян — и об этом сказано', () => {
    const { content, warnings } = messages([
      { target: 'carBrand', rules: ['required()', 'minLength(2)'], message: 'Укажите марку' },
    ]);
    expect(content).toBeNull();
    expect(warnings[0]).toMatch(/^Текст «Укажите марку».*нет кода/);
  });
});
