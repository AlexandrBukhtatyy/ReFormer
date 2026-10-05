import { describe, expect, it, vi } from 'vitest';

import type { CatalogJson, KitSource } from '@reformer/builder-plugin-api';
import { createKitCellStore, describeKits } from './cell';
import { createKitsService } from './service';

function kit(id: string, label: string): KitSource {
  const catalog: CatalogJson = {
    version: '2.1',
    kit: { id, label, package: `@vendor/${id}`, version: '1.2.3' },
    components: [{ name: 'Alpha', role: 'field', propsSchema: { type: 'object' } }],
  };
  return { catalog };
}

const KIT_A = kit('kit-a', 'Кит А');
const KIT_B = kit('kit-b', 'Кит Б');

describe('describeKits', () => {
  it('название и идентификатор — у действующего кита, список — в порядке службы', () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    const state = describeKits(kits);

    expect(state.label).toBe('Кит А');
    expect(state.activeId).toBe('kit-a');
    expect(state.kits.map((summary) => summary.id)).toEqual(['kit-a', 'kit-b']);
  });

  it('действующего кита нет — показывать нечего', () => {
    expect(describeKits({ available: () => [] })).toEqual({
      kits: [],
      label: null,
      activeId: null,
    });
  });
});

describe('createKitCellStore', () => {
  it('снимок стабилен между изменениями: условие useSyncExternalStore', () => {
    const store = createKitCellStore(createKitsService({ sources: [KIT_A, KIT_B] }));

    expect(store.get()).toBe(store.get());
  });

  it('смена активного кита даёт новый снимок и будит подписчика', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const store = createKitCellStore(kits);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.get();

    await kits.activate('kit-b');

    expect(listener).toHaveBeenCalled();
    expect(store.get()).not.toBe(before);
    expect(store.get().label).toBe('Кит Б');
  });

  it('кит, внесённый плагином, появляется в списке', () => {
    const kits = createKitsService({ sources: [KIT_A] });
    const store = createKitCellStore(kits);
    const listener = vi.fn();
    store.subscribe(listener);

    kits.syncContributed([{ source: kit('hexa', 'HexaUI'), pluginId: 'kit-hexa-ui' }]);

    expect(listener).toHaveBeenCalled();
    expect(store.get().kits.map((summary) => summary.id)).toEqual(['kit-a', 'hexa']);
  });

  it('отписавшийся подписчик больше не зовётся', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const store = createKitCellStore(kits);
    const listener = vi.fn();
    store.subscribe(listener).dispose();

    await kits.activate('kit-b');

    expect(listener).not.toHaveBeenCalled();
  });

  it('снятое хранилище не держит подписок на службе', async () => {
    // Живая подписка выключенного плагина — ход, уходящий в объект, которого больше нет.
    const subscriptions = { change: 0, available: 0 };
    const store = createKitCellStore({
      available: () => [],
      onDidChange: () => {
        subscriptions.change += 1;
        return { dispose: () => (subscriptions.change -= 1) };
      },
      onDidChangeAvailable: () => {
        subscriptions.available += 1;
        return { dispose: () => (subscriptions.available -= 1) };
      },
    });
    expect(subscriptions).toEqual({ change: 1, available: 1 });

    store.dispose();

    expect(subscriptions).toEqual({ change: 0, available: 0 });
  });
});
