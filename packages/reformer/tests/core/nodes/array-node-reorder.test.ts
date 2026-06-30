/**
 * Unit tests: ArrayNode.move() / swap() — перестановка элементов self-owned массива.
 * Проверяет порядок значений, сохранение длины, идентичность элементов (без dispose),
 * реактивность сигнала value и bounds-check (out-of-range → no-op).
 */

import { describe, it, expect } from 'vitest';
import { effect } from '@preact/signals-core';
import { ArrayNode } from '../../../src/core/nodes/array-node';
import { ComponentInstance } from '../../test-utils/types';

interface Item {
  name: string;
  qty: number;
}

const schema = {
  name: { value: '', component: null as ComponentInstance },
  qty: { value: 0, component: null as ComponentInstance },
};

const build = () =>
  new ArrayNode<Item>(schema, [
    { name: 'A', qty: 1 },
    { name: 'B', qty: 2 },
    { name: 'C', qty: 3 },
  ]);

describe('ArrayNode.move()', () => {
  it('перемещает элемент с from на to, сохраняя длину', () => {
    const arr = build();
    arr.move(0, 2); // A в конец
    expect(arr.value.value.map((i) => i.name)).toEqual(['B', 'C', 'A']);
    expect(arr.length.value).toBe(3);
  });

  it('перемещение вверх (move к меньшему индексу)', () => {
    const arr = build();
    arr.move(2, 0); // C в начало
    expect(arr.value.value.map((i) => i.name)).toEqual(['C', 'A', 'B']);
  });

  it('сохраняет инстанс элемента (без пересоздания) и его состояние', () => {
    const arr = build();
    const itemA = arr.at(0)!;
    itemA.qty.setValue(42);
    arr.move(0, 2);
    const movedA = arr.at(2)!;
    expect(movedA).toBe(itemA);
    expect(movedA.qty.value.value).toBe(42);
  });

  it('реактивен: сигнал value пересчитывается при перестановке', () => {
    const arr = build();
    const seen: string[][] = [];
    const dispose = effect(() => {
      seen.push(arr.value.value.map((i) => i.name));
    });
    arr.move(0, 2);
    dispose();
    expect(seen[0]).toEqual(['A', 'B', 'C']);
    expect(seen[seen.length - 1]).toEqual(['B', 'C', 'A']);
  });

  it('from === to — no-op', () => {
    const arr = build();
    arr.move(1, 1);
    expect(arr.value.value.map((i) => i.name)).toEqual(['A', 'B', 'C']);
  });

  it('out-of-bounds — no-op (массив не меняется)', () => {
    const arr = build();
    arr.move(-1, 0);
    arr.move(0, 5);
    arr.move(10, 0);
    expect(arr.value.value.map((i) => i.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('ArrayNode.swap()', () => {
  it('меняет местами два элемента', () => {
    const arr = build();
    arr.swap(0, 2);
    expect(arr.value.value.map((i) => i.name)).toEqual(['C', 'B', 'A']);
    expect(arr.length.value).toBe(3);
  });

  it('сохраняет инстансы обоих элементов', () => {
    const arr = build();
    const a = arr.at(0)!;
    const c = arr.at(2)!;
    arr.swap(0, 2);
    expect(arr.at(0)!).toBe(c);
    expect(arr.at(2)!).toBe(a);
  });

  it('a === b — no-op', () => {
    const arr = build();
    arr.swap(1, 1);
    expect(arr.value.value.map((i) => i.name)).toEqual(['A', 'B', 'C']);
  });

  it('out-of-bounds — no-op', () => {
    const arr = build();
    arr.swap(0, 9);
    expect(arr.value.value.map((i) => i.name)).toEqual(['A', 'B', 'C']);
  });
});
