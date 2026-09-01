/**
 * Тесты геометрии зон схематичного вида.
 *
 * Проверяется ровно то, ради чего геометрия отделена от отрисовки: что главной осью служит
 * ось РОДИТЕЛЯ, что поперечные края сильнее середины и что цель без вложения не имеет мёртвой
 * зоны. Ни один из этих вопросов не требует DOM — прямоугольник задаётся числами.
 *
 * @module plugins/editor-schema/schematic/schematic-zone.test
 */

import { describe, expect, it } from 'vitest';
import type { Orientation } from '@/lib/form-model/node-kind';
import { PERP_ZONES, zoneAt, zoneEdge, type Rect, type SchematicZone } from './schematic-zone';

const RECT: Rect = { left: 0, top: 0, width: 100, height: 100 };

/** Зона в точке (пиксели внутри {@link RECT}). */
function at(
  x: number,
  y: number,
  options: { inside?: boolean; parent?: Orientation; perp?: boolean } = {}
): SchematicZone {
  return zoneAt({ x, y }, RECT, {
    acceptsInside: options.inside ?? true,
    parentOrientation: options.parent ?? 'vertical',
    allowPerp: options.perp ?? false,
  });
}

describe('zoneAt — главная ось берётся у родителя', () => {
  it('в вертикальном родителе before/into/after считаются по Y', () => {
    expect(at(50, 10)).toBe('before');
    expect(at(50, 50)).toBe('into');
    expect(at(50, 90)).toBe('after');
  });

  it('в горизонтальном родителе те же зоны считаются по X', () => {
    expect(at(10, 50, { parent: 'horizontal' })).toBe('before');
    expect(at(50, 50, { parent: 'horizontal' })).toBe('into');
    expect(at(90, 50, { parent: 'horizontal' })).toBe('after');
  });

  it('пороги контейнера — 28% и 72% вдоль главной оси', () => {
    expect(at(50, 27)).toBe('before');
    expect(at(50, 29)).toBe('into');
    expect(at(50, 71)).toBe('into');
    expect(at(50, 73)).toBe('after');
  });
});

describe('zoneAt — цель, не принимающая вложение', () => {
  it('делит коробку пополам, не оставляя мёртвой середины', () => {
    expect(at(50, 49, { inside: false })).toBe('before');
    expect(at(50, 51, { inside: false })).toBe('after');
    expect(at(49, 50, { inside: false, parent: 'horizontal' })).toBe('before');
    expect(at(51, 50, { inside: false, parent: 'horizontal' })).toBe('after');
  });

  it('вырожденная коробка считается серединой: в вертикальном родителе это `after`', () => {
    const flat: Rect = { left: 0, top: 0, width: 100, height: 0 };
    expect(
      zoneAt({ x: 50, y: 0 }, flat, {
        acceptsInside: false,
        parentOrientation: 'vertical',
        allowPerp: false,
      })
    ).toBe('after');
  });
});

describe('zoneAt — поперечные края рождают обёртку', () => {
  it('без allowPerp поперечных зон нет вовсе', () => {
    expect(at(5, 50)).toBe('into');
    expect(at(95, 50)).toBe('into');
  });

  it('в вертикальном родителе поперечные края дают ряд', () => {
    expect(at(10, 50, { inside: false, perp: true })).toBe('beside-before');
    expect(at(90, 50, { inside: false, perp: true })).toBe('beside-after');
  });

  it('в горизонтальном родителе — столбец', () => {
    expect(at(50, 10, { inside: false, parent: 'horizontal', perp: true })).toBe('stack-before');
    expect(at(50, 90, { inside: false, parent: 'horizontal', perp: true })).toBe('stack-after');
  });

  it('поперечный край сильнее середины: иначе у контейнера обёртку не показать', () => {
    // Точка (10, 50) лежит и в середине главной оси (into), и в поперечном крае.
    expect(at(10, 50, { perp: true })).toBe('beside-before');
  });

  it('поперечный порог — четверть стороны', () => {
    expect(at(24, 50, { perp: true })).toBe('beside-before');
    expect(at(26, 50, { perp: true })).toBe('into');
    expect(at(74, 50, { perp: true })).toBe('into');
    expect(at(76, 50, { perp: true })).toBe('beside-after');
  });
});

describe('zoneEdge — где рисовать линию', () => {
  it('before/after поворачиваются вместе с осью родителя', () => {
    expect(zoneEdge('before', false)).toBe('top');
    expect(zoneEdge('after', false)).toBe('bottom');
    expect(zoneEdge('before', true)).toBe('left');
    expect(zoneEdge('after', true)).toBe('right');
  });

  it('обёрточные зоны отвечают своим краем независимо от оси родителя', () => {
    for (const horizontal of [false, true]) {
      expect(zoneEdge('beside-before', horizontal)).toBe('left');
      expect(zoneEdge('beside-after', horizontal)).toBe('right');
      expect(zoneEdge('stack-before', horizontal)).toBe('top');
      expect(zoneEdge('stack-after', horizontal)).toBe('bottom');
    }
  });

  it('into линии не имеет — его показывает рамка', () => {
    expect(zoneEdge('into', false)).toBeNull();
  });
});

describe('PERP_ZONES', () => {
  it('перечисляет ровно обёрточные зоны', () => {
    expect([...PERP_ZONES].sort()).toEqual([
      'beside-after',
      'beside-before',
      'stack-after',
      'stack-before',
    ]);
  });
});
