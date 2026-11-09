/**
 * Отложенная запись: отмена (`AbortError`) — не сбой [ReFormer-ee4].
 *
 * Обработчик `onChange` обрывает запрос прошлого вызова через `ctx.signal`, и `fetch` того вызова
 * отклоняется с `AbortError`. Раньше `runOutsideEffect` писал это в консоль как ошибку — в dev
 * каждая быстрая смена поля оставляла красную строку, хотя всё шло по плану.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { runOutsideEffect } from '../../../src/model/index';
import { tick } from '../../test-utils/async';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runOutsideEffect — отмена не логируется', () => {
  it('AbortError из async-записи в консоль не уходит, другая ошибка — уходит', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    runOutsideEffect(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });
    runOutsideEffect(() => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    await tick();
    await tick();
    expect(error).not.toHaveBeenCalled();

    runOutsideEffect(async () => {
      throw new Error('сеть недоступна');
    });
    await tick();
    await tick();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][1]).toEqual(new Error('сеть недоступна'));
  });
});
