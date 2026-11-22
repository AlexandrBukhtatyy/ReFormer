import { describe, expect, it } from 'vitest';
import { countErrors, introduced, normalizeError, warningLine } from './introduced';

describe('introduced — «не обязана лечить, но обязана не ухудшать»', () => {
  it('сдвиг индекса не делает старую ошибку новой', () => {
    const base = countErrors(['root.children[0].componentProps must have label']);
    expect(introduced(base, ['root.children[3].componentProps must have label'])).toEqual([]);
  });

  it('вторая такая же ошибка — новая: счёт идёт мультимножеством', () => {
    const base = countErrors(['unknown component "X"']);
    const after = ['unknown component "X"', 'unknown component "X"'];
    expect(introduced(base, after)).toEqual(['unknown component "X"']);
  });

  it('возвращает находки в исходной формулировке, а не нормализованной', () => {
    expect(normalizeError('a[12].b')).toBe('a[#].b');
    expect(introduced(new Map(), ['a[12].b'])).toEqual(['a[12].b']);
  });

  it('принимает свою нормализацию — файловый гейт сравнивает без номера строки', () => {
    const withoutLine = (message: string): string => message.replace(/^line \d+: /, '');
    const base = countErrors(['line 3: RF002 unknown'], withoutLine);
    expect(introduced(base, ['line 9: RF002 unknown'], withoutLine)).toEqual([]);
  });

  it('замечания — строкой вдогонку, не больше двух', () => {
    expect(warningLine([])).toBe('');
    expect(warningLine(['a', 'b', 'c'])).toBe('\nHeads up: a; b (and 1 more).');
  });
});
