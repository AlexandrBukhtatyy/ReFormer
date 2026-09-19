import { describe, it, expect } from 'vitest';
import { nextOpenOnClick } from './info-hint-toggle';

describe('nextOpenOnClick', () => {
  it('клик указателем: смотрит на состояние ДО pointerdown (к click Radix тултип уже закрыл)', () => {
    // навели (открыт) → pointerdown закрыл → click: было открыто → остаётся закрытым
    expect(nextOpenOnClick(1, false, true)).toBe(false);
    // тап по закрытому → открывает
    expect(nextOpenOnClick(1, false, false)).toBe(true);
  });

  it('клик с клавиатуры (detail 0): pointerdown не было — переключает текущее open', () => {
    expect(nextOpenOnClick(0, true, false)).toBe(false);
    expect(nextOpenOnClick(0, false, true)).toBe(true);
  });
});
