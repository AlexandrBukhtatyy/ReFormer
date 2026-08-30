import { describe, expect, it, vi } from 'vitest';

import { createChordState } from './chords';

/**
 * Планировщик-двойник: держит отложенный вызов и запускает его по команде теста.
 *
 * Настоящий таймер здесь платил бы пятью секундами за прогон, который обязан оставаться
 * семисекундным целиком, — поэтому планировщик и вынесен во вход.
 */
function fakeScheduler() {
  let pending: (() => void) | null = null;
  let cancelled = 0;
  return {
    schedule: (fn: () => void): unknown => {
      pending = fn;
      return 1;
    },
    cancelScheduled: (): void => {
      pending = null;
      cancelled += 1;
    },
    fire(): void {
      const fn = pending;
      pending = null;
      fn?.();
    },
    get cancelledTimes(): number {
      return cancelled;
    },
    get armed(): boolean {
      return pending !== null;
    },
  };
}

function setup() {
  const scheduler = fakeScheduler();
  const state = createChordState({
    timeoutMs: 5000,
    schedule: scheduler.schedule,
    cancelScheduled: scheduler.cancelScheduled,
  });
  return { scheduler, state };
}

describe('ожидание второй ступени', () => {
  it('пока ничего не начато, ожидания нет', () => {
    const { state } = setup();

    expect(state.get().prefix).toEqual([]);
    expect(state.get().labels).toEqual([]);
  });

  it('начатый аккорд помнит нажатое и его подпись', () => {
    // Подпись нужна строке состояния: показать надо то, что человек нажал, а не канон.
    const { state } = setup();

    state.begin(['ctrl+k'], ['Ctrl+K']);

    expect(state.get().prefix).toEqual(['ctrl+k']);
    expect(state.get().labels).toEqual(['Ctrl+K']);
  });

  it('отмена возвращает состояние к пустому', () => {
    const { state } = setup();
    state.begin(['ctrl+k'], ['Ctrl+K']);

    state.cancel();

    expect(state.get().prefix).toEqual([]);
  });

  it('таймаут отменяет ожидание', () => {
    // Без него состояние живёт до следующего нажатия, а оно может случиться через минуту —
    // в чужом контексте, где человек уже забыл про начатый аккорд.
    const { scheduler, state } = setup();
    state.begin(['ctrl+k'], ['Ctrl+K']);

    scheduler.fire();

    expect(state.get().prefix).toEqual([]);
  });

  it('отмена снимает таймер, а не оставляет его тикать', () => {
    const { scheduler, state } = setup();
    state.begin(['ctrl+k'], ['Ctrl+K']);

    state.cancel();

    expect(scheduler.armed).toBe(false);
  });

  it('повторный старт перезапускает таймер, а не заводит второй', () => {
    const { scheduler, state } = setup();
    state.begin(['ctrl+k'], ['Ctrl+K']);

    state.begin(['ctrl+x'], ['Ctrl+X']);

    expect(scheduler.cancelledTimes).toBe(1);
    expect(state.get().prefix).toEqual(['ctrl+x']);
  });
});

describe('подписка', () => {
  it('уведомляет о начале и об отмене', () => {
    const { state } = setup();
    const seen = vi.fn();
    state.subscribe(seen);

    state.begin(['ctrl+k'], ['Ctrl+K']);
    expect(seen).toHaveBeenCalledTimes(1);

    state.cancel();
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('отмена без ожидания никого не будит', () => {
    // Отмену зовут на каждое нажатие второй ступени и на каждый Escape; будить на ней
    // подписчиков значило бы перерисовывать строку состояния впустую.
    const { state } = setup();
    const seen = vi.fn();
    state.subscribe(seen);

    state.cancel();

    expect(seen).not.toHaveBeenCalled();
  });

  it('снимок между изменениями — та же ссылка', () => {
    // Требование `useSyncExternalStore`: новый объект на каждый вызов уводит React
    // в бесконечную перерисовку.
    const { state } = setup();

    expect(state.get()).toBe(state.get());
    state.begin(['ctrl+k'], ['Ctrl+K']);
    expect(state.get()).toBe(state.get());
  });

  it('снятая подписка молчит', () => {
    const { state } = setup();
    const seen = vi.fn();
    state.subscribe(seen).dispose();

    state.begin(['ctrl+k'], ['Ctrl+K']);

    expect(seen).not.toHaveBeenCalled();
  });
});

describe('освобождение', () => {
  it('dispose снимает таймер и подписчиков', () => {
    const { scheduler, state } = setup();
    const seen = vi.fn();
    state.subscribe(seen);
    state.begin(['ctrl+k'], ['Ctrl+K']);

    state.dispose();

    expect(scheduler.armed).toBe(false);
    expect(state.get().prefix).toEqual([]);
    state.begin(['ctrl+x'], ['Ctrl+X']);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
