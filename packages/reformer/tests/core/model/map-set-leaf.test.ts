/**
 * Встроенные объекты-значения — листья модели [ReFormer-lywn.2].
 *
 * Раньше Map и Set проходили проверку «plain-объект» и разбирались в пустые группы: `get()` отдавал
 * `{}`, снимок для `reset` портился, а `deepEqual` считал равными любые две Map. Теперь Map, Set,
 * RegExp, типизированные массивы и т.п. хранятся целиком в листе; Map/Set сравниваются по
 * содержимому, снимок — поверхностная копия.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { createModel, deepEqual } from '../../../src/model/index';

afterEach(() => {
  vi.restoreAllMocks();
});

interface Tree {
  expanded: Set<string>;
  children: Map<string, string[]>;
}

describe('Map и Set — листья модели', () => {
  it('значение хранится целиком, сигнал — у самого поля', () => {
    const expanded = new Set(['root']);
    const model = createModel<Tree>({ expanded, children: new Map([['root', ['a']]]) });
    expect(model.expanded).toBe(expanded);
    expect(model.$.expanded.value).toBe(expanded);
    expect(model.get().children.get('root')).toEqual(['a']);
  });

  it('новая коллекция уведомляет подписчиков', () => {
    const model = createModel<Tree>({ expanded: new Set(), children: new Map() });
    const seen: number[] = [];
    const stop = model.$.expanded.subscribe((s) => seen.push(s.size));
    model.expanded = new Set(['a', 'b']);
    stop();
    expect(seen).toEqual([0, 2]);
  });

  it('isDirty сравнивает по содержимому; reset возвращает содержимое снимка', () => {
    const model = createModel<Tree>({ expanded: new Set(['a']), children: new Map() });
    model.expanded = new Set(['a']);
    expect(model.isDirty()).toBe(false);

    model.expanded = new Set(['a', 'b']);
    expect(model.isDirty()).toBe(true);

    model.reset();
    expect([...model.expanded]).toEqual(['a']);
    expect(model.isDirty()).toBe(false);
  });

  it('правка коллекции на месте не портит снимок', () => {
    const children = new Map([['root', ['a']]]);
    const model = createModel<Tree>({ expanded: new Set(), children });
    children.set('extra', []);
    expect(model.isDirty()).toBe(true);
    model.reset();
    expect([...model.children.keys()]).toEqual(['root']);
  });
});

describe('deepEqual для коллекций', () => {
  it('Map — по ключам и значениям, Set — по элементам', () => {
    expect(deepEqual(new Map([['a', [1]]]), new Map([['a', [1]]]))).toBe(true);
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
    expect(deepEqual(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(false);
    expect(deepEqual(new Map(), new Map([['a', 1]]))).toBe(false);
    expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(deepEqual(new Set([1]), new Set([2]))).toBe(false);
    expect(deepEqual(new Map(), new Set())).toBe(false);
    expect(deepEqual(new Map(), {})).toBe(false);
  });
});

describe('прочие встроенные значения — листья', () => {
  it('RegExp и типизированный массив не разбираются на поля', () => {
    const pattern = /^a+$/i;
    const bytes = new Uint8Array([1, 2, 3]);
    const model = createModel({ pattern, bytes });
    expect(model.pattern).toBe(pattern);
    expect(model.bytes).toBe(bytes);
    expect(model.get()).toEqual({ pattern, bytes });
  });

  it('коллекция из другого realm тоже лист', () => {
    const foreign = runInNewContext('new Map([["k", 1]])') as Map<string, number>;
    expect(foreign instanceof Map).toBe(false);
    const model = createModel<{ cache: Map<string, number> }>({ cache: foreign });
    expect(model.cache).toBe(foreign);
    expect(model.get().cache.get('k')).toBe(1);
  });
});

describe('экземпляр класса', () => {
  class Point {
    constructor(
      public x: number,
      public y: number
    ) {}
    length(): number {
      return Math.hypot(this.x, this.y);
    }
  }

  it('разбирается в группу, как раньше, с одним предупреждением на класс', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createModel<{ a: Point; b: Point }>({ a: new Point(3, 4), b: new Point(1, 1) });
    expect(model.get().a).toEqual({ x: 3, y: 4 });
    const classWarnings = warn.mock.calls.filter(([text]) => String(text).includes('класса Point'));
    expect(classWarnings).toHaveLength(1);
  });

  it('plain-объекты и Object.create(null) не предупреждают', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bare = Object.assign(Object.create(null) as Record<string, number>, { n: 1 });
    createModel({ plain: { n: 1 }, bare });
    expect(warn).not.toHaveBeenCalled();
  });
});
