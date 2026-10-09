/**
 * Живой каталог плагинов приложения: пересобранный плагин перезагружается сам.
 *
 * Проверяется наблюдатель над НАСТОЯЩИМ каталогом плагинов приложения: что перезагружается
 * именно изменившийся плагин, что упавший и появившийся поднимаются, что исчезнувший уходит —
 * и что слой без ревизий (положенный рядом со сборкой) не наблюдается вовсе. Отдельно — когда
 * проверка вообще случается: по возврату фокуса, не чаще интервала и не в скрытой вкладке.
 *
 * @module shell/platform/plugin/application/live.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createModuleLoader } from '@/shell/platform/modules/loader';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createMemorySource } from '@/shell/platform/source/memory';
import { defineExtensionPoint, definePlugin } from '@reformer/builder-plugin-api/internal';
import { createPluginLoader } from '../loader';
import { createPluginRegistry } from '../registry';
import { createMemoryStorageBackend } from '../storage';
import { createApplicationPluginCatalog } from './catalog';
import { APPLICATION_ROOT_DIR, type ApplicationFilesSource } from './files';
import { createApplicationPluginsWatch } from './live';

const PanelPoint = defineExtensionPoint<string>('test.panel');

const manifestOf = (id: string): string =>
  JSON.stringify({ id, apiVersion: '^1', main: 'main.js' });

/** Плагин, вносящий панель: по её подписи видно, какая сборка работает. */
const panelPlugin = (id: string, label: string): string => `
  const { definePlugin, PanelPoint } = require('@builder/sdk');
  module.exports = definePlugin({
    id: ${JSON.stringify(id)},
    activate(ctx) {
      ctx.subscriptions.push(
        ctx.extensions.contribute(PanelPoint, ${JSON.stringify(label)}, { id: ${JSON.stringify(`${id}.panel`)} })
      );
    },
  });
`;

const brokenPlugin = (id: string): string => `
  const { definePlugin } = require('@builder/sdk');
  module.exports = definePlugin({
    id: ${JSON.stringify(id)},
    activate() { throw new Error('не поднялся'); },
  });
`;

/** Состояние каталога на диске сервера: плагин → подпись его панели (`null` — сломан). */
type Disk = Readonly<Record<string, string | null>>;

/**
 * Слой, каким его отдал бы сервер: файлы плагинов и ревизии. Ревизия — сама подпись: изменился
 * код — изменилась и она, как у отпечатка содержимого.
 */
function layerOf(disk: Disk, options: { revisions?: boolean } = {}): ApplicationFilesSource {
  const files: Record<string, string> = {};
  for (const [id, label] of Object.entries(disk)) {
    files[`${APPLICATION_ROOT_DIR}/${id}/manifest.json`] = manifestOf(id);
    files[`${APPLICATION_ROOT_DIR}/${id}/main.js`] =
      label === null ? brokenPlugin(id) : panelPlugin(id, label);
  }
  const memory = createMemorySource(files);
  return {
    ...memory,
    capabilities: { ...memory.capabilities, executesCode: true },
    ...(options.revisions === false
      ? {}
      : { revisions: new Map(Object.entries(disk).map(([id, label]) => [id, label ?? 'сломан'])) }),
  };
}

/** Окно или документ: слушатели и способ их позвать. */
function target<Extra extends object>(extra: Extra) {
  const listeners = new Map<string, Set<() => void>>();
  return {
    ...extra,
    addEventListener(type: string, listener: () => void): void {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: () => void): void {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string): void {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
  };
}

async function createStand(initial: ApplicationFilesSource | null) {
  const extensions = createExtensionRegistry();
  const plugins = createPluginRegistry({
    services: createServiceRegistry(),
    extensions,
    commands: createCommandRegistry(),
    events: createEventBus(),
    storage: createMemoryStorageBackend(),
    onError: vi.fn(),
  });
  let current = initial;
  let served = initial;
  const application = createApplicationPluginCatalog({
    loader: createPluginLoader({
      source: () => current,
      modules: createModuleLoader({ builtins: [['@builder/sdk', { definePlugin, PanelPoint }]] }),
      dir: APPLICATION_ROOT_DIR,
    }),
    plugins,
    keymap: { registerRules: vi.fn(() => ({ dispose: vi.fn() })) },
    onProblem: vi.fn(),
  });
  if (initial !== null) await application.start();

  const load = vi.fn(() => Promise.resolve(served));
  const window = target({});
  const document = target({ visibilityState: 'visible' });
  let clock = 0;
  const watch = createApplicationPluginsWatch({
    current: () => current,
    load,
    replace: (files) => {
      current = files;
    },
    catalog: application.catalog,
    window,
    document,
    now: () => clock,
  });

  return {
    watch,
    load,
    window,
    document,
    catalog: application.catalog,
    /** То, что сервер отдаст на следующий запрос индекса. */
    serve(next: ApplicationFilesSource | null): void {
      served = next;
    },
    advance(ms: number): void {
      clock += ms;
    },
    panels: () =>
      extensions
        .get(PanelPoint)
        .map((contribution) => contribution.value)
        .sort(),
    stateOf: (id: string) => application.catalog.list().find((entry) => entry.id === id)?.state,
  };
}

describe('что наблюдается', () => {
  it('слой без ревизий неизменен: за индексом никто не ходит', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }, { revisions: false }));
    stand.serve(layerOf({ files: 'Дерево, новая сборка' }, { revisions: false }));

    await stand.watch.check();

    expect(stand.load).not.toHaveBeenCalled();
    expect(stand.panels()).toEqual(['Дерево']);
  });

  it('слоя нет — и наблюдать нечего', async () => {
    const stand = await createStand(null);

    await stand.watch.check();

    expect(stand.load).not.toHaveBeenCalled();
  });

  it('ревизии прежние — ни один плагин не тронут', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево', editor: 'Редактор' }));
    const reload = vi.spyOn(stand.catalog, 'reload');
    const refresh = vi.spyOn(stand.catalog, 'refresh');

    await stand.watch.check();

    expect(stand.load).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('плагин пересобрали', () => {
  it('перезагружается он — и работает уже новая сборка; соседи не тронуты', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево', editor: 'Редактор' }));
    const reload = vi.spyOn(stand.catalog, 'reload');
    stand.serve(layerOf({ files: 'Дерево, новая сборка', editor: 'Редактор' }));

    await stand.watch.check();

    expect(stand.panels()).toEqual(['Дерево, новая сборка', 'Редактор']);
    expect(reload.mock.calls).toEqual([['files']]);
  });

  it('повторная проверка без новой пересборки ничего не делает', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));
    stand.serve(layerOf({ files: 'Дерево, новая сборка' }));
    await stand.watch.check();
    const reload = vi.spyOn(stand.catalog, 'reload');

    await stand.watch.check();

    expect(reload).not.toHaveBeenCalled();
    expect(stand.panels()).toEqual(['Дерево, новая сборка']);
  });

  it('упавший плагин поднимается, когда его починили', async () => {
    const stand = await createStand(layerOf({ files: null, editor: 'Редактор' }));
    expect(stand.stateOf('files')).toBe('failed');
    stand.serve(layerOf({ files: 'Дерево', editor: 'Редактор' }));

    await stand.watch.check();

    expect(stand.stateOf('files')).toBe('enabled');
    expect(stand.panels()).toEqual(['Дерево', 'Редактор']);
  });

  it('сломанная пересборка роняет только свой плагин — и следующая его возвращает', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево', editor: 'Редактор' }));
    stand.serve(layerOf({ files: null, editor: 'Редактор' }));
    await stand.watch.check();
    expect(stand.stateOf('files')).toBe('failed');
    expect(stand.panels()).toEqual(['Редактор']);

    stand.serve(layerOf({ files: 'Дерево, починен', editor: 'Редактор' }));
    await stand.watch.check();

    expect(stand.panels()).toEqual(['Дерево, починен', 'Редактор']);
  });

  it('отложенный код перезагруженных плагинов дочитывается сразу', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));
    const preload = vi.spyOn(stand.catalog, 'preloadDeferred');
    stand.serve(layerOf({ files: 'Дерево, новая сборка' }));

    await stand.watch.check();

    expect(preload).toHaveBeenCalledTimes(1);
  });
});

describe('набор плагинов изменился', () => {
  it('плагин появился в каталоге — поднимается без перезагрузки страницы', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));
    stand.serve(layerOf({ files: 'Дерево', editor: 'Редактор' }));

    await stand.watch.check();

    expect(stand.panels()).toEqual(['Дерево', 'Редактор']);
    expect(stand.stateOf('editor')).toBe('enabled');
  });

  it('плагин исчез из каталога — его вклады сняты', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево', editor: 'Редактор' }));
    stand.serve(layerOf({ files: 'Дерево' }));

    await stand.watch.check();

    expect(stand.panels()).toEqual(['Дерево']);
    expect(stand.stateOf('editor')).toBeUndefined();
  });
});

describe('сервер не ответил', () => {
  it('слой остаётся прежним, плагины работают', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));
    stand.serve(null);

    await stand.watch.check();

    expect(stand.panels()).toEqual(['Дерево']);
  });

  it('каталог перестал называть ревизии — слой не подменяется', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));
    stand.serve(layerOf({ files: 'Дерево, новая сборка' }, { revisions: false }));

    await stand.watch.check();

    expect(stand.panels()).toEqual(['Дерево']);
  });

  it('отказ чтения индекса не выходит наружу необработанным', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stand.load.mockRejectedValueOnce(new Error('сеть'));

    await expect(stand.watch.check()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('когда проверяем', () => {
  it('по возврату фокуса в окно', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));
    stand.serve(layerOf({ files: 'Дерево, новая сборка' }));

    stand.window.emit('focus');
    // Проверка, начатая фокусом, — та же, что вернёт ручной вызов: дожидаемся её.
    await stand.watch.check();

    expect(stand.load).toHaveBeenCalledTimes(1);
    expect(stand.panels()).toEqual(['Дерево, новая сборка']);
  });

  it('не чаще интервала: дребезг фокуса — одна проверка', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));

    stand.window.emit('focus');
    stand.advance(200);
    stand.window.emit('focus');
    expect(stand.load).toHaveBeenCalledTimes(1);
    await stand.watch.check();

    stand.advance(1000);
    stand.window.emit('focus');
    expect(stand.load).toHaveBeenCalledTimes(2);
    await stand.watch.check();
  });

  it('вкладка стала видимой — проверка; скрылась — нет', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));

    stand.document.visibilityState = 'hidden';
    stand.document.emit('visibilitychange');
    expect(stand.load).not.toHaveBeenCalled();

    stand.document.visibilityState = 'visible';
    stand.document.emit('visibilitychange');
    expect(stand.load).toHaveBeenCalledTimes(1);
    await stand.watch.check();
  });

  it('совпавшие проверки схлопываются в одну', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));

    await Promise.all([stand.watch.check(), stand.watch.check()]);

    expect(stand.load).toHaveBeenCalledTimes(1);
  });

  it('снятый наблюдатель фокус не слушает', async () => {
    const stand = await createStand(layerOf({ files: 'Дерево' }));

    stand.watch.dispose();
    stand.window.emit('focus');
    stand.document.emit('visibilitychange');

    expect(stand.load).not.toHaveBeenCalled();
  });
});
