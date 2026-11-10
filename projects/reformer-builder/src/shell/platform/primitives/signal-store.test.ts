import { describe, expect, it, vi } from 'vitest';

import { computed, signal } from '@reformer/core/signals';
import { createStore } from '@reformer/core/model';
import { toDisposable } from '@reformer/builder-plugin-api/internal';
import { logListenerErrors, signalFrom, toSource } from './signal-store';

/** Событийный источник, которым управляют руками. */
function fakeEvents(initial: number) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    read: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
    set(next: number) {
      current = next;
      for (const listener of [...listeners]) listener();
    },
    subscribers: () => listeners.size,
  };
}

describe('signalFrom', () => {
  it('значение источника и его изменения; подписка снимается со стором', () => {
    const events = fakeEvents(1);
    const store = createStore(() => ({ value: signalFrom(events.read, events.subscribe) }));
    expect(store.value.value).toBe(1);
    expect(events.subscribers()).toBe(1);

    events.set(2);
    expect(store.value.value).toBe(2);

    store.dispose();
    expect(events.subscribers()).toBe(0);
  });
});

describe('toSource', () => {
  it('get — текущее значение; подписчик будится один раз на изменение', () => {
    const count = signal(1);
    const source = toSource(count);
    const listener = vi.fn();
    source.subscribe(listener);

    count.value = 1; // то же значение — не изменение
    expect(listener).not.toHaveBeenCalled();
    count.value = 2;
    expect(source.get()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('снимок computed стабилен по ссылке между изменениями', () => {
    const count = signal(1);
    const snapshot = computed(() => Object.freeze({ count: count.value }));
    const source = toSource(snapshot);
    expect(source.get()).toBe(source.get());
  });

  it('снятая подписка больше не вызывается; без подписчиков наблюдатель снят', () => {
    const count = signal(1);
    const source = toSource(count);
    const listener = vi.fn();
    const subscription = source.subscribe(listener);
    subscription.dispose();
    count.value = 2;
    expect(listener).not.toHaveBeenCalled();
  });

  it('по умолчанию: одна ошибка подписчика — как есть, несколько — AggregateError', () => {
    const one = signal(0);
    const oneSource = toSource(one);
    const other = vi.fn();
    oneSource.subscribe(() => {
      throw new Error('сломан');
    });
    oneSource.subscribe(other);
    expect(() => (one.value = 1)).toThrow(/сломан/);
    expect(other).toHaveBeenCalledTimes(1);

    const many = signal(0);
    const manySource = toSource(many);
    manySource.subscribe(() => {
      throw new Error('a');
    });
    manySource.subscribe(() => {
      throw new Error('b');
    });
    expect(() => (many.value = 1)).toThrow(AggregateError);
  });

  it('политика «записать в консоль» не бросает', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const count = signal(0);
    const source = toSource(count, logListenerErrors('[test] подписчик упал'));
    source.subscribe(() => {
      throw new Error('сломан');
    });
    expect(() => (count.value = 1)).not.toThrow();
    expect(error).toHaveBeenCalledWith('[test] подписчик упал', expect.any(Error));
    error.mockRestore();
  });

  it('снятие стора отпускает подписчиков', () => {
    const count = signal(0);
    const listener = vi.fn();
    const store = createStore(() => ({ source: toSource(count) }));
    store.source.subscribe(listener);
    store.dispose();
    count.value = 1;
    expect(listener).not.toHaveBeenCalled();
  });
});
