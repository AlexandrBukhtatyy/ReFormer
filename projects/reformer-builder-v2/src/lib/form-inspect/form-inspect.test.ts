/**
 * Чтение и правка модели — против НАСТОЯЩЕЙ формы `@reformer/core`.
 *
 * Подставная модель здесь бесполезна: проверяется ровно то, что правка из панели идёт тем же
 * путём, что ввод в контрол, и потому запускает поведение (`compute`) и валидацию. Двойник
 * подтвердил бы только, что мы позвали свои же функции.
 *
 * @module lib/form-inspect/form-inspect.test
 */

import { describe, expect, it } from 'vitest';
import { createForm, createModel } from '@reformer/core';
import { compute, defineFormBehavior } from '@reformer/core/behaviors';

import {
  collectRows,
  nodeAt,
  readNodeState,
  resetNode,
  setNodeDisabled,
  setNodeError,
  snapshot,
  valueAt,
  writeValue,
} from './index';

interface Order {
  price: number;
  quantity: number;
  total: number;
  customer: { name: string; email: string };
  tags: string[];
}

function makeForm() {
  const model = createModel<Order>({
    price: 100,
    quantity: 2,
    total: 0,
    customer: { name: '', email: '' },
    tags: [],
  });
  const behavior = defineFormBehavior<Order>(({ model: m }) => {
    compute(m.$.total, () => m.$.price.value * m.$.quantity.value);
  });
  createForm({ model, behavior });
  return model;
}

describe('дерево значений', () => {
  it('раскрывает группы и оставляет массив одной строкой', () => {
    const rows = collectRows({
      price: 100,
      customer: { name: 'Иван' },
      tags: ['a', 'b'],
    });

    expect(rows.map((row) => `${row.kind}:${row.path}`)).toEqual([
      'leaf:price',
      'group:customer',
      'leaf:customer.name',
      'array:tags',
    ]);
    // Элементы массива адресуются `tags[0]`, а панель работает с `$model`-путями схемы,
    // где такого пути нет.
    expect(rows.find((row) => row.path === 'tags')?.value).toEqual(['a', 'b']);
  });

  it('глубина считается для отступа', () => {
    const rows = collectRows({ a: { b: { c: 1 } } });

    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2]);
  });
});

describe('чтение состояния узла', () => {
  it('находит узел по $model-пути, включая вложенный', () => {
    const model = makeForm();

    expect(nodeAt(model, 'price')).not.toBeNull();
    expect(nodeAt(model, 'customer.name')).not.toBeNull();
    expect(nodeAt(model, 'нет.такого')).toBeNull();
  });

  it('помечает цель compute производной — писать в неё бессмысленно', () => {
    const model = makeForm();

    expect(readNodeState(model, 'total')?.derived).toBe(true);
    expect(readNodeState(model, 'price')?.derived).toBe(false);
  });

  it('отдаёт touched, dirty и ошибки', () => {
    const model = makeForm();

    expect(readNodeState(model, 'price')).toMatchObject({
      touched: false,
      dirty: false,
      disabled: false,
      errors: [],
      // Умолчание ЯДРА — 'blur', а не 'change': правка из панели равна «ввёл и ушёл с поля»
      // для всех полей, а не для редких.
      updateOn: 'blur',
    });
  });
});

describe('правка значения', () => {
  it('идёт тем же путём, что ввод в контрол: compute пересчитывается сам', () => {
    const model = makeForm();

    expect(writeValue(model, 'quantity', 3)).toBeNull();

    // Ради этого правка и заводится: поведение подписано на сигнал, а не на событие интерфейса.
    expect(valueAt(model, 'total')).toBe(300);
  });

  it('обычная правка поднимает touched — как уход с поля', () => {
    const model = makeForm();

    writeValue(model, 'customer.name', 'Иван');

    expect(readNodeState(model, 'customer.name')).toMatchObject({ touched: true, dirty: true });
    expect(valueAt(model, 'customer.name')).toBe('Иван');
  });

  it('сырая запись кладёт значение, не поднимая touched', () => {
    const model = makeForm();

    // Так выглядят данные, пришедшие с бэкенда: значение есть, а человек поля не касался.
    expect(writeValue(model, 'customer.name', null, { raw: true })).toBeNull();

    expect(valueAt(model, 'customer.name')).toBeNull();
    expect(readNodeState(model, 'customer.name')?.touched).toBe(false);
  });

  it('ОТКАЗЫВАЕТ на производном пути, а не пишет впустую', () => {
    const model = makeForm();

    expect(writeValue(model, 'total', 999)).toBe('derived');
    // Значение осталось вычисленным: поведение всё равно вернуло бы своё.
    expect(valueAt(model, 'total')).toBe(200);
  });

  it('ОТКАЗЫВАЕТ на пути, которого в форме нет', () => {
    const model = makeForm();

    expect(writeValue(model, 'нет.такого', 1)).toBe('no-node');
  });
});

describe('операции над узлом', () => {
  it('возврат к начальному откатывает эксперимент', () => {
    const model = makeForm();
    writeValue(model, 'price', 500);

    expect(resetNode(model, 'price')).toBe(true);
    expect(valueAt(model, 'price')).toBe(100);
  });

  it('выключение поля видно в состоянии', () => {
    const model = makeForm();

    expect(setNodeDisabled(model, 'price', true)).toBe(true);
    expect(readNodeState(model, 'price')?.disabled).toBe(true);

    setNodeDisabled(model, 'price', false);
    expect(readNodeState(model, 'price')?.disabled).toBe(false);
  });

  it('подставленная ошибка показывается как настоящая', () => {
    const model = makeForm();

    expect(setNodeError(model, 'customer.email', 'уже занят')).toBe(true);
    expect(readNodeState(model, 'customer.email')?.errors).toEqual(['уже занят']);

    setNodeError(model, 'customer.email', '');
    expect(readNodeState(model, 'customer.email')?.errors).toEqual([]);
  });
});

describe('снимок модели', () => {
  it('отдаёт значения целиком — их вставляют в фикстуру', () => {
    const model = makeForm();
    writeValue(model, 'quantity', 4);

    expect(snapshot(model)).toMatchObject({ price: 100, quantity: 4, total: 400 });
  });
});
