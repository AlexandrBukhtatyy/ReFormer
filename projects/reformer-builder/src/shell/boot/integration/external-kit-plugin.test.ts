/**
 * Кит приходит внешним плагином каталога проекта — сквозь всю сборку.
 *
 * Каждое звено проверено у себя: загрузчик — `platform/plugin/loader.test`, каталог плагинов —
 * `catalog.test`, реестр китов и отказы китов — `plugins/kits/registry/service.test`. Здесь —
 * цепочка, ради которой кит стал вкладом в точку, а не параметром реестра: плагин лежит файлом
 * в открытом проекте, требует службу китов манифестом, поднимается загрузчиком, вносит кит, кит
 * появляется в выборе с владельцем, выбирается, уходит вместе с плагином и возвращается с ним.
 *
 * Код плагина верхним уровнем берёт ЛЕНИВЫЙ модуль оболочки (`@reformer/cdk/form-field`): кит
 * с обёрткой поля на cdk делает ровно так, и без прогрева до линковки загрузка падала бы на
 * `require` («модуль ещё не загружен»).
 *
 * ## Что здесь НАСТОЯЩЕЕ
 *
 * Реестр модулей с подлинным `@reformer/builder-plugin-api`, загрузчик, каталог плагинов, рантайм
 * плагинов, плагин китов с проверкой каталога контрактом SDK, держатель проекта. Подменены браузерные
 * хранилища (памятью), настройки (памятью) и установка стилей.
 *
 * @module shell/boot/integration/external-kit-plugin.test
 */

import { describe, expect, it, vi } from 'vitest';

import {
  KitsCapability,
  type CapabilityProvider,
  type Disposable,
  type KitsService,
} from '@reformer/builder-plugin-api';
import { PLUGIN_CATALOG_DIR } from '@reformer/builder-plugin-api/internal';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import {
  createProjectPluginCatalog,
  type EnabledPluginsStore,
} from '@/shell/platform/plugin/catalog';
import { createPluginLoader } from '@/shell/platform/plugin/loader';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { createDiagnosticsService } from '@/shell/platform/services/diagnostics/service';
import {
  createInMemorySettingsBackend,
  createSettingsService,
} from '@/shell/platform/services/settings';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createMemorySource } from '@/shell/platform/source/memory';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import type { Source } from '@/shell/platform/source/types';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createPluginModules } from '@/shell/boot/plugin-modules';
import { createProjectHost } from '@/shell/boot/project/project';
import { createKitsPlugin, type KitsSettings } from '@/plugins/kits/registry';

let seq = 0;

const PLUGIN_ID = 'kit-fixture';
const KIT_ID = 'fixture';

const dir = (file: string): string => `${PLUGIN_CATALOG_DIR}/${PLUGIN_ID}/${file}`;

/** Код плагина — обычный CommonJS, как у собранного `reformer-plugin build`. */
const PLUGIN_CODE = `
const { definePlugin, KitSourcePoint } = require('@builder/sdk');
// Ленивый модуль оболочки верхним уровнем: загрузчик обязан прогреть его до линковки.
const { FormField } = require('@reformer/cdk/form-field');

module.exports = definePlugin({
  id: '${PLUGIN_ID}',
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.extensions.contribute(
        KitSourcePoint,
        {
          catalog: {
            version: '2.1',
            kit: { id: '${KIT_ID}', label: 'Fixture Kit', package: '@vendor/fixture-kit' },
            components: [{ name: 'Input', role: 'field', propsSchema: {} }],
          },
          namespace: () => Promise.resolve({ Input: function Input() { return null; }, FormField }),
        },
        { id: '${KIT_ID}' }
      )
    );
  },
});
`;

const MANIFEST = JSON.stringify({
  id: PLUGIN_ID,
  name: 'Fixture Kit',
  version: '1.0.0',
  apiVersion: '^1',
  main: 'main.js',
  requires: { required: [{ id: 'reformer.kit.catalog', range: '^2' }] },
});

/** Возможность службы китов — её объявляет встроенный плагин китов состава. */
const KITS_PROVIDED: CapabilityProvider = {
  id: KitsCapability.id,
  version: KitsCapability.version,
  by: 'reformer.kits',
};

function createStore(): EnabledPluginsStore {
  let ids: readonly string[] = [];
  return {
    read: () => Promise.resolve([...ids]),
    write: (next) => {
      ids = [...next];
      return Promise.resolve();
    },
  };
}

/** Настройки памятью: выбор кита переживает выключение плагина — как настоящая запись. */
function createSettings(): KitsSettings {
  const values = new Map<string, unknown>();
  const defaults = new Map<string, unknown>();
  const listeners = new Set<(key: string) => void>();
  return {
    get: <T>(key: string) => (values.has(key) ? values.get(key) : defaults.get(key)) as T,
    set: <T>(key: string, value: T) => {
      values.set(key, value);
      for (const listener of [...listeners]) listener(key);
      return Promise.resolve();
    },
    registerDefault: <T>(key: string, value: T): Disposable => {
      defaults.set(key, value);
      return {
        dispose: () => {
          defaults.delete(key);
        },
      };
    },
    onDidChange: (cb): Disposable => {
      listeners.add(cb);
      return {
        dispose: () => {
          listeners.delete(cb);
        },
      };
    },
  };
}

function harness(options: { withKits?: boolean; settings?: KitsSettings } = {}) {
  const withKits = options.withKits ?? true;
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-kit-${seq}` });
  const opfs = createMemoryOpfs();
  const sources = createSourceRegistry();
  const sourceId = `kitmem${seq}`;

  const memory = createMemorySource(
    {
      'form.json': '{}',
      [dir('manifest.json')]: MANIFEST,
      [dir('main.js')]: PLUGIN_CODE,
    },
    { id: sourceId, label: `kit-${seq}`, writable: true }
  );
  const source: Source = {
    ...memory,
    capabilities: { ...memory.capabilities, executesCode: true },
    descriptor: { kind: 'fs', handleKey: sourceId },
  };
  sources.register({ kind: 'fs', restore: () => Promise.resolve(source) });

  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  const project = createProjectHost({
    sources,
    handles: { keys: () => Promise.resolve([]) } as never,
    meta,
    whenContext: createWhenContextStore(),
    extensions,
    diagnostics: createDiagnosticsService(),
    supported: () => true,
    createFiles: (workspaceId) =>
      createWorkspaceFileStore(workspaceId, {
        directory: opfs.directory,
        lock: (_name, body) => body(),
      }),
  });

  const i18n = createI18nService({ dev: true, loadHostMessages: () => Promise.resolve({}) });
  const plugins = createPluginRegistry({
    services,
    extensions,
    commands: createCommandRegistry(),
    events: createEventBus(),
    i18n,
    storage: createMemoryStorageBackend(),
  });

  // Встроенный плагин китов — тот же, что в составе приложения; встроенный кит — пустой каталог,
  // чтобы тест не зависел от 900 кБ каталога ui-kit.
  if (withKits) {
    plugins.register(
      createKitsPlugin({
        settings: options.settings ?? createSettings(),
        sources: [
          {
            catalog: {
              version: '2.1',
              kit: { id: 'builtin', label: 'Builtin', package: '@vendor/builtin' },
              components: [],
            },
          },
        ],
      }),
      [{ id: KITS_PROVIDED.id, version: KITS_PROVIDED.version }]
    );
    plugins.activateAll();
  }

  const pluginModules = createPluginModules();
  const onProblem = vi.fn();
  const catalog = createProjectPluginCatalog({
    loader: createPluginLoader({
      source: () => project.get()?.source ?? null,
      modules: pluginModules.modules,
      prepare: pluginModules.prepare,
      warm: pluginModules.warm,
    }),
    plugins,
    enabled: createStore(),
    installStyles: () => ({ ok: true as const, subscription: { dispose: () => undefined } }),
    i18n,
    onProblem,
    capabilities: () => (withKits ? [KITS_PROVIDED] : []),
  });

  const kits = (): KitsService => {
    const service = services.get(KitsCapability);
    if (service === undefined) throw new Error('службы китов нет');
    return service;
  };

  return {
    catalog,
    kits,
    onProblem,
    /** Открывает проект и включает внешний кит-плагин. */
    start: async () => {
      await meta.putWorkspace({
        id: sourceId,
        sourceId,
        descriptor: { ...source.descriptor },
        createdAt: 1,
        lastOpenedAt: 1,
      });
      await project.restoreLast();
      if (project.get() === null) throw new Error('проект не открылся');
      await catalog.refresh();
      return catalog.enable(PLUGIN_ID);
    },
    dispose: () => {
      catalog.dispose();
      plugins.deactivateAll();
      pluginModules.dispose();
      project.dispose();
      meta.dispose();
    },
  };
}

describe('кит внешним плагином каталога проекта', () => {
  it('включение ставит кит в выбор — с владельцем-плагином', async () => {
    const h = harness();

    expect(await h.start()).toBe(true);

    const fixture = h
      .kits()
      .available()
      .find((kit) => kit.id === KIT_ID);
    expect(fixture?.origin).toEqual({ kind: 'plugin', pluginId: PLUGIN_ID });
    // Выбор не переключается сам: кит только появился, а выбирает человек.
    expect(h.kits().activeId()).toBe('builtin');
    expect(h.onProblem).not.toHaveBeenCalled();
    h.dispose();
  });

  it('выбранный кит отдаёт свой каталог и пространство имён', async () => {
    const h = harness();
    await h.start();

    await h.kits().activate(KIT_ID);

    expect(h.kits().activeOrigin()).toEqual({ kind: 'plugin', pluginId: PLUGIN_ID });
    await vi.waitFor(() => {
      expect(
        h
          .kits()
          .catalogJson()
          .components.map((record) => record.name)
      ).toEqual(['Input']);
    });
    h.kits().namespace();
    await vi.waitFor(() => {
      expect(Object.keys(h.kits().namespace() ?? {})).toEqual(['Input', 'FormField']);
    });
    h.dispose();
  });

  it('выключение плагина возвращает умолчание, включение — его выбор', async () => {
    const h = harness();
    await h.start();
    await h.kits().activate(KIT_ID);

    h.catalog.disable(PLUGIN_ID);

    expect(h.kits().activeId()).toBe('builtin');
    expect(
      h
        .kits()
        .available()
        .map((kit) => kit.id)
    ).toEqual(['builtin']);

    expect(await h.catalog.enable(PLUGIN_ID)).toBe(true);

    // Выбор записан в настройки и пережил выключение: кит вернулся — и снова активен.
    expect(h.kits().activeId()).toBe(KIT_ID);
    h.dispose();
  });

  it('без службы китов плагин не включается: требование манифеста не выполнено', async () => {
    const h = harness({ withKits: false });

    expect(await h.start()).toBe(false);

    expect(h.onProblem).toHaveBeenCalledWith(
      PLUGIN_ID,
      expect.objectContaining({ code: 'requires-unsatisfied' })
    );
    h.dispose();
  });
});

describe('кит организации — умолчанием конфига запуска', () => {
  /** Настоящая служба настроек со словом организации: `defaults.settings` конфига лаунчера. */
  const orgSettings = () =>
    createSettingsService(createInMemorySettingsBackend(), {
      launchDefaults: { 'plugin.kits.active': KIT_ID },
    });

  it('кит плагина становится активным, как только плагин его внёс, — без выбора человека', async () => {
    const h = harness({ settings: orgSettings() });

    // Плагина ещё нет — названный кит недоступен, действует встроенный.
    expect(h.kits().activeId()).toBe('builtin');
    expect(await h.start()).toBe(true);

    expect(h.kits().activeId()).toBe(KIT_ID);
    expect(h.kits().activeOrigin()).toEqual({ kind: 'plugin', pluginId: PLUGIN_ID });
    h.dispose();
  });

  it('выбор человека сильнее слова организации', async () => {
    const settings = orgSettings();
    const h = harness({ settings });
    await h.start();

    await h.kits().activate('builtin');

    expect(h.kits().activeId()).toBe('builtin');
    expect(settings.scopeOf('plugin.kits.active')).toBe('user');
    h.dispose();
  });
});
