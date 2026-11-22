/**
 * Обход значений модели — `eachLeafSignal` и `eachValueSignal` (`src/model/create-model.ts`).
 *
 * На обходчиках держатся реактивные триггеры стратегий валидации: внутри `effect` они подписывают
 * на значения листьев и на состав массивов. Здесь закреплено то, на что опираются потребители:
 * что посещается (только листья / листья и массивы), в каком порядке, что происходит с объектом,
 * который моделью не является, и что подписка на состав массивов переживает добавление, удаление
 * и замену элементов — в том числе во вложенных массивах.
 */

import { describe, expect, it } from 'vitest';
import { effect } from '@preact/signals-core';
import { createModel, eachLeafSignal, eachValueSignal } from '../../../src/model/index';

type Walk = typeof eachLeafSignal;

/** Пути посещённых ручек в порядке обхода. */
const visited = (walk: Walk, target: unknown): string[] => {
  const paths: string[] = [];
  walk(target as never, (signal) => paths.push(signal.__path));
  return paths;
};

interface Item {
  c: number;
}
interface Shape {
  first: number;
  group: { b: number; list: Item[]; deep: { d: number } };
  matrix: number[][];
  last: number;
}

const createShape = () =>
  createModel<Shape>({
    first: 1,
    group: { b: 2, list: [{ c: 3 }, { c: 4 }], deep: { d: 5 } },
    matrix: [[6, 7], [8]],
    last: 9,
  });

describe('create-model — обход объекта, который не модель', () => {
  it('ничего не посещает: обычный объект, ручки `$`, фасад массива, null', () => {
    const model = createShape();
    const others: unknown[] = [
      {},
      { first: 1, group: { b: 2 } },
      model.get(),
      model.$,
      model.$.group,
      model.group.list,
      null,
      undefined,
    ];

    for (const other of others) {
      expect(visited(eachLeafSignal, other)).toEqual([]);
      expect(visited(eachValueSignal, other)).toEqual([]);
    }
  });
});

describe('create-model — порядок обхода', () => {
  it('листья — в глубину: ключи в порядке начального значения, элементы — по индексам', () => {
    expect(visited(eachLeafSignal, createShape())).toEqual([
      'first',
      'group.b',
      'group.list.0.c',
      'group.list.1.c',
      'group.deep.d',
      'matrix.0.0',
      'matrix.0.1',
      'matrix.1.0',
      'last',
    ]);
  });

  it('eachValueSignal посещает массив раньше его элементов', () => {
    expect(visited(eachValueSignal, createShape())).toEqual([
      'first',
      'group.b',
      'group.list',
      'group.list.0.c',
      'group.list.1.c',
      'group.deep.d',
      'matrix',
      'matrix.0',
      'matrix.0.0',
      'matrix.0.1',
      'matrix.1',
      'matrix.1.0',
      'last',
    ]);
  });

  it('после перестановки строк порядок и пути следуют новым индексам', () => {
    const model = createShape();
    model.group.list.at(0).c = 30;

    model.group.list.move(0, 1);

    const values: number[] = [];
    eachLeafSignal(model.group, (signal) => values.push(signal.value as number));
    expect(visited(eachLeafSignal, model.group)).toEqual([
      'group.b',
      'group.list.0.c',
      'group.list.1.c',
      'group.deep.d',
    ]);
    expect(values).toEqual([2, 4, 30, 5]);
  });

  it('под-модель и строка массива обходятся как корень своего поддерева, пути — абсолютные', () => {
    const model = createShape();

    expect(visited(eachLeafSignal, model.group)).toEqual([
      'group.b',
      'group.list.0.c',
      'group.list.1.c',
      'group.deep.d',
    ]);
    expect(visited(eachValueSignal, model.group.list.at(1))).toEqual(['group.list.1.c']);
  });

  it('посещаются те же ручки, что лежат в дереве `model.$`', () => {
    const model = createShape();
    const handles: unknown[] = [];

    eachValueSignal(model, (signal) => handles.push(signal));

    expect(handles[0]).toBe(model.$.first);
    expect(handles[2]).toBe(model.$.group.list);
    expect(handles[3]).toBe(model.$.group.list[0].c);
    expect(handles[7]).toBe(model.$.matrix[0]);
  });

  it('null и Date — листья; пустая группа ничего не даёт, пустой массив виден только как массив', () => {
    const model = createModel<{
      none: string | null;
      when: Date;
      empty: Record<string, never>;
      list: string[];
    }>({ none: null, when: new Date(0), empty: {}, list: [] });

    expect(visited(eachLeafSignal, model)).toEqual(['none', 'when']);
    expect(visited(eachValueSignal, model)).toEqual(['none', 'when', 'list']);
  });
});

describe('create-model — массивы в массивах', () => {
  it('eachLeafSignal спускается на любую глубину, eachValueSignal видит каждый уровень', () => {
    const model = createModel<{ cube: number[][][] }>({ cube: [[[1], []], [[2, 3]]] });

    expect(visited(eachLeafSignal, model)).toEqual(['cube.0.0.0', 'cube.1.0.0', 'cube.1.0.1']);
    expect(visited(eachValueSignal, model)).toEqual([
      'cube',
      'cube.0',
      'cube.0.0',
      'cube.0.0.0',
      'cube.0.1',
      'cube.1',
      'cube.1.0',
      'cube.1.0.0',
      'cube.1.0.1',
    ]);
  });

  it('массив строк с вложенным массивом групп', () => {
    const model = createModel<{ rows: Array<{ title: string; phones: Array<{ n: string }> }> }>({
      rows: [
        { title: 'a', phones: [{ n: '1' }, { n: '2' }] },
        { title: 'b', phones: [] },
      ],
    });

    expect(visited(eachLeafSignal, model)).toEqual([
      'rows.0.title',
      'rows.0.phones.0.n',
      'rows.0.phones.1.n',
      'rows.1.title',
    ]);
    expect(visited(eachValueSignal, model)).toEqual([
      'rows',
      'rows.0.title',
      'rows.0.phones',
      'rows.0.phones.0.n',
      'rows.0.phones.1.n',
      'rows.1.title',
      'rows.1.phones',
    ]);
  });
});

describe('create-model — переподписка на состав внутри effect', () => {
  it('обход без чтения значений подписывает на состав массивов, но не на значения листьев', () => {
    const model = createModel({ title: '', rows: [{ name: 'a' }] });
    let runs = 0;
    const stop = effect(() => {
      runs++;
      eachLeafSignal(model, () => {});
    });

    model.rows.push({ name: 'b' });
    model.rows.removeAt(0);
    expect(runs).toBe(3);

    model.title = 'x';
    model.rows.at(0).name = 'B';
    expect(runs).toBe(3);
    stop();
  });

  it('новый элемент попадает в подписку, удалённый из неё выпадает', () => {
    const model = createModel({ rows: [{ name: 'a' }] });
    const seen: string[][] = [];
    const stop = effect(() => {
      const values: string[] = [];
      eachLeafSignal(model, (signal) => values.push(String(signal.value)));
      seen.push(values);
    });

    model.rows.push({ name: 'b' });
    const removed = model.$.rows[0].name;
    model.rows.at(1).name = 'B';
    model.rows.removeAt(0);
    removed.value = 'удалённый';

    expect(seen).toEqual([['a'], ['a', 'b'], ['a', 'B'], ['B']]);
    stop();
  });

  it('добавление во вложенный массив будит обходчика, новый лист читается', () => {
    const model = createModel({ groups: [{ items: ['x'] }] });
    const seen: string[][] = [];
    const stop = effect(() => {
      const values: string[] = [];
      eachLeafSignal(model, (signal) => values.push(String(signal.value)));
      seen.push(values);
    });

    model.groups.at(0).items.push('y');
    model.$.groups[0].items[1].value = 'z';

    expect(seen).toEqual([['x'], ['x', 'y'], ['x', 'z']]);
    stop();
  });

  it('замена массива целиком через ручку `$`: обходчик видит новые листья', () => {
    const model = createModel({ tags: ['a'] });
    const seen: string[][] = [];
    const stop = effect(() => {
      seen.push(visited(eachLeafSignal, model));
    });

    model.$.tags.value = ['b', 'c'];
    model.patch({ tags: [] });

    expect(seen).toEqual([['tags.0'], ['tags.0', 'tags.1'], []]);
    stop();
  });

  it('eachValueSignal: чтение ручки массива подписывает на его значение целиком', () => {
    const model = createModel({ name: '', tags: ['a'] });
    const seen: unknown[] = [];
    const stop = effect(() => {
      eachValueSignal(model, (signal) => {
        if (signal.__path === 'tags') seen.push(signal.value);
      });
    });

    model.tags.push('b');
    model.$.tags[0].value = 'A';

    expect(seen).toEqual([['a'], ['a', 'b'], ['A', 'b']]);
    stop();
  });
});
