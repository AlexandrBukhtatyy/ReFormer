import { describe, expect, it } from 'vitest';
import { diffLines, diffStat, hasChanges } from './diff';

describe('diffLines / diffStat', () => {
  it('идентичные тексты → всё same, +0 −0', () => {
    const text = 'a\nb\nc';
    const ops = diffLines(text, text);
    expect(ops.every((o) => o.type === 'same')).toBe(true);
    expect(diffStat(ops)).toEqual({ added: 0, removed: 0 });
  });

  it('изменённая строка → 1 del + 1 add', () => {
    const ops = diffLines('a\nb\nc', 'a\nB\nc');
    expect(diffStat(ops)).toEqual({ added: 1, removed: 1 });
    expect(ops.find((o) => o.type === 'del')?.text).toBe('b');
    expect(ops.find((o) => o.type === 'add')?.text).toBe('B');
  });

  it('добавленные строки', () => {
    const ops = diffLines('a\nc', 'a\nb\nc');
    expect(diffStat(ops)).toEqual({ added: 1, removed: 0 });
    expect(ops.find((o) => o.type === 'add')?.text).toBe('b');
  });

  it('удалённые строки', () => {
    const ops = diffLines('a\nb\nc', 'a\nc');
    expect(diffStat(ops)).toEqual({ added: 0, removed: 1 });
  });
});

describe('hasChanges', () => {
  it('нет правок → false', () => {
    expect(hasChanges('x', 'x')).toBe(false);
    expect(hasChanges('x', 'y')).toBe(true);
  });
});
