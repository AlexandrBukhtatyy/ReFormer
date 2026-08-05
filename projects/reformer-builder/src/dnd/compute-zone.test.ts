import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { computeZone, zoneEdge, PERP_ZONES, type Rect } from './compute-zone';

const RECT: Rect = { left: 0, top: 0, width: 100, height: 100 };

const container = (): JsonNode => ({ component: '$html(div)', children: [] }) as JsonNode;
const leaf = (): JsonNode => ({ value: '$model(x)', component: '$component(Input)' }) as JsonNode;

/** Зона в точке (px внутри RECT). */
const at = (
  x: number,
  y: number,
  node: JsonNode,
  orientation: 'vertical' | 'horizontal',
  perp = false
) => computeZone({ x, y }, RECT, node, orientation, perp);

describe('computeZone — главная ось = ось родителя', () => {
  it('вертикальный родитель: before/into/after по Y', () => {
    expect(at(50, 10, container(), 'vertical')).toBe('before');
    expect(at(50, 50, container(), 'vertical')).toBe('into');
    expect(at(50, 90, container(), 'vertical')).toBe('after');
  });

  it('горизонтальный родитель: before/into/after по X', () => {
    expect(at(10, 50, container(), 'horizontal')).toBe('before');
    expect(at(50, 50, container(), 'horizontal')).toBe('into');
    expect(at(90, 50, container(), 'horizontal')).toBe('after');
  });

  it('лист не принимает детей — только before/after пополам', () => {
    expect(at(50, 49, leaf(), 'vertical')).toBe('before');
    expect(at(50, 51, leaf(), 'vertical')).toBe('after');
    expect(at(49, 50, leaf(), 'horizontal')).toBe('before');
    expect(at(51, 50, leaf(), 'horizontal')).toBe('after');
  });

  it('пороги контейнера — 28% / 72% вдоль главной оси', () => {
    expect(at(50, 27, container(), 'vertical')).toBe('before');
    expect(at(50, 29, container(), 'vertical')).toBe('into');
    expect(at(50, 71, container(), 'vertical')).toBe('into');
    expect(at(50, 73, container(), 'vertical')).toBe('after');
  });
});

describe('computeZone — перпендикулярные зоны', () => {
  it('без allowPerp поперечные края не дают обёрточных зон', () => {
    expect(at(5, 50, container(), 'vertical')).toBe('into');
    expect(at(95, 50, container(), 'vertical')).toBe('into');
  });

  it('вертикальный родитель + allowPerp: поперечные края → beside-* (новый ряд)', () => {
    expect(at(10, 50, leaf(), 'vertical', true)).toBe('beside-before');
    expect(at(90, 50, leaf(), 'vertical', true)).toBe('beside-after');
  });

  it('горизонтальный родитель + allowPerp: поперечные края → stack-* (новый столбец)', () => {
    expect(at(50, 10, leaf(), 'horizontal', true)).toBe('stack-before');
    expect(at(50, 90, leaf(), 'horizontal', true)).toBe('stack-after');
  });

  it('перпендикулярная зона выигрывает у главной оси на пересечении краёв', () => {
    // левый-верхний угол в вертикальном родителе: cross(X)=0.1 → beside-before, а не before
    expect(at(10, 10, leaf(), 'vertical', true)).toBe('beside-before');
  });

  it('пороги поперёк — 25% / 75%', () => {
    expect(at(24, 50, leaf(), 'vertical', true)).toBe('beside-before');
    expect(at(26, 50, leaf(), 'vertical', true)).toBe('after'); // вне поперечного края → главная ось (Y)
    expect(at(76, 50, leaf(), 'vertical', true)).toBe('beside-after');
  });

  it('PERP_ZONES перечисляет ровно обёрточные зоны', () => {
    expect([...PERP_ZONES].sort()).toEqual([
      'beside-after',
      'beside-before',
      'stack-after',
      'stack-before',
    ]);
  });
});

describe('computeZone — вырожденный прямоугольник', () => {
  it('нулевая высота/ширина не даёт NaN (доля = середина)', () => {
    const empty: Rect = { left: 0, top: 0, width: 0, height: 0 };
    expect(computeZone({ x: 0, y: 0 }, empty, container(), 'vertical', false)).toBe('into');
    expect(computeZone({ x: 0, y: 0 }, empty, leaf(), 'vertical', false)).toBe('after');
  });
});

describe('zoneEdge', () => {
  it('before/after зависят от оси родителя', () => {
    expect(zoneEdge('before', false)).toBe('top');
    expect(zoneEdge('after', false)).toBe('bottom');
    expect(zoneEdge('before', true)).toBe('left');
    expect(zoneEdge('after', true)).toBe('right');
  });

  it('обёрточные зоны имеют фиксированный край', () => {
    expect(zoneEdge('beside-before', false)).toBe('left');
    expect(zoneEdge('beside-after', true)).toBe('right');
    expect(zoneEdge('stack-before', true)).toBe('top');
    expect(zoneEdge('stack-after', false)).toBe('bottom');
  });

  it('into — без линии', () => {
    expect(zoneEdge('into', false)).toBeNull();
  });
});
