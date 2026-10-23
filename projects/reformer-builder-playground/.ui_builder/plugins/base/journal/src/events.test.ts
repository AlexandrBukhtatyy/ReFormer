/**
 * Тесты правил вида «События»: порядок ленты, счёт по уровням, формат времени.
 *
 * @module plugins/base/journal/events.test
 */

import { describe, expect, it } from 'vitest';

import type { LogEntry, LogLevel } from '@reformer/builder-plugin-api';
import { countLevels, newestFirst, timeFormatter } from './events';

function entry(id: string, level: LogLevel = 'info'): LogEntry {
  return { id, level, time: 0, source: 'acme', messageKey: `acme:${id}` };
}

describe('лента событий', () => {
  it('новые — сверху, а снимок службы остаётся как был', () => {
    const entries = Object.freeze([entry('a'), entry('b'), entry('c')]);

    expect(newestFirst(entries).map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(entries.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('счёт по уровням', () => {
    const counts = countLevels([entry('a', 'error'), entry('b', 'info'), entry('c', 'error')]);

    expect(counts).toEqual({ error: 2, warning: 0, info: 1 });
  });
});

describe('время записи', () => {
  const time = new Date(2026, 9, 23, 14, 2, 11).getTime();

  it('часы, минуты и секунды — без даты', () => {
    expect(timeFormatter('ru')(time)).toBe('14:02:11');
  });

  it('незнакомая или пустая локаль — не повод падать', () => {
    expect(timeFormatter('')(time)).toMatch(/02:11/);
    expect(timeFormatter('не-локаль')(time)).toMatch(/02:11/);
  });
});
