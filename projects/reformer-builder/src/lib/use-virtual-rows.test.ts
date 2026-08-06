import { describe, expect, it } from 'vitest';
import { rowRange } from './use-virtual-rows';

const H = 24;

describe('rowRange — окно виртуального скролла', () => {
  it('пустой список — пустое окно', () => {
    expect(rowRange(0, 480, H, 0, 8)).toEqual({ start: 0, end: 0 });
  });

  it('от начала списка: только видимые строки + запас снизу', () => {
    // 480px / 24px = 20 строк во вьюпорте, +1 срезанная, +8 overscan.
    expect(rowRange(0, 480, H, 1000, 8)).toEqual({ start: 0, end: 29 });
  });

  it('в середине списка: окно вокруг прокрутки, запас с обеих сторон', () => {
    // scrollTop 2400 → первая видимая строка 100.
    expect(rowRange(2400, 480, H, 1000, 8)).toEqual({ start: 92, end: 129 });
  });

  it('у конца списка окно обрезается по count', () => {
    expect(rowRange(23_520, 480, H, 1000, 8)).toEqual({ start: 972, end: 1000 });
  });

  it('высота вьюпорта ещё не измерена — рендерим хотя бы запас (окно не пустое)', () => {
    const { start, end } = rowRange(0, 0, H, 1000, 8);
    expect(start).toBe(0);
    expect(end).toBeGreaterThan(0);
  });

  it('окно короче списка — виртуализация действительно экономит DOM', () => {
    const { start, end } = rowRange(0, 480, H, 4000, 8);
    expect(end - start).toBeLessThan(40);
  });
});
