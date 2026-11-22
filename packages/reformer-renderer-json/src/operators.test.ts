import { describe, it, expect } from 'vitest';
import {
  parseOperator,
  isModelOp,
  isComponentOp,
  isHtmlOp,
  isDataSourceOp,
  isFnOp,
  isLocaleOp,
} from './operators';

describe('parseOperator', () => {
  it('parses each operator into { op, arg }', () => {
    expect(parseOperator('$model(email)')).toEqual({ op: 'model', arg: 'email' });
    expect(parseOperator('$component(Input)')).toEqual({ op: 'component', arg: 'Input' });
    expect(parseOperator('$dataSource(LOAN_TYPES)')).toEqual({
      op: 'dataSource',
      arg: 'LOAN_TYPES',
    });
    expect(parseOperator('$fn(formatCurrency)')).toEqual({ op: 'fn', arg: 'formatCurrency' });
    expect(parseOperator('$locale(fields.email.label)')).toEqual({
      op: 'locale',
      arg: 'fields.email.label',
    });
  });

  it('returns null for plain strings and non-strings', () => {
    expect(parseOperator('Введите сумму')).toBeNull();
    expect(parseOperator('fn(x)')).toBeNull(); // нет $-префикса
    expect(parseOperator('$fn()')).toBeNull(); // пустой аргумент
    expect(parseOperator('$unknown(x)')).toBeNull(); // неизвестный оператор
    expect(parseOperator(42)).toBeNull();
    expect(parseOperator(null)).toBeNull();
  });

  it('captures the whole arg greedily up to the last ")"', () => {
    // Ключи локализации — статичные литералы; вложенных операторов в них нет,
    // но жадный (.+) корректно берёт всё до последней скобки.
    expect(parseOperator('$locale(a.b.c)')).toEqual({ op: 'locale', arg: 'a.b.c' });
  });
});

describe('operator type-guards', () => {
  it('isFnOp matches only $fn(...)', () => {
    expect(isFnOp('$fn(propertyItemLabel)')).toBe(true);
    expect(isFnOp('$dataSource(LOAN_TYPES)')).toBe(false);
    expect(isFnOp('$locale(k)')).toBe(false);
    expect(isFnOp('plain')).toBe(false);
  });

  it('isLocaleOp matches only $locale(...)', () => {
    expect(isLocaleOp('$locale(fields.email.label)')).toBe(true);
    expect(isLocaleOp('$fn(x)')).toBe(false);
    expect(isLocaleOp('$model(x)')).toBe(false);
    expect(isLocaleOp('plain')).toBe(false);
  });

  it('existing guards stay mutually exclusive with the new ops', () => {
    expect(isModelOp('$fn(x)')).toBe(false);
    expect(isComponentOp('$locale(x)')).toBe(false);
    expect(isDataSourceOp('$fn(x)')).toBe(false);
  });

  it('isHtmlOp matches only $html(...)', () => {
    expect(isHtmlOp('$html(div)')).toBe(true);
    expect(isHtmlOp('$component(Input)')).toBe(false);
    expect(isHtmlOp('$model(x)')).toBe(false);
    expect(isHtmlOp('div')).toBe(false);
  });

  it('parseOperator разбирает $html(tag)', () => {
    expect(parseOperator('$html(div)')).toEqual({ op: 'html', arg: 'div' });
    expect(parseOperator('$html(h3)')).toEqual({ op: 'html', arg: 'h3' });
  });

  it('$component-гард не путается с $html (оба ссылаются на «что рендерить»)', () => {
    expect(isComponentOp('$html(div)')).toBe(false);
    expect(isHtmlOp('$component(Box)')).toBe(false);
  });
});
