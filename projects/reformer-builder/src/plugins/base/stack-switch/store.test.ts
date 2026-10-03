/**
 * Наблюдаемое состояние переключателя: когда список пересчитывается и когда — нет.
 *
 * Обе половины несущие. Не пересчитался — ячейка показывает кит, которого уже нет. Пересчитался
 * без повода — `useSyncExternalStore` получает новую ссылку на каждой отрисовке и уходит
 * в бесконечную перерисовку.
 *
 * @module plugins/base/stack-switch/store.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { Disposable, KitsService, KitSummary } from '@reformer/builder-plugin-api';
import { createSwitchStore } from './store';

const PROFILES = {
  current: () => ({ id: 'reformer.builder', name: 'ReFormer' }),
  launch: () => ({ id: 'reformer.builder', name: 'ReFormer' }),
  offered: () => [
    { id: 'reformer.builder', name: 'ReFormer' },
    { id: 'rjsf.builder', name: 'RJSF' },
  ],
};

const summary = (id: string, active: boolean): KitSummary => ({
  id,
  label: id,
  package: `@vendor/${id}`,
  version: '1.0.0',
  active,
  origin: { kind: 'builtin' },
});

/** Служба китов в объёме хранилища: список и два события, которые можно поднять из теста. */
function fakeKits(initial: KitSummary[]) {
  let available = initial;
  const changed = new Set<() => void>();
  const availableChanged = new Set<() => void>();
  const on =
    (set: Set<() => void>) =>
    (cb: () => void): Disposable => {
      set.add(cb);
      return { dispose: () => void set.delete(cb) };
    };
  const service = {
    available: () => available,
    onDidChange: on(changed),
    onDidChangeAvailable: on(availableChanged),
  } as unknown as KitsService;
  return {
    service,
    listeners: () => changed.size + availableChanged.size,
    setAvailable(next: KitSummary[]) {
      available = next;
      for (const cb of [...availableChanged]) cb();
    },
    activate(id: string) {
      available = available.map((kit) => ({ ...kit, active: kit.id === id }));
      for (const cb of [...changed]) cb();
    },
  };
}

/** Возможности в объёме `observe`: владельца службы можно сменить из теста. */
function fakeCapabilities(initial?: KitsService) {
  let listener: ((impl: KitsService | undefined) => void) | null = null;
  let disposed = false;
  return {
    capabilities: {
      observe: (_cap: unknown, cb: (impl: KitsService | undefined) => void): Disposable => {
        listener = cb;
        cb(initial);
        return {
          dispose: () => {
            disposed = true;
          },
        };
      },
    } as Parameters<typeof createSwitchStore>[0]['capabilities'],
    provide: (impl: KitsService | undefined) => listener?.(impl),
    disposed: () => disposed,
  };
}

describe('состояние переключателя', () => {
  it('ссылка на снимок стабильна, пока ничего не изменилось', () => {
    const kits = fakeKits([summary('reformer-ui-kit', true)]);
    const store = createSwitchStore({
      profiles: () => PROFILES,
      capabilities: fakeCapabilities(kits.service).capabilities,
    });

    expect(store.get()).toBe(store.get());
  });

  it('сменился активный кит — снимок новый, подписчик уведомлён', () => {
    const kits = fakeKits([summary('reformer-ui-kit', true), summary('hexa-ui', false)]);
    const store = createSwitchStore({
      profiles: () => PROFILES,
      capabilities: fakeCapabilities(kits.service).capabilities,
    });
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.get();

    kits.activate('hexa-ui');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).not.toBe(before);
    expect(store.get().label).toBe('ReFormer · hexa-ui');
  });

  it('плагин внёс кит — в списке появились сочетания с ним', () => {
    const kits = fakeKits([summary('reformer-ui-kit', true)]);
    const store = createSwitchStore({
      profiles: () => PROFILES,
      capabilities: fakeCapabilities(kits.service).capabilities,
    });
    expect(store.get().combinations).toHaveLength(2);

    kits.setAvailable([summary('reformer-ui-kit', true), summary('hexa-ui', false)]);

    expect(store.get().combinations).toHaveLength(4);
  });

  it('служба китов появилась позже — порядок активации плагинов незначим', () => {
    const provider = fakeCapabilities(undefined);
    const store = createSwitchStore({
      profiles: () => PROFILES,
      capabilities: provider.capabilities,
    });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.get().label).toBe('ReFormer');

    provider.provide(fakeKits([summary('reformer-ui-kit', true)]).service);

    expect(listener).toHaveBeenCalled();
    expect(store.get().label).toBe('ReFormer · reformer-ui-kit');
  });

  it('у службы сменился владелец — подписки переезжают, прежние сняты', () => {
    const first = fakeKits([summary('reformer-ui-kit', true)]);
    const second = fakeKits([summary('hexa-ui', true)]);
    const provider = fakeCapabilities(first.service);
    const store = createSwitchStore({
      profiles: () => PROFILES,
      capabilities: provider.capabilities,
    });

    provider.provide(second.service);

    expect(first.listeners()).toBe(0);
    expect(second.listeners()).toBe(2);
    expect(store.get().label).toBe('ReFormer · hexa-ui');
  });

  it('отписанный подписчик не зовётся; снятое хранилище отпускает и возможность, и службу', () => {
    const kits = fakeKits([summary('reformer-ui-kit', true), summary('hexa-ui', false)]);
    const provider = fakeCapabilities(kits.service);
    const store = createSwitchStore({
      profiles: () => PROFILES,
      capabilities: provider.capabilities,
    });
    const listener = vi.fn();
    store.subscribe(listener).dispose();

    kits.activate('hexa-ui');
    expect(listener).not.toHaveBeenCalled();

    store.dispose();
    expect(provider.disposed()).toBe(true);
    expect(kits.listeners()).toBe(0);
  });
});
