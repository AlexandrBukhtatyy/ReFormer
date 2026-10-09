/**
 * Сигнал узнаётся по метке рантайма, а не по классу.
 *
 * Проверка `value instanceof Signal` отвечает «нет» сигналу из другой копии
 * `@preact/signals-core`. `isSignal` сверяет метку, общую для всех копий, а ручки дерева
 * `model.$` различает служебный ключ `__kind`.
 */

import { describe, expect, it } from 'vitest';
import { computed, signal } from '@preact/signals-core';
import { isSignal } from '../../../src/signals';
import {
  createModel,
  isModelContainerSignal,
  isValueSignal,
  modelOf,
} from '../../../src/model/index';

/** Сигнал, каким его видит код при второй копии рантайма: своя метка, чужой класс. */
const foreignSignal = (value: unknown) => ({
  brand: Symbol.for('preact-signals'),
  value,
  peek: () => value,
  subscribe: () => () => {},
});

const createShape = () =>
  createModel({ name: '', tags: ['a'], address: { city: '' }, rows: [{ title: '' }] });

describe('isSignal', () => {
  it('узнаёт signal и computed', () => {
    const source = signal(1);

    expect(isSignal(source)).toBe(true);
    expect(isSignal(computed(() => source.value))).toBe(true);
  });

  it('узнаёт сигнал из другой копии рантайма', () => {
    expect(isSignal(foreignSignal(1))).toBe(true);
  });

  it('отвергает всё остальное', () => {
    for (const value of [null, undefined, 1, 'text', {}, [], { value: 1 }, () => 1]) {
      expect(isSignal(value)).toBe(false);
    }
    expect(isSignal({ brand: Symbol('preact-signals') })).toBe(false);
  });

  it('узнаёт ручки дерева model.$ — и листья, и контейнеры', () => {
    const model = createShape();

    expect(isSignal(model.$.name)).toBe(true);
    expect(isSignal(model.$.tags)).toBe(true);
    expect(isSignal(model.$.address)).toBe(true);
    expect(isSignal(model.$)).toBe(true);
  });

  it('value-фасады модели сигналами не считает', () => {
    const model = createShape();

    expect(isSignal(model)).toBe(false);
    expect(isSignal(model.address)).toBe(false);
    expect(isSignal(model.tags)).toBe(false);
  });
});

describe('isValueSignal — ручка, к которой привязывают поле', () => {
  it('лист и массив целиком — да, группа — нет', () => {
    const model = createShape();

    expect(isValueSignal(model.$.name)).toBe(true);
    expect(isValueSignal(model.$.tags)).toBe(true);
    expect(isValueSignal(model.$.rows)).toBe(true);
    expect(isValueSignal(model.$.address)).toBe(false);
    expect(isValueSignal(model.$)).toBe(false);
    expect(isValueSignal(model.$.rows[0])).toBe(false);
  });

  it('сигнал вне модели — тоже ручка значения, в том числе из другой копии рантайма', () => {
    expect(isValueSignal(signal(''))).toBe(true);
    expect(isValueSignal(computed(() => ''))).toBe(true);
    expect(isValueSignal(foreignSignal(''))).toBe(true);
  });

  it('обычные значения ручкой не являются', () => {
    for (const value of [null, undefined, 'text', {}, { value: 1 }, []]) {
      expect(isValueSignal(value)).toBe(false);
    }
  });

  it('поле данных по имени brand не превращает группу в ручку значения', () => {
    const model = createModel({ product: { brand: 'ACME', title: '' } });

    expect(isModelContainerSignal(model.$.product)).toBe(true);
    expect(isValueSignal(model.$.product)).toBe(false);
    expect(isValueSignal(model.$.product.brand)).toBe(true);
  });
});

describe('modelOf — текст ошибки различает лист и постороннее значение', () => {
  it('лист', () => {
    const model = createShape();

    expect(() => modelOf(model.$.name as never)).toThrow(/ручка «name» — лист/);
    expect(() => modelOf(foreignSignal('') as never)).toThrow(/лист/);
  });

  it('не ручка модели', () => {
    expect(() => modelOf({ peek: () => ({}) })).toThrow(/ожидалась ручка группы или массива/);
  });
});
