/**
 * Фундамент уровней над моделью [ReFormer-cn5g.1]: `OwnedSignal`, `signalFrom`, `defineBehavior`.
 *
 * Уровни (тема, язык, таблица) отдают состояние сигналами только для чтения и связываются правилами
 * между уровнями. Здесь проверяется, что сигнал владельца нельзя переписать снаружи, мост из
 * событийного источника живёт ровно столько, сколько его область, а правило снимается целиком —
 * отпиской, областью-владельцем или при ошибке в собственной сборке.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, effect, signal } from '@preact/signals-core';
import {
  createModel,
  createScope,
  createStore,
  defineBehavior,
  onScopeDispose,
  signalFrom,
  watchField,
} from '../../../src/model/index';
import { OwnedSignal } from '../../../src/model/owned-signal';
import { OwnedSignal as NodeOwnedSignal } from '../../../src/form/nodes/state/owned-signal';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Событийный источник со счётчиком подписчиков. */
function eventSource<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const l of [...listeners]) l();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get listeners() {
      return listeners.size;
    },
  };
}

describe('OwnedSignal — запись только владельцем', () => {
  it('снаружи .value только читается, владелец пишет set()', () => {
    const s = new OwnedSignal(1);
    const seen: number[] = [];
    const stop = effect(() => void seen.push(s.value));
    expect(() => {
      s.value = 2;
    }).toThrow(TypeError);
    s.set(3);
    expect(s.value).toBe(3);
    expect(s.peek()).toBe(3);
    expect(seen).toEqual([1, 3]);
    stop();
  });

  it('общий текст ошибки говорит о владельце, сигнал ноды — о методах ноды', () => {
    const level = new OwnedSignal(0);
    const node = new NodeOwnedSignal(0);
    expect(() => {
      level.value = 1;
    }).toThrow(/владелец/);
    expect(() => {
      node.value = 1;
    }).toThrow(/методы ноды/);
    node.set(5);
    expect(node.value).toBe(5);
  });
});

describe('signalFrom — сигнал над событийным источником', () => {
  it('значение — read(), обновляется по событию источника', () => {
    const src = eventSource('a');
    const store = createStore(() => ({ value: signalFrom(src.get, src.subscribe) }));
    expect(store.value.value).toBe('a');
    src.set('b');
    expect(store.value.peek()).toBe('b');
    store.dispose();
  });

  it('снаружи только чтение', () => {
    const src = eventSource(1);
    const store = createStore(() => ({ value: signalFrom(src.get, src.subscribe) }));
    expect(() => {
      (store.value as { value: number }).value = 2;
    }).toThrow(TypeError);
    store.dispose();
  });

  it('подписка снимается вместе с областью — функция отписки', () => {
    const src = eventSource(0);
    const store = createStore(() => ({ value: signalFrom(src.get, src.subscribe) }));
    expect(src.listeners).toBe(1);
    store.dispose();
    expect(src.listeners).toBe(0);
    src.set(1);
    expect(store.value.peek()).toBe(0);
  });

  it('подписка снимается вместе с областью — объект с dispose()', () => {
    const src = eventSource(0);
    const scope = createScope();
    scope.run(() =>
      signalFrom(src.get, (onChange) => {
        const stop = src.subscribe(onChange);
        return { dispose: stop };
      })
    );
    expect(src.listeners).toBe(1);
    scope.dispose();
    expect(src.listeners).toBe(0);
  });

  it('вне области предупреждает в разработке: подписку некому снять', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const src = eventSource(0);
    signalFrom(src.get, src.subscribe);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('onScopeDispose вызван вне области'));
  });

  it('computed над signalFrom пересчитывается по событию', () => {
    const src = eventSource(2);
    const store = createStore(() => {
      const value = signalFrom(src.get, src.subscribe);
      return { double: computed(() => value.value * 2) };
    });
    expect(store.double.value).toBe(4);
    src.set(5);
    expect(store.double.value).toBe(10);
    store.dispose();
  });
});

describe('defineBehavior — правило между уровнями', () => {
  it('attach подключает правило, отписка снимает созданное в setup', () => {
    const m = createModel({ lang: 'ru', reloads: 0 });
    const reloadOnLang = defineBehavior<{ lang: typeof m.$.lang; onReload: () => void }>(
      ({ lang, onReload }) => {
        watchField(lang, () => onReload());
      },
      { name: 'reloadOnLang' }
    );
    expect(reloadOnLang.name).toBe('reloadOnLang');

    const onReload = vi.fn();
    const stop = reloadOnLang.attach({ lang: m.$.lang, onReload });
    m.lang = 'en';
    expect(onReload).toHaveBeenCalledTimes(1);

    stop();
    m.lang = 'de';
    expect(onReload).toHaveBeenCalledTimes(1);
    stop(); // повторная отписка — no-op
  });

  it('setup получает область правила: scope.effect и onScopeDispose снимаются отпиской', () => {
    const source = signal(1);
    const seen: number[] = [];
    const cleanup = vi.fn();
    const rule = defineBehavior<{ source: typeof source }>((ctx, scope) => {
      scope.effect(() => void seen.push(ctx.source.value));
      onScopeDispose(cleanup);
    });
    const stop = rule.attach({ source });
    source.value = 2;
    stop();
    source.value = 3;
    expect(seen).toEqual([1, 2]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('одно правило подключается к нескольким контекстам независимо', () => {
    const a = signal(0);
    const b = signal(0);
    const hits: string[] = [];
    const rule = defineBehavior<{ s: typeof a; tag: string }>(({ s, tag }) => {
      watchField(s, () => hits.push(tag));
    });
    const stopA = rule.attach({ s: a, tag: 'a' });
    rule.attach({ s: b, tag: 'b' });
    stopA();
    a.value = 1;
    b.value = 1;
    expect(hits).toEqual(['b']);
  });

  it('внутри стора правило принадлежит его области и снимается store.dispose()', () => {
    const source = signal(0);
    const hits = vi.fn();
    const rule = defineBehavior<{ s: typeof source }>(({ s }) => {
      watchField(s, hits);
    });
    const store = createStore(() => {
      rule.attach({ s: source });
      return {};
    });
    source.value = 1;
    store.dispose();
    source.value = 2;
    expect(hits).toHaveBeenCalledTimes(1);
  });

  it('ошибка в setup снимает созданное до неё и летит дальше', () => {
    const source = signal(0);
    const hits = vi.fn();
    const rule = defineBehavior<{ s: typeof source }>(({ s }) => {
      watchField(s, hits);
      throw new Error('сборка упала');
    });
    expect(() => rule.attach({ s: source })).toThrow('сборка упала');
    source.value = 1;
    expect(hits).not.toHaveBeenCalled();
  });

  it('правило без имени — name undefined, объект правила заморожен', () => {
    const rule = defineBehavior<object>(() => {});
    expect(rule.name).toBeUndefined();
    expect(Object.isFrozen(rule)).toBe(true);
  });
});
