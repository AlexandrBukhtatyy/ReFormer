import { describe, expect, it } from 'vitest';

import { errorDetail } from './log.js';

describe('errorDetail', () => {
  it('ничего — это отсутствие подробностей, а не строка «undefined»', () => {
    expect(errorDetail(undefined)).toBeUndefined();
    expect(errorDetail(null)).toBeUndefined();
  });

  it('у ошибки берётся стек: он начинается с имени и сообщения', () => {
    const error = new TypeError('x is undefined');
    const detail = errorDetail(error);

    expect(detail?.startsWith('TypeError: x is undefined')).toBe(true);
    expect(detail).toBe(error.stack);
  });

  it('стек без сообщения дополняется им — иначе подробности без главного', () => {
    const error = new Error('сломалось');
    error.stack = '    at somewhere (file.js:1:1)';

    expect(errorDetail(error)).toBe('Error: сломалось\n    at somewhere (file.js:1:1)');
  });

  it('без стека — имя и сообщение', () => {
    const error = new RangeError('мимо');
    error.stack = undefined;

    expect(errorDetail(error)).toBe('RangeError: мимо');
  });

  it('цепочка причин раскрывается по звену на строку', () => {
    const root = new Error('нет сети');
    root.stack = undefined;
    const error = new Error('кит не загрузился', { cause: root });
    error.stack = undefined;

    expect(errorDetail(error)).toBe('Error: кит не загрузился\nCaused by: Error: нет сети');
  });

  it('цикл в причинах не вешает запись', () => {
    const first = new Error('a');
    const second = new Error('b', { cause: first });
    Object.assign(first, { cause: second });

    const lines = errorDetail(first)
      ?.split('\n')
      .filter((line) => line.startsWith('Caused by'));
    expect(lines).toHaveLength(5);
  });

  it('строка остаётся собой, объект — JSON, а не «[object Object]»', () => {
    expect(errorDetail('отказ')).toBe('отказ');
    expect(errorDetail({ code: 'E1' })).toBe('{"code":"E1"}');
  });

  it('то, что не уходит в JSON, — через String', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(errorDetail(cyclic)).toBe('[object Object]');
    expect(errorDetail(10n)).toBe('10');
  });
});
