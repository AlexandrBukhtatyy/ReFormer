/**
 * Value-фасад модели — `model.<поле>`, фасад массива и внутренние помощники
 * (`src/model/model-value-proxy.ts`).
 *
 * Фасад обещает доступ «как у обычного объекта»: поля читаются и пишутся, вложенная группа —
 * под-модель, массив — объект с мутациями и обходом. Здесь закреплены его края: итерация и `in`
 * у фасада массива, перечисление ключей и символьные ключи, запись неизвестного ключа (модуль
 * теста — ESM, то есть strict: ловушка `set` отвечает `false`, и движок бросает `TypeError`),
 * поле с именем метода API, а также помощники, которыми пользуется форма: `isModelFacade`,
 * `provideArrayBlank`, `arrayHandleOf`, `groupHandleOf`.
 */

import { describe, expect, it } from 'vitest';
import { effect } from '@preact/signals-core';
import { arrayOf, createModel, modelOf } from '../../../src/model/index';
import {
  arrayHandleOf,
  groupHandleOf,
  isModelFacade,
  provideArrayBlank,
} from '../../../src/model/model-value-proxy';

interface Row {
  title: string;
  qty: number;
}
interface Shape {
  name: string;
  tags: string[];
  rows: Row[];
  address: { city: string };
}

const createShape = () =>
  createModel<Shape>({
    name: 'Анна',
    tags: ['a', 'b'],
    rows: [
      { title: 'x', qty: 1 },
      { title: 'y', qty: 2 },
    ],
    address: { city: 'Казань' },
  });

/** Доступ к произвольному ключу фасада — для проверок вне объявленного типа. */
const loose = (facade: unknown) => facade as Record<PropertyKey, unknown>;

/** Фасад массива итерируем в рантайме; тип `ModelArray` итератор не объявляет. */
const iterable = <T>(array: unknown) => array as Iterable<T>;

describe('model-value-proxy — фасад массива: обход и индексы', () => {
  it('for…of отдаёт значения листьев и под-модели строк', () => {
    const model = createShape();
    const tags: string[] = [];
    for (const tag of iterable<string>(model.tags)) tags.push(tag);

    expect(tags).toEqual(['a', 'b']);
    expect([...iterable(model.rows)]).toEqual([model.rows.at(0), model.rows.at(1)]);
  });

  it("in: '0' — есть ли элемент, имя метода и символ итератора — да, __path — нет", () => {
    const model = createShape();

    expect('0' in model.tags).toBe(true);
    expect('1' in model.tags).toBe(true);
    expect('2' in model.tags).toBe(false);
    expect('-1' in model.tags).toBe(false);
    expect('push' in model.tags).toBe(true);
    expect(Symbol.iterator in model.tags).toBe(true);
    expect('__path' in model.tags).toBe(false);

    model.tags.clear();
    expect('0' in model.tags).toBe(false);
  });

  it('map и forEach получают фасад строки и индекс', () => {
    const model = createShape();
    const seen: Array<[string, number]> = [];

    model.rows.forEach((row, index) => seen.push([row.title, index]));

    expect(model.rows.map((row, index) => `${index}:${row.title}`)).toEqual(['0:x', '1:y']);
    expect(model.rows.map((row) => row)[1]).toBe(model.rows.at(1));
    expect(seen).toEqual([
      ['x', 0],
      ['y', 1],
    ]);
  });

  it('индекс за концом и отрицательный — undefined', () => {
    const model = createShape();

    expect(model.rows.at(2)).toBeUndefined();
    expect(model.rows.at(-1)).toBeUndefined();
    expect(model.tags[5]).toBeUndefined();
  });

  it('__path массива и строк; swap и clear переиндексируют и очищают', () => {
    const model = createShape();

    expect(model.rows.__path).toBe('rows');
    model.rows.swap(0, 1);
    expect(model.rows.toArray().map((row) => row.title)).toEqual(['y', 'x']);
    expect(loose(model.rows.at(0)).__path).toBe('rows.0');
    expect(model.rows.at(0).$.title.__path).toBe('rows.0.title');

    model.rows.clear();
    expect(model.rows.length).toBe(0);
    expect(model.get().rows).toEqual([]);
  });

  it('чтение длины, индекса и `in` внутри effect подписывает на состав', () => {
    const model = createShape();
    const seen: Array<[number, string | undefined, boolean]> = [];
    const stop = effect(() => {
      seen.push([model.tags.length, model.tags[0], '1' in model.tags]);
    });

    model.tags.insertAt(0, 'z');
    model.tags.removeAt(0);
    model.tags.removeAt(1);

    expect(seen).toEqual([
      [2, 'a', true],
      [3, 'z', true],
      [2, 'a', true],
      [1, 'a', false],
    ]);
    stop();
  });

  it('length фасада массива не пишется: TypeError, длина прежняя', () => {
    const model = createShape();

    expect(() => {
      loose(model.tags).length = 0;
    }).toThrow(TypeError);
    expect(model.tags.length).toBe(2);
  });

  it('Object.keys фасада массива — ключи API, а не индексы', () => {
    // поведение под вопросом [ReFormer-ix06]: у фасада массива нет ловушки ownKeys — перечисляются
    // методы API, поэтому `{ ...model.tags }` и `Object.keys(model.tags)` на массив не похожи.
    expect(Object.keys(createShape().tags)).toEqual([
      'length',
      'push',
      'insertAt',
      'removeAt',
      'move',
      'swap',
      'clear',
      'at',
      'map',
      'forEach',
      'toArray',
      'toJSON',
    ]);
  });

  it('присваивание по индексу пишет элемент массива [ReFormer-a4z7]', () => {
    const model = createShape();

    model.tags[0] = 'z';

    expect(model.get().tags).toEqual(['z', 'b']);
  });

  it('присваивание по индексу за концом — TypeError с подсказкой, массив прежний', () => {
    const model = createShape();

    expect(() => {
      model.tags[2] = 'c';
    }).toThrow(/model\.tags\[2\]: элемента нет — добавляйте через push/);
    expect(model.get().tags).toEqual(['a', 'b']);
  });

  it('запись в ключ, который не индекс, — TypeError с путём массива', () => {
    const model = createShape();

    expect(() => {
      loose(model.tags).extra = 1;
    }).toThrow(/model\.tags: запись в «extra» невозможна/);
    expect(Object.keys(model.tags)).not.toContain('extra');
  });

  it('JSON.stringify(model) сериализует массив его значениями [ReFormer-poru]', () => {
    const model = createShape();

    expect(JSON.parse(JSON.stringify(model))).toEqual(model.get());
  });
});

describe('model-value-proxy — фасад модели: ключи', () => {
  it('Object.keys и Reflect.ownKeys — только поля; API, __path и символы не перечисляются', () => {
    const model = createShape();

    expect(Object.keys(model)).toEqual(['name', 'tags', 'rows', 'address']);
    expect(Reflect.ownKeys(model)).toEqual(['name', 'tags', 'rows', 'address']);
    expect(Object.getOwnPropertySymbols(model)).toEqual([]);
    expect(Object.keys(model.address)).toEqual(['city']);
  });

  it('in: поле и метод API — да; неизвестный ключ, __path и символ — нет', () => {
    const model = createShape();

    expect('name' in model).toBe(true);
    expect('get' in model).toBe(true);
    expect('signalAt' in model).toBe(true);
    expect('extra' in model).toBe(false);
    expect('__path' in model).toBe(false);
    expect(Symbol.iterator in model).toBe(false);
  });

  it('дескриптор: поле перечислимо; у метода API, неизвестного ключа и символа его нет', () => {
    const model = createShape();

    expect(Object.getOwnPropertyDescriptor(model, 'name')).toMatchObject({
      enumerable: true,
      configurable: true,
    });
    expect(Object.getOwnPropertyDescriptor(model, 'get')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(model, 'extra')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(model, Symbol.iterator)).toBeUndefined();
  });

  it('spread модели — значения полей: лист значением, группа под-моделью, массив фасадом', () => {
    const model = createShape();
    const spread = { ...model };

    expect(Object.keys(spread)).toEqual(['name', 'tags', 'rows', 'address']);
    expect(spread.name).toBe('Анна');
    expect(spread.address).toBe(model.address);
    expect(spread.tags).toBe(model.tags);
  });

  it('символьные ключи читаются как undefined', () => {
    const model = createShape();

    expect(loose(model)[Symbol.iterator]).toBeUndefined();
    expect(loose(model)[Symbol.toPrimitive]).toBeUndefined();
    expect(loose(model)[Symbol.toStringTag]).toBeUndefined();
    expect(loose(model.address)[Symbol.iterator]).toBeUndefined();
  });

  it('приведение к строке бросает: у фасада нет ни toString, ни valueOf', () => {
    // поведение под вопросом [ReFormer-ix06]: фасад «как у обычного объекта», но `String(model)` и
    // `${model}` бросают TypeError вместо '[object Object]' — ловушка get не отдаёт методы
    // Object.prototype.
    const model = createShape();

    expect(() => String(model)).toThrow(TypeError);
    expect(() => `${model.address}`).toThrow(TypeError);
  });
});

describe('model-value-proxy — запись неизвестного ключа', () => {
  it('новое поле: TypeError, модель не меняется', () => {
    const model = createShape();

    expect(() => {
      loose(model).extra = 1;
    }).toThrow(TypeError);
    expect('extra' in model).toBe(false);
    expect(loose(model).extra).toBeUndefined();
    expect(Object.keys(model.get())).toEqual(['name', 'tags', 'rows', 'address']);
  });

  it('то же на под-модели и на строке массива', () => {
    const model = createShape();

    expect(() => {
      loose(model.address).street = 'Баумана';
    }).toThrow(TypeError);
    expect(() => {
      loose(model.rows.at(0)).note = '';
    }).toThrow(TypeError);
    expect(model.get().address).toEqual({ city: 'Казань' });
  });

  it('имя метода API без одноимённого поля: TypeError, метод остаётся на месте', () => {
    const model = createShape();

    expect(() => {
      loose(model).get = () => null;
    }).toThrow(TypeError);
    expect(model.get().name).toBe('Анна');
  });

  it('символьный ключ: TypeError', () => {
    const model = createShape();

    expect(() => {
      loose(model)[Symbol('метка')] = 1;
    }).toThrow(TypeError);
  });
});

describe('model-value-proxy — поле с именем метода API', () => {
  // ModelApi: «имена методов зарезервированы: одноимённое поле формы их затеняет».
  interface Odd {
    get: string;
    set: number;
    title: string;
  }

  it('поле get и set затеняют методы: читается значение поля, прочие методы на месте', () => {
    const model = createModel<Odd>({ get: 'g', set: 1, title: 't' });

    expect(model.get).toBe('g');
    expect(model.set).toBe(1);
    expect(typeof model.patch).toBe('function');
    expect('get' in model).toBe(true);
    expect(Object.keys(model)).toEqual(['get', 'set', 'title']);
  });

  it('запись в затеняющее поле пишет поле; снимок по-прежнему доступен через model.$', () => {
    const model = createModel<Odd>({ get: 'g', set: 1, title: 't' });

    loose(model).get = 'G';
    model.patch({ set: 2 });

    expect(model.$.get.value).toBe('G');
    expect(model.$.peek()).toEqual({ get: 'G', set: 2, title: 't' });
  });

  it('поле $ затеняет дерево сигналов — ручку поля отдаёт signalAt', () => {
    const model = createModel({ $: 'x', name: '' });

    expect(model.$).toBe('x');
    expect(model.signalAt('$')?.value).toBe('x');
    expect(model.signalAt('name')?.__path).toBe('name');
  });
});

describe('model-value-proxy — внутренние помощники формы', () => {
  it('isModelFacade: модель, под-модель, строка и фасад массива — да', () => {
    const model = createShape();

    for (const facade of [model, model.address, model.rows.at(0), model.tags, model.rows]) {
      expect(isModelFacade(facade)).toBe(true);
    }
  });

  it('isModelFacade: null, примитивы, обычные объекты, снимок и ручки `$` — нет', () => {
    const model = createShape();
    const others: unknown[] = [null, undefined, 0, 'x', {}, [], model.get()];

    for (const other of [...others, model.$, model.$.address, model.$.tags, model.$.name]) {
      expect(isModelFacade(other)).toBe(false);
    }
  });

  it('provideArrayBlank на не-массиве и не-ручке ничего не делает', () => {
    const model = createModel({ name: '', address: { city: '' }, tags: [] as string[] });

    provideArrayBlank(model.$.address, () => ({ city: 'шаблон' }));
    provideArrayBlank(model.$.name, 'шаблон');
    provideArrayBlank(model.tags, 'шаблон');
    provideArrayBlank(null, 'шаблон');

    expect(() => model.tags.push()).toThrow(/tags: добавление элемента без значения/);
    expect(model.get()).toEqual({ name: '', address: { city: '' }, tags: [] });
  });

  it('provideArrayBlank: первый запасной шаблон главнее следующих, arrayOf главнее всех', () => {
    const model = createModel({ tags: [] as string[], codes: arrayOf(() => 'из модели') });

    provideArrayBlank(model.$.tags, 'первый');
    provideArrayBlank(model.$.tags, 'второй');
    provideArrayBlank(model.$.codes, 'из схемы');
    model.tags.push();
    model.codes.push();

    expect(model.get()).toEqual({ tags: ['первый'], codes: ['из модели'] });
  });

  it('arrayHandleOf: ручка массива и фасад массива дают ручку, прочее — undefined', () => {
    const model = createShape();

    expect(arrayHandleOf(model.$.tags)).toBe(model.$.tags);
    expect(arrayHandleOf(model.tags)).toBe(model.$.tags);
    expect(arrayHandleOf(model.rows)).toBe(model.$.rows);
    const others: unknown[] = [model.$.address, model.address, model, model.$, model.$.name];
    for (const other of [...others, model.rows.at(0), null, 'x', {}]) {
      expect(arrayHandleOf(other)).toBeUndefined();
    }
  });

  it('groupHandleOf: ручка группы, под-модель и строка дают ручку, прочее — undefined', () => {
    const model = createShape();

    expect(groupHandleOf(model.$.address)).toBe(model.$.address);
    expect(groupHandleOf(model.address)).toBe(model.$.address);
    expect(groupHandleOf(model)).toBe(model.$);
    expect(groupHandleOf(model.rows.at(1))).toBe(model.$.rows[1]);
    for (const other of [model.$.tags, model.tags, model.$.name, null, 'x', {}]) {
      expect(groupHandleOf(other)).toBeUndefined();
    }
  });

  it('modelOf обращает groupHandleOf и arrayHandleOf', () => {
    const model = createShape();

    expect(modelOf(groupHandleOf(model.address) as typeof model.$.address)).toBe(model.address);
    expect(modelOf(arrayHandleOf(model.rows) as typeof model.$.rows)).toBe(model.rows);
  });
});
