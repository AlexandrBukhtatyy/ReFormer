/**
 * `abortRun` — отмена прогона без нового `DOMException` на каждый вызов.
 *
 * Контракт отмены прежний: сигнал аннулирован, причина — `AbortError`, по которой отмену узнают
 * `fetch` и прикладной код. Причина одна на все отмены — это и есть экономия.
 */

import { describe, expect, it } from 'vitest';
import { abortRun } from '../../../src/model/abort';

describe('abortRun', () => {
  it('аннулирует сигнал, причина — AbortError', () => {
    const controller = new AbortController();

    abortRun(controller);

    expect(controller.signal.aborted).toBe(true);
    expect((controller.signal.reason as Error).name).toBe('AbortError');
  });

  it('причина одна на все отмены', () => {
    const first = new AbortController();
    const second = new AbortController();

    abortRun(first);
    abortRun(second);

    expect(second.signal.reason).toBe(first.signal.reason);
  });

  it('подписчик abort срабатывает один раз; повторная отмена и пустой контроллер — без действия', () => {
    const controller = new AbortController();
    let calls = 0;
    controller.signal.addEventListener('abort', () => calls++);

    abortRun(controller);
    abortRun(controller);
    abortRun(undefined);
    abortRun(null);

    expect(calls).toBe(1);
  });

  it('ожидающий отмены код получает AbortError', async () => {
    const controller = new AbortController();
    const waiting = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason));
    });

    abortRun(controller);

    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  });
});
