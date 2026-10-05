/**
 * Каталог плагинов приложения рядом с каталогом проекта — на одном рантайме плагинов.
 *
 * Проверяется политика слоя и шов между двумя каталогами. Политика: поднимается всё найденное,
 * права не спрашиваются, проект для этого не нужен. Шов: плагин проекта вправе требовать
 * возможность плагина приложения, а копия плагина приложения в проекте молча уступает —
 * без отказа `id-taken` и без потери записи о включённости.
 *
 * @module shell/platform/plugin/application/catalog.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createModuleLoader } from '@/shell/platform/modules/loader';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createMemorySource } from '@/shell/platform/source/memory';
import {
  defineExtensionPoint,
  definePlugin,
  PLUGIN_CATALOG_DIR,
} from '@reformer/builder-plugin-api/internal';
import { createProjectPluginCatalog, type EnabledPluginsStore } from '../catalog';
import { createPluginLoader, type PluginFilesSource } from '../loader';
import { createPluginRegistry } from '../registry';
import { createMemoryStorageBackend } from '../storage';
import { APPLICATION_KEYBINDINGS_SOURCE, createApplicationPluginCatalog } from './catalog';
import { APPLICATION_ROOT_DIR } from './files';

const PanelPoint = defineExtensionPoint<string>('test.panel');

const manifestOf = (id: string, fields: Record<string, unknown> = {}): string =>
  JSON.stringify({ id, apiVersion: '^1', main: 'main.js', ...fields });

/** Плагин, вносящий панель: по её подписи видно, чей экземпляр работает. */
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

const app = (id: string, file: string): string => `${APPLICATION_ROOT_DIR}/${id}/${file}`;
const proj = (id: string, file: string): string => `${PLUGIN_CATALOG_DIR}/${id}/${file}`;

function memoryStore(initial: readonly string[] = []): EnabledPluginsStore & { ids: string[] } {
  const store = {
    ids: [...initial],
    read: () => Promise.resolve([...store.ids]),
    write: (next: readonly string[]) => {
      store.ids = [...next];
      return Promise.resolve();
    },
  };
  return store;
}

/** Источник в памяти, которому исполнение кода разрешено. */
function executable(files: Record<string, string>): PluginFilesSource {
  const memory = createMemorySource(files);
  return { ...memory, capabilities: { ...memory.capabilities, executesCode: true } };
}

function createStand(
  applicationFiles: Record<string, string>,
  projectFiles: Record<string, string> = {},
  options: { enabled?: readonly string[] } = {}
) {
  const extensions = createExtensionRegistry();
  const plugins = createPluginRegistry({
    services: createServiceRegistry(),
    extensions,
    commands: createCommandRegistry(),
    events: createEventBus(),
    storage: createMemoryStorageBackend(),
    onError: vi.fn(),
  });
  const modules = createModuleLoader({
    builtins: [['@builder/sdk', { definePlugin, PanelPoint }]],
  });
  const rules = vi.fn(() => ({ dispose: vi.fn() }));
  const keymap = { registerRules: rules };
  const applicationProblems = vi.fn();
  const projectProblems = vi.fn();
  const confirmPermissions = vi.fn(() => Promise.resolve(false));

  const application = createApplicationPluginCatalog({
    loader: createPluginLoader({
      source: () => executable(applicationFiles),
      modules,
      dir: APPLICATION_ROOT_DIR,
    }),
    plugins,
    keymap,
    onProblem: applicationProblems,
  });

  const store = memoryStore(options.enabled);
  const project = createProjectPluginCatalog({
    loader: createPluginLoader({ source: () => executable(projectFiles), modules }),
    plugins,
    keymap,
    enabled: store,
    capabilities: () => application.capabilities(),
    reserved: () => application.reserved(),
    confirmPermissions,
    onProblem: projectProblems,
  });

  return {
    application,
    project,
    plugins,
    store,
    rules,
    applicationProblems,
    projectProblems,
    confirmPermissions,
    panels: () => extensions.get(PanelPoint).map((contribution) => contribution.value),
  };
}

describe('политика слоя приложения', () => {
  it('поднимается всё найденное — без проекта и без списка включённых', async () => {
    const stand = createStand({
      [app('files', 'manifest.json')]: manifestOf('files', { name: 'Файлы' }),
      [app('files', 'main.js')]: panelPlugin('files', 'Дерево'),
      [app('editor', 'manifest.json')]: manifestOf('editor'),
      [app('editor', 'main.js')]: panelPlugin('editor', 'Редактор'),
    });

    expect((await stand.application.start()).slice().sort()).toEqual(['editor', 'files']);

    expect(stand.panels().sort()).toEqual(['Дерево', 'Редактор']);
    expect(stand.application.catalog.list().find((entry) => entry.id === 'files')).toMatchObject({
      name: 'Файлы',
      layer: 'application',
      state: 'enabled',
    });
  });

  it('плагин домена поднимается под идентификатором из манифеста', async () => {
    const stand = createStand({
      [`${APPLICATION_ROOT_DIR}/forms/kits/manifest.json`]: manifestOf('reformer.kits'),
      [`${APPLICATION_ROOT_DIR}/forms/kits/main.js`]: panelPlugin('reformer.kits', 'Киты'),
    });

    expect(await stand.application.start()).toEqual(['reformer.kits']);
    expect(stand.application.catalog.list()[0]?.dir).toBe(`${APPLICATION_ROOT_DIR}/forms/kits`);
  });

  it('права выдаются из манифеста: человека не спрашивают', async () => {
    const stand = createStand({
      [app('files', 'manifest.json')]: manifestOf('files', {
        permissions: ['workspace.resources'],
      }),
      [app('files', 'main.js')]: panelPlugin('files', 'Дерево'),
    });

    expect(await stand.application.start()).toEqual(['files']);
    expect(stand.applicationProblems).not.toHaveBeenCalled();
  });

  it('упавший плагин не мешает остальным и идентификатор не занимает', async () => {
    const stand = createStand({
      [app('broken', 'manifest.json')]: manifestOf('broken'),
      [app('broken', 'main.js')]: brokenPlugin('broken'),
      [app('files', 'manifest.json')]: manifestOf('files'),
      [app('files', 'main.js')]: panelPlugin('files', 'Дерево'),
    });

    expect(await stand.application.start()).toEqual(['files']);

    expect(stand.applicationProblems).toHaveBeenCalledWith(
      'broken',
      expect.objectContaining({ code: 'activate-failed' })
    );
    expect([...stand.application.reserved()]).toEqual(['files']);
  });

  it('клавиши манифестов публикуются под своим именем источника', async () => {
    const stand = createStand({
      [app('files', 'manifest.json')]: manifestOf('files', {
        contributes: { keybindings: [{ key: 'mod+k', command: 'files.hello' }] },
      }),
      [app('files', 'main.js')]: panelPlugin('files', 'Дерево'),
    });

    await stand.application.start();

    // Имя не то, что у каталога проекта: иначе его публикация стёрла бы эти клавиши.
    expect(stand.rules).toHaveBeenCalledWith(
      APPLICATION_KEYBINDINGS_SOURCE,
      'catalog-plugin',
      expect.arrayContaining([expect.objectContaining({ commandId: 'files.hello' })])
    );
  });

  it('слоя нет — запуск пуст и ничего не роняет', async () => {
    const stand = createStand({});

    expect(await stand.application.start()).toEqual([]);
    expect(stand.application.reserved().size).toBe(0);
  });
});

describe('плагин проекта рядом с плагинами приложения', () => {
  const KITS = {
    [app('kits', 'manifest.json')]: manifestOf('kits', {
      provides: [{ id: 'test.kit.catalog', version: '2.1.0' }],
    }),
    [app('kits', 'main.js')]: `
      const { definePlugin } = require('@builder/sdk');
      module.exports = definePlugin({
        id: 'kits',
        activate(ctx) {
          ctx.subscriptions.push(ctx.services.register({ id: 'test.kit.catalog' }, {}));
        },
      });
    `,
  };

  it('возможность плагина приложения выполняет обязательное требование плагина проекта', async () => {
    const stand = createStand(KITS, {
      [proj('acme-kit', 'manifest.json')]: manifestOf('acme-kit', {
        requires: { required: [{ id: 'test.kit.catalog', range: '^2' }] },
      }),
      [proj('acme-kit', 'main.js')]: panelPlugin('acme-kit', 'Кит Acme'),
    });
    await stand.application.start();
    await stand.project.refresh();

    expect(await stand.project.enable('acme-kit')).toBe(true);
    expect(stand.panels()).toEqual(['Кит Acme']);
  });

  it('копия плагина приложения в проекте молча уступает: работает экземпляр приложения', async () => {
    const stand = createStand(
      {
        [app('files', 'manifest.json')]: manifestOf('files'),
        [app('files', 'main.js')]: panelPlugin('files', 'Дерево приложения'),
      },
      {
        [proj('files', 'manifest.json')]: manifestOf('files', {
          contributes: { keybindings: [{ key: 'mod+k', command: 'files.hello' }] },
        }),
        [proj('files', 'main.js')]: panelPlugin('files', 'Дерево проекта'),
      },
      { enabled: ['files'] }
    );
    await stand.application.start();
    await stand.project.refresh();

    expect(await stand.project.restoreEnabled()).toEqual([]);

    expect(stand.panels()).toEqual(['Дерево приложения']);
    // Ни отказа `id-taken`, ни уведомления: копия в проекте — обычное дело, а не ошибка автора.
    expect(stand.projectProblems).not.toHaveBeenCalled();
    expect(stand.project.list()[0]).toMatchObject({
      id: 'files',
      layer: 'project',
      state: 'disabled',
      overridden: 'application',
    });
    // Запись о включённости цела: запусти то же без слоя приложения — копия поднимется сама.
    expect(stand.store.ids).toEqual(['files']);
    // Клавиши перекрытой копии каталог проекта не публикует.
    expect(stand.rules).not.toHaveBeenCalledWith(
      'plugin-catalog',
      expect.anything(),
      expect.anything()
    );
  });

  it('плагин приложения упал — копия из проекта вправе занять его место', async () => {
    const stand = createStand(
      {
        [app('files', 'manifest.json')]: manifestOf('files'),
        [app('files', 'main.js')]: brokenPlugin('files'),
      },
      {
        [proj('files', 'manifest.json')]: manifestOf('files'),
        [proj('files', 'main.js')]: panelPlugin('files', 'Дерево проекта'),
      }
    );
    await stand.application.start();
    await stand.project.refresh();

    expect(stand.project.list()[0]).not.toHaveProperty('overridden');
  });

  it('смена проекта плагины приложения не трогает', async () => {
    const stand = createStand(
      {
        [app('files', 'manifest.json')]: manifestOf('files'),
        [app('files', 'main.js')]: panelPlugin('files', 'Дерево приложения'),
      },
      {
        [proj('extra', 'manifest.json')]: manifestOf('extra'),
        [proj('extra', 'main.js')]: panelPlugin('extra', 'Панель проекта'),
      },
      { enabled: ['extra'] }
    );
    await stand.application.start();
    await stand.project.refresh();
    await stand.project.restoreEnabled();
    expect(stand.panels().sort()).toEqual(['Дерево приложения', 'Панель проекта']);

    // Так композиция снимает плагины закрытого проекта.
    stand.project.deactivateAll();

    expect(stand.panels()).toEqual(['Дерево приложения']);
  });
});
