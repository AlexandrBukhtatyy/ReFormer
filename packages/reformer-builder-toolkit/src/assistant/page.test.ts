import { describe, expect, it } from 'vitest';
import { changedLines, pageOf, snippetOf } from './page';

describe('page — строки с номерами', () => {
  it('страница режется по строкам и знает, сколько их всего', () => {
    const text = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
    const page = pageOf(text, 1, 10, 10_000);
    expect(page).toMatchObject({ from: 1, to: 10, total: 50 });
    expect(page.body.split('\n')[0]).toBe('     1\tline 1');
    const tight = pageOf(text, 1, undefined, 60);
    expect(tight.to).toBeLessThan(50);
    expect(tight.body.endsWith('\n')).toBe(false);
  });

  it('CRLF и хвостовой перевод строки не портят номера', () => {
    expect(pageOf('a\r\nb\r\n', 1, undefined, 1000)).toMatchObject({ to: 2, total: 2 });
    expect(pageOf('a\r\nb\r\n', 1, undefined, 1000).body).not.toContain('\r');
  });

  it('изменённые строки и фрагмент вокруг них', () => {
    const before = 'a\nb\nc\nd\ne\nf';
    const after = 'a\nb\nX\nY\nd\ne\nf';
    const changed = changedLines(before, after);
    expect(changed).toEqual({ from: 3, to: 4, added: 2, removed: 1 });
    expect(snippetOf(after, changed, 1000).split('\n')).toHaveLength(6);
  });
});
