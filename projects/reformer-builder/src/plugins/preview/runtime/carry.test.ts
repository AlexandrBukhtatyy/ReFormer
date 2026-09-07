/**
 * Перенос введённых значений в пересобранную форму.
 *
 * @module plugins/preview/runtime/carry.test
 */

import { describe, expect, it } from 'vitest';
import { carryValues } from './carry';

describe('carryValues', () => {
  it('переносить нечего — возвращается та же ссылка', () => {
    const base = { a: 1 };
    expect(carryValues(base, undefined)).toBe(base);
  });

  it('совпавший путь берётся из прежних значений', () => {
    expect(carryValues({ name: '' }, { name: 'Иванов' })).toEqual({ name: 'Иванов' });
  });

  it('новый путь получает свой дефолт, а не пустоту', () => {
    expect(carryValues({ name: '', age: 18 }, { name: 'Иванов' })).toEqual({
      name: 'Иванов',
      age: 18,
    });
  });

  it('исчезнувший путь отбрасывается: значению негде жить', () => {
    expect(carryValues({ name: '' }, { name: 'Иванов', legacy: 'x' })).toEqual({ name: 'Иванов' });
  });

  it('группы сливаются вглубь, а не целиком', () => {
    const result = carryValues(
      { person: { first: '', last: '', middle: '' } },
      { person: { first: 'Иван', last: 'Иванов' } }
    );
    expect(result).toEqual({ person: { first: 'Иван', last: 'Иванов', middle: '' } });
  });

  it('массив берётся прежний целиком: добавленные элементы принадлежат человеку', () => {
    const kept = [{ title: 'первый' }, { title: 'второй' }];
    expect(carryValues({ items: [] }, { items: kept })).toEqual({ items: kept });
  });

  it('смена типа поля отменяет перенос: старое значение стало мусором', () => {
    expect(carryValues({ age: 0 }, { age: 'восемнадцать' })).toEqual({ age: 0 });
    expect(carryValues({ tags: [] }, { tags: { a: 1 } })).toEqual({ tags: [] });
    expect(carryValues({ person: { first: '' } }, { person: null })).toEqual({
      person: { first: '' },
    });
  });

  it('пустое значение мока и null различаются, а не считаются одним родом', () => {
    expect(carryValues({ note: null }, { note: null })).toEqual({ note: null });
    expect(carryValues({ note: '' }, { note: null })).toEqual({ note: '' });
  });

  it('прежние значения не мутируются: форму с ними прямо сейчас показывают', () => {
    const previous = { person: { first: 'Иван' } };
    const snapshot = JSON.stringify(previous);
    carryValues({ person: { first: '', last: '' } }, previous);
    expect(JSON.stringify(previous)).toBe(snapshot);
  });

  it('ложные значения переносятся наравне с остальными', () => {
    expect(
      carryValues({ agree: true, count: 1, note: 'x' }, { agree: false, count: 0, note: '' })
    ).toEqual({ agree: false, count: 0, note: '' });
  });
});
