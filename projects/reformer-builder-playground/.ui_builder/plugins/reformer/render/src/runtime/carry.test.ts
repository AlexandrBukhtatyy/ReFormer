/**
 * Перенос введённых значений в пересобранную форму.
 *
 * @module plugins/reformer/render/runtime/carry.test
 */

import { describe, expect, it } from 'vitest';
import { carryValues } from './carry';
import type { FieldKinds, SlotKind } from './kinds';

/** Виды полей новой формы — как их назвала бы её схема. */
const kinds = (entries: Record<string, SlotKind>): FieldKinds => new Map(Object.entries(entries));

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

  it('дата — значение листа, а не группа: по ключам её не разбирают', () => {
    const picked = new Date(2020, 0, 1);
    // Прежде дата поверх даты давала пустой объект: обе считались группами.
    expect(carryValues({ birthDate: new Date(0) }, { birthDate: picked })).toEqual({
      birthDate: picked,
    });
    expect(carryValues({ birthDate: new Date(0) }, { birthDate: 'вчера' })).toEqual({
      birthDate: new Date(0),
    });
  });
});

describe('carryValues — поле с начальным null', () => {
  const picked = new Date(2020, 0, 1);
  const file = { id: 'f1', name: 'паспорт.pdf' };
  /** Синтез по схеме: у этих видов поля начальное значение — `null`. */
  const base = { age: null, birthDate: null, skills: null, documents: null, position: null };
  /** То, что человек успел ввести до правки схемы. */
  const entered = {
    age: 5,
    birthDate: picked,
    skills: ['react', 'sql'],
    documents: [file],
    position: 'analyst',
  };
  const schema = kinds({
    age: 'number',
    birthDate: 'date',
    skills: 'multi',
    documents: 'file',
    position: 'select',
  });

  it('по одной паре значений род не понять: без видов полей введённое теряется', () => {
    // Это и был дефект: пара «`null` и введённое» одного рода не бывает никогда.
    expect(carryValues(base, entered)).toEqual(base);
  });

  it('вид поля из схемы переносит введённое: число, дата, мультивыбор, файлы, комбобокс', () => {
    expect(carryValues(base, entered, schema)).toEqual(entered);
  });

  it('значение не того вида, что поле новой формы, не переносится', () => {
    // Поле переделали: строка — в число, мультивыбор — в одиночный выбор, дата — в строку.
    const changed = kinds({ age: 'number', position: 'select', birthDate: 'string' });
    expect(
      carryValues(
        { age: null, position: '', birthDate: '' },
        { age: 'восемнадцать', position: ['analyst'], birthDate: picked },
        changed
      )
    ).toEqual({ age: null, position: '', birthDate: '' });
  });

  it('очищенное поле остаётся очищенным там, где «пусто» у вида — null', () => {
    // Число с нижней границей получает её дефолтом, а человек поле очистил.
    expect(carryValues({ age: 1 }, { age: null }, kinds({ age: 'number' }))).toEqual({ age: null });
    // У строки и флажка пустое значение своё — `null` им не годится.
    expect(
      carryValues(
        { note: '', agree: false },
        { note: null, agree: null },
        kinds({ note: 'string', agree: 'boolean' })
      )
    ).toEqual({ note: '', agree: false });
  });

  it('вид поля читается по полному пути: поле группы — со своим префиксом', () => {
    expect(
      carryValues(
        { person: { age: null }, age: null },
        { person: { age: 30 }, age: 'мусор' },
        kinds({ 'person.age': 'number', age: 'number' })
      )
    ).toEqual({ person: { age: 30 }, age: null });
  });

  it('список не переносится ни в массив формы из листа, ни в лист из массива формы', () => {
    const schemaOfArrays = kinds({ items: 'array', name: 'string' });
    expect(carryValues({ items: [] }, { items: 'строка' }, schemaOfArrays)).toEqual({ items: [] });
    expect(carryValues({ name: '' }, { name: [{ title: 'x' }] }, schemaOfArrays)).toEqual({
      name: '',
    });
  });

  it('свой контрол схема числит строкой — решает род значения, которое форма кладёт сама', () => {
    // Мок автора дал оценке число: прежнее число того же рода, и вид «строка» ему не помеха.
    expect(carryValues({ rating: 3 }, { rating: 5 }, kinds({ rating: 'string' }))).toEqual({
      rating: 5,
    });
  });

  it('путь без поля в схеме сверяется по паре значений, как раньше', () => {
    expect(carryValues({ hidden: null, total: 0 }, { hidden: 'x', total: 7 }, schema)).toEqual({
      hidden: null,
      total: 7,
    });
  });
});
