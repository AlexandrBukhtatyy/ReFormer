import { describe, expect, it, vi } from 'vitest';

import { createLogService, MAX_LOG_ENTRIES } from './log';

describe('журнал', () => {
  it('уровень по умолчанию — info, время ставит служба, сообщение хранится ключом', () => {
    const log = createLogService({ now: () => 1000 });

    const entry = log.append({
      source: 'acme',
      messageKey: 'acme:kit.loaded',
      params: { name: 'ui-kit' },
    });

    expect(entry).toEqual({
      id: 'l1',
      level: 'info',
      time: 1000,
      source: 'acme',
      messageKey: 'acme:kit.loaded',
      params: { name: 'ui-kit' },
    });
    expect(log.entries()).toEqual([entry]);
  });

  it('записи идут в порядке поступления и заморожены', () => {
    const log = createLogService();

    log.append({ source: 'a', messageKey: 'one', level: 'warning' });
    log.append({ source: 'b', messageKey: 'two', level: 'error', detail: 'стек' });

    const entries = log.entries();
    expect(entries.map((entry) => entry.messageKey)).toEqual(['one', 'two']);
    expect(entries[1]?.detail).toBe('стек');
    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(entries[0])).toBe(true);
  });

  it('снимок — та же ссылка, пока журнал не изменился', () => {
    const log = createLogService();
    const empty = log.entries();
    expect(log.entries()).toBe(empty);

    log.append({ source: 'a', messageKey: 'one' });
    const first = log.entries();
    expect(first).not.toBe(empty);
    expect(log.entries()).toBe(first);
  });

  it('переполнение вытесняет самые старые записи', () => {
    const log = createLogService({ capacity: 3 });

    for (const key of ['a', 'b', 'c', 'd', 'e']) log.append({ source: 's', messageKey: key });

    expect(log.entries().map((entry) => entry.messageKey)).toEqual(['c', 'd', 'e']);
  });

  it('предел по умолчанию — MAX_LOG_ENTRIES', () => {
    const log = createLogService();

    for (let index = 0; index <= MAX_LOG_ENTRIES; index += 1) {
      log.append({ source: 's', messageKey: `k${String(index)}` });
    }

    expect(log.entries()).toHaveLength(MAX_LOG_ENTRIES);
    expect(log.entries()[0]?.messageKey).toBe('k1');
  });

  it('очистка опустошает журнал, но не сбрасывает счётчик идентификаторов', () => {
    const log = createLogService();
    log.append({ source: 's', messageKey: 'a' });

    log.clear();
    expect(log.entries()).toEqual([]);

    // Ключ строки после очистки не совпадёт с ключом строки до неё.
    expect(log.append({ source: 's', messageKey: 'b' }).id).toBe('l2');
  });

  it('наблюдатель узнаёт о записи и об очистке; пустая очистка — не изменение', () => {
    const log = createLogService();
    const cb = vi.fn();
    const subscription = log.observe(cb);

    log.clear();
    expect(cb).not.toHaveBeenCalled();

    log.append({ source: 's', messageKey: 'a' });
    log.clear();
    expect(cb).toHaveBeenCalledTimes(2);

    subscription.dispose();
    log.append({ source: 's', messageKey: 'b' });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('пустой ключ или источник — ошибка вызывающего, а не пустая строка в журнале', () => {
    const log = createLogService();

    expect(() => log.append({ source: 's', messageKey: ' ' })).toThrow(/ключ/);
    expect(() => log.append({ source: '', messageKey: 'a' })).toThrow(/источник/);
    expect(log.entries()).toEqual([]);
  });
});
