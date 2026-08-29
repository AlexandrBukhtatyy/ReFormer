import { describe, expect, it } from 'vitest';
import { isGenerated, MARKER_PREFIX, originOf, withMarker } from './marker';

describe('маркер происхождения', () => {
  it('приписывается первой строкой и идемпотентен', () => {
    const once = withMarker('export const a = 1;\n');
    const twice = withMarker(once);
    expect(once.startsWith(MARKER_PREFIX)).toBe(true);
    expect(twice).toBe(once);
  });

  it('различает три состояния файла', () => {
    const generated = withMarker('body\n');
    expect(originOf(generated)).toBe('generated');
    expect(originOf(`${generated}// правка\n`)).toBe('edited');
    expect(originOf('просто файл\n')).toBe('handwritten');
    expect(originOf(null)).toBe('handwritten');
  });

  it('перезапись разрешена только своему нетронутому файлу', () => {
    expect(isGenerated(withMarker('x\n'))).toBe(true);
    expect(isGenerated(`${withMarker('x\n')} `)).toBe(false);
    expect(isGenerated('x\n')).toBe(false);
  });

  it('разный текст даёт разный хэш', () => {
    const a = withMarker('a\n').split('\n')[0];
    const b = withMarker('b\n').split('\n')[0];
    expect(a).not.toBe(b);
  });
});
