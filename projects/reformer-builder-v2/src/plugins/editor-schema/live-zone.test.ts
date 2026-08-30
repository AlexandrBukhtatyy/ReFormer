/**
 * Геометрия живого вида: ось по прямоугольникам, указатель броска, место ручки.
 *
 * @module plugins/editor-schema/live-zone.test
 */

import { describe, expect, it } from 'vitest';
import { GRIP_SIZE, gripBox, indicatorFor, orientationFromRects } from './live-zone';
import type { Rect } from './schematic-zone';

const rect = (left: number, top: number, width = 100, height = 40): Rect => ({
  left,
  top,
  width,
  height,
});

const HOST = rect(0, 0, 600, 400);

describe('orientationFromRects', () => {
  it('соседи в ряд читаются рядом', () => {
    expect(orientationFromRects([rect(0, 0), rect(110, 0), rect(220, 0)])).toBe('horizontal');
  });

  it('соседи столбцом читаются столбцом', () => {
    expect(orientationFromRects([rect(0, 0), rect(0, 50), rect(0, 100)])).toBe('vertical');
  });

  it('переносящийся ряд остаётся рядом: голосуют все пары, побеждает большинство', () => {
    // Сетка 3×2: две пары стоят рядом, одна — под предыдущей. Ряд перевешивает.
    const grid = [rect(0, 0), rect(110, 0), rect(220, 0), rect(0, 50)];
    expect(orientationFromRects(grid)).toBe('horizontal');
  });

  it('сетка 2×2 читается рядом: по строкам она и раскладывается', () => {
    // Это тот же переносящийся ряд, только ровный. «Перед» и «после» у соседа в такой
    // сетке лежат слева и справа, а не сверху и снизу.
    expect(orientationFromRects([rect(0, 0), rect(110, 0), rect(0, 50), rect(110, 50)])).toBe(
      'horizontal'
    );
  });

  it('поровну голосов — ответа нет, а не выдуманный', () => {
    // Уголок: вправо, затем вниз. Судить не по чему, и запасная ось честнее догадки.
    expect(orientationFromRects([rect(0, 0), rect(110, 0), rect(110, 50)])).toBeNull();
  });

  it('единственный сосед оси не задаёт', () => {
    expect(orientationFromRects([rect(0, 0)])).toBeNull();
    expect(orientationFromRects([])).toBeNull();
  });

  it('скрытая ветка нулевых прямоугольников оси не задаёт', () => {
    const hidden = [rect(0, 0, 0, 0), rect(0, 0, 0, 0), rect(0, 0, 0, 0)];
    expect(orientationFromRects(hidden)).toBeNull();
  });

  it('наложившиеся друг на друга прямоугольники не голосуют', () => {
    expect(orientationFromRects([rect(0, 0, 100, 100), rect(0, 0, 100, 100)])).toBeNull();
  });
});

describe('indicatorFor', () => {
  it('«внутрь» показывается рамкой по всему узлу', () => {
    const indicator = indicatorFor('into', rect(30, 20), HOST, false);
    expect(indicator.shape).toBe('frame');
    expect(indicator.box).toMatchObject({ left: 30, top: 20, width: 100, height: 40 });
    expect(indicator.axis).toBeNull();
  });

  it('в столбце «перед» — линия сверху, «после» — снизу', () => {
    expect(indicatorFor('before', rect(0, 100), HOST, false).box.top).toBeLessThan(100);
    const after = indicatorFor('after', rect(0, 100), HOST, false);
    expect(after.box.top).toBeGreaterThan(100);
    expect(after.shape).toBe('line');
  });

  it('в ряду те же зоны дают линии слева и справа', () => {
    expect(indicatorFor('before', rect(100, 0), HOST, true).box.left).toBeLessThan(100);
    expect(indicatorFor('after', rect(100, 0), HOST, true).box.left).toBeGreaterThan(100);
  });

  it('обёрточные зоны называют ось будущей обёртки', () => {
    expect(indicatorFor('beside-before', rect(0, 0), HOST, false).axis).toBe('row');
    expect(indicatorFor('stack-after', rect(0, 0), HOST, true).axis).toBe('column');
    expect(indicatorFor('after', rect(0, 0), HOST, false).axis).toBeNull();
  });

  it('координаты приводятся к системе хоста, а не окна', () => {
    // Форма прокручена и смещена: считай мы в координатах окна, указатель уехал бы.
    const host = rect(40, 60, 600, 400);
    const indicator = indicatorFor('into', rect(140, 260), host, false);
    expect(indicator.box).toMatchObject({ left: 100, top: 200 });
  });
});

describe('gripBox', () => {
  it('ручка стоит снаружи слева, чтобы не закрывать поле', () => {
    const box = gripBox(rect(120, 30), HOST);
    expect(box.left).toBe(120 - GRIP_SIZE);
    expect(box.top).toBe(30);
  });

  it('у прижатого к левому краю узла ручка уходит внутрь: снаружи её было бы не достать', () => {
    const box = gripBox(rect(0, 30), HOST);
    expect(box.left).toBe(0);
  });

  it('на низком узле ручка не выше самого узла', () => {
    const box = gripBox(rect(120, 30, 100, 8), HOST);
    expect(box.height).toBe(8);
  });
});
