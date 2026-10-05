/**
 * `modelOf` — value-фасад по ручке дерева `model.$`, найденный по ИДЕНТИЧНОСТИ, а не по пути.
 *
 * На этом держится привязка во вложенных областях: путь ручки абсолютный (`items.0.phones`) и
 * меняется при перестановке строк, а область строки массива — отдельный корень.
 */

import { describe, it, expect } from 'vitest';
import { createModel, modelOf } from '../../../src/model/index';

interface Phone {
  number: string;
}
interface Contact {
  name: string;
  phones: Phone[];
}
interface Shape {
  title: string;
  address: { city: string; geo: { lat: number } };
  contacts: Contact[];
  tags: string[];
  spouse: { name: string } | null;
}

const createShape = () =>
  createModel<Shape>({
    title: '',
    address: { city: '', geo: { lat: 0 } },
    contacts: [
      { name: 'Анна', phones: [{ number: '1' }] },
      { name: 'Борис', phones: [] },
    ],
    tags: [],
    spouse: null,
  });

describe('modelOf — ручка `$` → value-фасад', () => {
  it('группа: та же под-модель, что через value-доступ', () => {
    const model = createShape();

    expect(modelOf(model.$.address)).toBe(model.address);
    expect(modelOf(model.$.address.geo)).toBe(model.address.geo);

    modelOf(model.$.address).city = 'Казань';
    expect(model.get().address.city).toBe('Казань');
    expect(modelOf(model.$.address).get()).toEqual({ city: 'Казань', geo: { lat: 0 } });
  });

  it('корень: `model.$` → сама модель', () => {
    const model = createShape();
    expect(modelOf(model.$)).toBe(model);
  });

  it('массив: тот же фасад, что через value-доступ, и он стабилен между обращениями', () => {
    const model = createShape();

    expect(model.contacts).toBe(model.contacts);
    expect(modelOf(model.$.contacts)).toBe(model.contacts);

    modelOf(model.$.contacts).push({ name: 'Вера', phones: [] });
    expect(model.contacts.length).toBe(3);
  });

  it('массив примитивов: фасад массива, а не под-модель', () => {
    const model = createShape();
    modelOf(model.$.tags).push('a');
    expect(model.get().tags).toEqual(['a']);
  });

  it('строка массива и массив внутри строки', () => {
    const model = createShape();
    const firstRow = model.contacts.at(0);

    expect(modelOf(model.$.contacts[0])).toBe(firstRow);
    expect(modelOf(firstRow.$.phones)).toBe(firstRow.phones);
    expect(modelOf(model.$.contacts[0].phones)).toBe(firstRow.phones);
  });

  it('перестановка строк: ручка строки по-прежнему ведёт к той же под-модели', () => {
    const model = createShape();
    const anna = model.contacts.at(0);
    const annaHandle = model.$.contacts[0];

    model.contacts.move(0, 1);

    // Путь ручки сменился, идентичность — нет.
    expect((annaHandle as unknown as { __path: string }).__path).toBe('contacts.1');
    expect(modelOf(annaHandle)).toBe(anna);
    expect(modelOf(model.$.contacts[1])).toBe(anna);
  });

  it('лист: понятная ошибка с путём', () => {
    const model = createShape();
    expect(() => modelOf(model.$.title as never)).toThrow(/modelOf: ручка «title» — лист/);
  });

  it('группа из начального null — лист: та же ошибка с подсказкой', () => {
    const model = createShape();
    expect(() => modelOf(model.$.spouse as never)).toThrow(/созданные из начального null/);
  });

  it('не ручка модели: понятная ошибка', () => {
    const model = createShape();
    // value-фасад — не ручка: ручка лежит в `model.$`
    expect(() => modelOf(model.address as never)).toThrow(/ожидалась ручка группы или массива/);
    expect(() => modelOf({ peek: () => ({}) })).toThrow(/ожидалась ручка группы или массива/);
    expect(() => modelOf(null as never)).toThrow(/ожидалась ручка группы или массива/);
  });
});
