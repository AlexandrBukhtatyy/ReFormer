/**
 * Лямбды конструктора → выражения `form_edit`: параметр переименовывается в область, приведения
 * типов снимаются, всё, что сервер не соберёт, — отказ с подсказкой.
 */

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { lowerLambda, type LambdaScope } from '../src/core/codemode/dsl/lambda';

const lower = (source: string, scope: LambdaScope = 'model') => lowerLambda(ts, source, scope);

describe('lowerLambda', () => {
  it('параметр — область, как бы его ни назвали', () => {
    expect(lower('m => m.customerType === "company"')).toEqual({
      expr: 'model.customerType === "company"',
    });
    expect(lower('(form) => form.price * form.qty')).toEqual({
      expr: 'model.price * model.qty',
    });
    expect(lower('v => v.end >= v.start', 'values')).toEqual({
      expr: 'values.end >= values.start',
    });
    expect(lower('code => String(code).toUpperCase() === "ABC123"', 'value')).toEqual({
      expr: 'String(value).toUpperCase() === "ABC123"',
    });
    expect(lower('row => row.price * row.quantity', 'item')).toEqual({
      expr: 'item.price * item.quantity',
    });
  });

  it('блок с одним return, function, шаблонная строка, Math, as и !', () => {
    expect(lower('(m) => { return m.a > 0 && m.b !== null; }')).toEqual({
      expr: 'model.a > 0 && model.b !== null',
    });
    expect(lower('function (m) { return m.total ?? 0; }')).toEqual({ expr: 'model.total ?? 0' });
    expect(lower('m => `${m.first} ${m.last}`.trim()')).toEqual({
      expr: '`${model.first} ${model.last}`.trim()',
    });
    expect(lower('m => Math.round((m.price as number) * m.qty!)')).toEqual({
      expr: 'Math.round((model.price) * model.qty)',
    });
    expect(lower('m => m.deliveryDate ? new Date(m.deliveryDate) > new Date() : true')).toEqual({
      expr: 'model.deliveryDate ? new Date(model.deliveryDate) > new Date() : true',
    });
  });

  it('колбэк метода массива — свои параметры _1, _2, а не имена полей', () => {
    expect(lower('m => m.items.reduce((sum, row) => sum + row.lineTotal, 0)')).toEqual({
      expr: 'model.items.reduce((_1, _2) => _1 + _2.lineTotal, 0)',
    });
    expect(lower('m => m.recipients.some(r => r.email === m.email)')).toEqual({
      expr: 'model.recipients.some((_1) => _1.email === model.email)',
    });
  });

  it('статические функции и методы строк для контрольных сумм', () => {
    expect(lower('m => Array.from(m.items, r => r.price).length > 0')).toEqual({
      expr: 'Array.from(model.items, (_1) => _1.price).length > 0',
    });
    expect(lower('v => Number(String(v.inn).charAt(9)) === 0', 'values')).toEqual({
      expr: 'Number(String(values.inn).charAt(9)) === 0',
    });
    expect(lower('m => Number.isInteger(m.qty)')).toEqual({ expr: 'Number.isInteger(model.qty)' });
  });

  it('отказы с подсказкой', () => {
    const error = (source: string, scope: LambdaScope = 'model') => {
      const result = lower(source, scope);
      return 'error' in result ? result.error : `no error: ${result.expr}`;
    };
    expect(error('m => m.method = "courier"')).toMatch(/an assignment \(=\) — compare with ===/);
    expect(error('m => m.total + discount')).toMatch(/`discount` is not known inside the function/);
    expect(error('m => fetch(m.url)')).toMatch(/`fetch\(\)` is not allowed/);
    expect(error('m => new Map()')).toMatch(/no `new` except `new Date/);
    expect(error('m => this.x')).toMatch(/no `this`/);
    expect(error('(a, b) => a.x')).toMatch(/exactly one parameter/);
    expect(error('({ total }) => total > 0')).toMatch(/one plain parameter name/);
    expect(error('async v => { await wait(300); return v === "a"; }', 'value')).toMatch(
      /no async: the condition only — the server waits the delay itself/
    );
    expect(error('m => { const x = m.a; return x; }')).toMatch(/one expression/);
    expect(error('m => Object.assign({}, m)')).toMatch(/\.assign\(\) is not allowed/);
    expect(error('m => m.name.toLocaleUpperCase()')).toMatch(
      /\.toLocaleUpperCase\(\) is not allowed/
    );
    expect(error('m => m.a +')).toMatch(/not valid code/);
    expect(error('"model.a === 1"')).toMatch(/a function with one parameter/);
  });

  it('без модуля TypeScript — отказ: выражение строкой', () => {
    expect(lowerLambda(null, 'm => m.a', 'model')).toEqual({
      error:
        "an arrow needs the server's TypeScript package — pass the expression as a string instead",
    });
  });
});
