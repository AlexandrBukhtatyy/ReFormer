import { describe, expect, it } from 'vitest';
import {
  buildBehaviorTs,
  buildValidationSchemaTs,
  canonicalLocals,
  foldLocals,
  normalizeIntent,
  unfoldLocals,
  type ValidationRuleIntent,
} from '../src/index.js';
import { hoistRuleConstants } from '../src/emit.js';

const DIGITS = "String(values.company.inn ?? '')";
const CHECKSUM =
  '/^\\d{10}$/.test(digits) && weights.reduce((sum, weight, index) => sum + weight * Number(digits.charAt(index)), 0) % 11 % 10 === Number(digits.charAt(9))';

describe('константы выражения', () => {
  it('выражение без констант — как есть', () => {
    expect(unfoldLocals("model.type === 'person'")).toEqual({
      locals: [],
      result: "model.type === 'person'",
    });
    // Скобки вокруг выражения и вызов функции — не применённая стрелка.
    expect(unfoldLocals('(model.a + model.b)(1)').locals).toEqual([]);
    expect(unfoldLocals('((row) => row.qty)(model.first) + 1').locals).toEqual([]);
    expect(foldLocals([], 'model.a > 0')).toBe('model.a > 0');
  });

  it('константы, которые друг друга не читают, — параметры одной стрелки', () => {
    const locals = [
      { name: 'digits', init: DIGITS },
      { name: 'weights', init: '[2, 4, 10, 3, 5, 9, 4, 6, 8]' },
    ];
    const folded = foldLocals(locals, CHECKSUM);
    expect(folded).toBe(
      `((digits, weights) => ${CHECKSUM})(${DIGITS}, [2, 4, 10, 3, 5, 9, 4, 6, 8])`
    );
    expect(unfoldLocals(folded)).toEqual({ locals, result: CHECKSUM });
  });

  it('константа, читающая предыдущую, — уровень глубже; разбор возвращает их по порядку', () => {
    const locals = [
      { name: 'net', init: 'model.price * model.qty' },
      { name: 'tax', init: 'net * 0.2' },
      { name: 'fee', init: 'model.fee ?? 0' },
    ];
    const folded = foldLocals(locals, 'net + tax + fee > net * 2');
    expect(folded).toBe(
      '((net) => ((tax, fee) => net + tax + fee > net * 2)(net * 0.2, model.fee ?? 0))(model.price * model.qty)'
    );
    expect(unfoldLocals(folded)).toEqual({ locals, result: 'net + tax + fee > net * 2' });
    expect(foldLocals(unfoldLocals(folded).locals, unfoldLocals(folded).result)).toBe(folded);
  });

  it('скобки и запятые внутри строк, шаблонов и регулярных выражений не считаются', () => {
    const locals = [
      { name: 'text', init: "String(model.note ?? ')')" },
      { name: 'mark', init: '`(${model.a}, ${model.b})`' },
    ];
    const result = '/^[(,)]+$/.test(text) || text.includes(mark) || text / 2 > 1';
    expect(unfoldLocals(foldLocals(locals, result))).toEqual({ locals, result });
  });

  it('имя, занятое в месте печати, и повтор имени на вложенном уровне — выражение остаётся целым', () => {
    const shadowing = '((value) => value > 0 && value < 5)(values.total)';
    expect(unfoldLocals(shadowing)).toEqual({ locals: [], result: shadowing });
    // Свой набор занятых имён заменяет общий: `value` в нём нет — константа объявляется.
    expect(unfoldLocals(shadowing, new Set(['total'])).locals).toEqual([
      { name: 'value', init: 'values.total' },
    ]);
    const twice = '((part) => ((part) => part > 0)(model.b))(model.a)';
    expect(unfoldLocals(twice)).toEqual({ locals: [], result: twice });
  });

  it('вложенный уровень, который константами не раскладывается, остаётся выражением результата', () => {
    const inner = '((part) => part > 0)(part + 1)';
    expect(unfoldLocals(`((part) => ${inner})(model.a)`)).toEqual({
      locals: [{ name: 'part', init: 'model.a' }],
      result: inner,
    });
  });

  it('аргумент, читающий имя параметра, — чужое имя: строками const оно стало бы другим чтением', () => {
    // `limit` в аргументе — не параметр стрелки, а имя снаружи; `const limit = …` его закрыл бы.
    const sameLevel = '((limit, half) => half < limit)(model.max, limit / 2)';
    expect(unfoldLocals(sameLevel)).toEqual({ locals: [], result: sameLevel });
    const deeper = '((first) => ((second) => first < second)(model.b))(second + 1)';
    expect(unfoldLocals(deeper)).toEqual({ locals: [], result: deeper });
  });

  it('каноническая запись: уровни пересобираются, выражение без констант не меняется', () => {
    // Константы, которые друг друга не читают, сходятся в один уровень.
    const nested =
      '((net) => ((fee) => net + fee > net * 2)(model.fee ?? 0))(model.price * model.qty)';
    const canonical =
      '((net, fee) => net + fee > net * 2)(model.price * model.qty, model.fee ?? 0)';
    expect(canonicalLocals(nested)).toBe(canonical);
    expect(canonicalLocals(canonical)).toBe(canonical);
    expect(canonicalLocals(' model.a  >  model.b ')).toBe(' model.a  >  model.b ');
    const reserved = '((value) => value > 0 && value < 5)(values.total)';
    expect(canonicalLocals(reserved)).toBe(reserved);
  });
});

describe('печать выражения с константами', () => {
  const inn: ValidationRuleIntent = {
    target: 'company.inn',
    rules: [],
    cross: foldLocals(
      [
        { name: 'digits', init: DIGITS },
        { name: 'weights', init: '[2, 4, 10, 3, 5, 9, 4, 6, 8]' },
      ],
      CHECKSUM
    ),
    code: 'company.inn.checksum',
  };

  it('правило поля — блоком: подвыражение записано один раз', () => {
    const { constants } = hoistRuleConstants([inn], {
      valueType: () => "Order['company']['inn']",
      taken: new Set(),
    });
    expect(constants[0]?.lines).toEqual([
      '/** Проверка поля `company.inn`: читает только его значение. */',
      "const companyInnChecksumRule: Rule<Order['company']['inn']> = (value) => {",
      "  const digits = String(value ?? '');",
      '  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];',
      `  return (${CHECKSUM}) ? null : { code: 'company.inn.checksum' };`,
      '};',
    ]);
    const code = constants[0]?.lines.join('\n') ?? '';
    expect(code.match(/String\(value/g)).toHaveLength(1);
  });

  it('проверка между полями — блоком в теле схемы', () => {
    const rule: ValidationRuleIntent = {
      target: 'end',
      rules: [],
      cross: foldLocals(
        [{ name: 'days', init: '(values.end - values.start) / 86400000' }],
        'days >= 1 && days <= values.limit'
      ),
      code: 'end.range',
    };
    const text = buildValidationSchemaTs([rule], {
      interfaceName: 'Trip',
      exportName: 'tripValidation',
      typeImport: './model',
    });
    expect(text).toContain(
      [
        '  cross(model.$.end, (values) => {',
        '    const days = (values.end - values.start) / 86400000;',
        "    return days >= 1 && days <= values.limit ? null : { code: 'end.range' };",
        '  });',
      ].join('\n')
    );
  });

  it('формула — блоком; формула без констант — одной строкой', () => {
    const intent = normalizeIntent({
      formName: 'Order',
      fields: [
        { name: 'price', type: 'number', component: 'InputNumber' },
        { name: 'qty', type: 'number', component: 'InputNumber' },
        { name: 'total', type: 'number', component: 'InputNumber' },
        { name: 'double', type: 'number', component: 'InputNumber' },
      ],
      behavior: [
        {
          kind: 'compute',
          target: 'total',
          sources: ['price', 'qty'],
          expr: foldLocals(
            [{ name: 'net', init: 'model.price * model.qty' }],
            'net > 1000 ? net * 0.9 : net'
          ),
        },
        { kind: 'compute', target: 'double', sources: ['total'], expr: 'model.total * 2' },
      ],
    });
    const text = buildBehaviorTs(intent);
    expect(text).toContain(
      [
        '  compute(model.$.total, () => {',
        '    const net = model.price * model.qty;',
        '    return net > 1000 ? net * 0.9 : net;',
        '  });',
        '  compute(model.$.double, () => model.total * 2);',
      ].join('\n')
    );
  });
});
