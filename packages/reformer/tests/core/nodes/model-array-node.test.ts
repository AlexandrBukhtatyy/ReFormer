/**
 * Unit tests: ModelArrayNode — узел массива, делегирующий массиву FormModel (M1).
 * Проверяет привязку данных/структуры: length/value/at/map/push/removeAt/insert/clear,
 * двусторонняя связь item-полей с под-моделью, реактивность длины.
 */

import { describe, it, expect } from 'vitest';
import { effect } from '@preact/signals-core';
import { createModel } from '../../../src/core/model';
import { ModelArrayNode } from '../../../src/core/nodes/model-array-node';
import { createForm } from '../../../src/core/utils/create-form';
import type { FormModel } from '../../../src/core/model';

interface Row {
  name: string;
  qty: number;
}
interface Form {
  rows: Row[];
}

const itemSchema = (item: FormModel<Row>) => ({
  children: [{ value: item.$.name }, { value: item.$.qty }],
});

const build = () => {
  const model = createModel<Form>({ rows: [] });
  // control = реактивный массив модели (value-proxy)
  const arr = new ModelArrayNode<Row>(model.rows as never, (m) =>
    createForm<Row>({ model: m as FormModel<Row>, schema: itemSchema(m as FormModel<Row>) })
  );
  return { model, arr };
};

describe('ModelArrayNode', () => {
  it('length и value отражают массив модели; push обновляет модель', () => {
    const { model, arr } = build();
    expect(arr.length.value).toBe(0);
    arr.push({ name: 'A', qty: 1 });
    expect(arr.length.value).toBe(1);
    expect(model.get().rows).toEqual([{ name: 'A', qty: 1 }]);
    expect(arr.value.value).toEqual([{ name: 'A', qty: 1 }]);
  });

  it('at(i) даёт форму элемента, привязанную к под-модели (двусторонняя связь)', () => {
    const { model, arr } = build();
    arr.push({ name: 'A', qty: 1 });
    const item = arr.at(0)!;
    expect(item.name.value.value).toBe('A');
    item.name.setValue('B');
    expect(model.get().rows[0].name).toBe('B');
    expect(arr.value.value[0].name).toBe('B');
  });

  it('length реактивна (effect перезапускается на push)', () => {
    const { arr } = build();
    const seen: number[] = [];
    const dispose = effect(() => {
      seen.push(arr.length.value);
    });
    arr.push({ name: 'X', qty: 0 });
    arr.push({ name: 'Y', qty: 0 });
    expect(seen).toEqual([0, 1, 2]);
    dispose();
  });

  it('map итерирует элементы как формы', () => {
    const { arr } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });
    const names = arr.map((item) => item.name.value.value);
    expect(names).toEqual(['A', 'B']);
  });

  it('removeAt переиндексирует; элемент сохраняет привязку', () => {
    const { model, arr } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });
    arr.removeAt(0);
    expect(arr.length.value).toBe(1);
    const item0 = arr.at(0)!;
    expect(item0.name.value.value).toBe('B');
    item0.qty.setValue(99);
    expect(model.get().rows[0]).toEqual({ name: 'B', qty: 99 });
  });

  it('insert и clear', () => {
    const { model, arr } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.insert(0, { name: 'Z', qty: 0 });
    expect(arr.map((i) => i.name.value.value)).toEqual(['Z', 'A']);
    arr.clear();
    expect(arr.length.value).toBe(0);
    expect(model.get().rows).toEqual([]);
  });

  it('setValue/reset заменяют массив модели', () => {
    const { model, arr } = build();
    arr.setValue([
      { name: 'A', qty: 1 },
      { name: 'B', qty: 2 },
    ]);
    expect(arr.length.value).toBe(2);
    expect(model.get().rows.length).toBe(2);
    arr.reset(); // к initial (пустой)
    expect(arr.length.value).toBe(0);
  });

  it('move переупорядочивает модель и формы элементов', () => {
    const { model, arr } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });
    arr.push({ name: 'C', qty: 3 });

    arr.move(0, 2); // A в конец
    expect(arr.map((i) => i.name.value.value)).toEqual(['B', 'C', 'A']);
    expect(model.get().rows.map((r) => r.name)).toEqual(['B', 'C', 'A']);
    expect(arr.length.value).toBe(3);
  });

  it('move сохраняет состояние под-формы (тот же инстанс едет на новую позицию)', () => {
    const { model, arr } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });
    const itemA = arr.at(0)!;
    itemA.qty.setValue(42); // правим элемент A до перестановки

    arr.move(0, 1); // A → индекс 1

    const movedA = arr.at(1)!;
    expect(movedA).toBe(itemA); // идентичность сохранена (кеш по фасаду под-модели)
    expect(movedA.qty.value.value).toBe(42);
    expect(model.get().rows).toEqual([
      { name: 'B', qty: 2 },
      { name: 'A', qty: 42 },
    ]);
  });

  it('swap меняет местами два элемента', () => {
    const { model, arr } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });
    arr.push({ name: 'C', qty: 3 });

    arr.swap(0, 2);
    expect(arr.map((i) => i.name.value.value)).toEqual(['C', 'B', 'A']);
    expect(model.get().rows.map((r) => r.name)).toEqual(['C', 'B', 'A']);
  });

  it('move реактивен (effect перезапускается при перестановке)', () => {
    const { arr } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });

    const order: string[][] = [];
    const dispose = effect(() => {
      order.push(arr.value.value.map((r) => r.name));
    });
    arr.move(0, 1);
    dispose();

    expect(order[0]).toEqual(['A', 'B']);
    expect(order[order.length - 1]).toEqual(['B', 'A']);
  });
});
