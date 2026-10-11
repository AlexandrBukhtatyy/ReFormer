/**
 * Начальные значения модуля против формы данных живой схемы.
 *
 * @module plugins/reformer/render/runtime/initial.test
 */

import { describe, expect, it } from 'vitest';
import { deepMerge } from '../../../core/form-fixture';
import { fitInitialValues } from './initial';

/** Что в итоге увидит форма: подогнанные значения модуля поверх синтеза. */
function applied(base: Record<string, unknown>, declared: Record<string, unknown>) {
  return deepMerge(base, fitInitialValues(base, declared) ?? {});
}

describe('fitInitialValues', () => {
  it('модуль значений не объявил — подгонять нечего', () => {
    expect(fitInitialValues({ name: '' }, undefined)).toBeUndefined();
  });

  it('значение модуля ложится на своё поле', () => {
    expect(applied({ name: '', city: '' }, { name: 'Иванов' })).toEqual({
      name: 'Иванов',
      city: '',
    });
  });

  it('поле, которого в живой схеме уже нет, отбрасывается', () => {
    expect(applied({ name: '' }, { name: 'Иванов', legacy: 'x' })).toEqual({ name: 'Иванов' });
  });

  it('поле, добавленное после генерации, остаётся со значением синтеза', () => {
    expect(applied({ name: '', age: 18 }, { name: 'Иванов' })).toEqual({ name: 'Иванов', age: 18 });
  });

  it('группы подгоняются вглубь', () => {
    expect(
      applied(
        { person: { first: '', last: '', middle: '' } },
        { person: { first: 'Иван', nick: 'x' } }
      )
    ).toEqual({ person: { first: 'Иван', last: '', middle: '' } });
  });

  it('поле стало группой — строка модуля на её месте не ложится: сигналам группы негде вырасти', () => {
    expect(applied({ contacts: { email: '' } }, { contacts: 'ivan@example.com' })).toEqual({
      contacts: { email: '' },
    });
  });

  it('группа стала полем — объект модуля на месте листа не ложится', () => {
    expect(applied({ contacts: '' }, { contacts: { email: 'ivan@example.com' } })).toEqual({
      contacts: '',
    });
  });

  it('массив модуля берётся целиком, но только на место массива', () => {
    const rows = [{ title: 'первый' }];
    expect(applied({ items: [] }, { items: rows })).toEqual({ items: rows });
    expect(applied({ items: [] }, { items: 'нет' })).toEqual({ items: [] });
    // У мультивыбора синтез даёт `null` намеренно: массив в начальном значении модель приняла
    // бы за массив под-форм, и у поля не оказалось бы сигнала.
    expect(applied({ tags: null }, { tags: ['a'] })).toEqual({ tags: null });
  });

  it('лист на лист — значение модуля, каким бы ни был его род', () => {
    // Синтез у числа без нижней границы и у даты — `null`; значение модуля на таком месте не
    // смена рода, а то, ради чего начальные значения объявляют.
    expect(applied({ amount: null, since: null }, { amount: 100000, since: '2026-01-01' })).toEqual(
      { amount: 100000, since: '2026-01-01' }
    );
    expect(applied({ agree: true, count: 1 }, { agree: false, count: 0 })).toEqual({
      agree: false,
      count: 0,
    });
    expect(applied({ note: 'x' }, { note: null })).toEqual({ note: null });
  });

  it('ни синтез, ни значения модуля не мутируются', () => {
    const base = { person: { first: '' } };
    const declared = { person: { first: 'Иван', nick: 'x' }, legacy: 1 };
    const before = [JSON.stringify(base), JSON.stringify(declared)];
    fitInitialValues(base, declared);
    expect([JSON.stringify(base), JSON.stringify(declared)]).toEqual(before);
  });
});
