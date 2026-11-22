/**
 * Плагины приложения поднимаются настоящим `boot` — до открытия проекта.
 *
 * Каталог слоя и его политика проверены у себя (`platform/plugin/application/*.test`). Здесь —
 * шов с запуском, которого там нет: слой читается внутри `ready`, сразу за встроенными
 * плагинами, получает настоящие модули оболочки (`@reformer/builder-plugin-api`) и настоящие
 * службы, а его отсутствие или отказ не стоят приложению запуска. Проект при этом не открыт
 * вовсе — в этом и смысл слоя: плагин каталога проекта без проекта не исполняется.
 *
 * Каталог `integration/` — единственное место оболочки, которому разрешено импортировать
 * `@/application` (исключение прописано в eslint.config.js).
 *
 * @module shell/boot/integration/application-plugins.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { defineProfile } from '@/application/profiles/profile';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import { PanelPoint } from '@reformer/builder-plugin-api/internal';
import { createMemorySource } from '@/shell/platform/source/memory';
import type { PluginFilesSource } from '@/shell/platform/plugin/loader';
import { APPLICATION_ROOT_DIR } from '@/shell/platform/plugin/application/files';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

/** Самый короткий состав: слой приложения не должен зависеть от того, что встроено. */
const bareProfile = defineProfile({
  id: 'bare',
  name: 'Голая оболочка',
  plugins: ['reformer.plugin-manager'],
});

const PLUGIN = 'acme-tree';
const at = (file: string): string => `${APPLICATION_ROOT_DIR}/${PLUGIN}/${file}`;

/** Собранный плагин: один CJS-файл, внешний модуль — контракт оболочки. */
const MAIN = `
  const { definePlugin, PanelPoint } = require('@reformer/builder-plugin-api');
  module.exports = definePlugin({
    id: '${PLUGIN}',
    activate(ctx) {
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PanelPoint,
          { id: '${PLUGIN}.panel', slot: 'panel.left', titleKey: 'acme.tree', Body: () => null },
          { id: '${PLUGIN}.panel' }
        ),
        ctx.commands.register({ id: '${PLUGIN}.hello', titleKey: 'acme.hello', run: () => 'привет' })
      );
    },
  });
`;

function applicationFiles(files: Record<string, string>): PluginFilesSource {
  const memory = createMemorySource(files);
  return { ...memory, capabilities: { ...memory.capabilities, executesCode: true } };
}

/** Окружение браузера в объёме, который трогает `boot` (см. `minimal-profile.test`). */
function stubBrowser(): void {
  const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
  vi.stubGlobal('indexedDB', createMemoryIndexedDb().factory);
  vi.stubGlobal('window', { ...listeners });
  vi.stubGlobal('document', {
    ...listeners,
    title: 'reformer-builder',
    documentElement: { classList: { add: () => {}, remove: () => {} } },
  });
}

let app: BuilderApp | null = null;

afterEach(() => {
  app?.dispose();
  app = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function start(
  files: (() => Promise<PluginFilesSource | null>) | undefined
): Promise<BuilderApp> {
  stubBrowser();
  app = boot({
    application: fromProfile(bareProfile),
    ...(files === undefined ? {} : { applicationPluginFiles: files }),
  });
  await app.ready;
  return app;
}

describe('слой плагинов приложения в запуске', () => {
  it('плагин слоя активен к концу ready — без открытого проекта', async () => {
    const started = await start(() =>
      Promise.resolve(
        applicationFiles({
          [at('manifest.json')]: JSON.stringify({
            id: PLUGIN,
            name: 'Дерево Acme',
            apiVersion: '^1',
            main: 'main.js',
          }),
          [at('main.js')]: MAIN,
        })
      )
    );

    expect(started.project.get()).toBeNull();
    expect(started.plugins.isActive(PLUGIN)).toBe(true);
    expect(started.commands.get(`${PLUGIN}.hello`)).toBeDefined();
    expect(
      started.extensions.get(PanelPoint).filter((contribution) => contribution.pluginId === PLUGIN)
    ).toHaveLength(1);
    expect(started.applicationPlugins.list()).toMatchObject([
      { id: PLUGIN, name: 'Дерево Acme', layer: 'application', state: 'enabled' },
    ]);
    // Каталог проекта о плагине приложения не знает: это не плагин проекта.
    expect(started.projectPlugins.list()).toEqual([]);
  });

  it('слоя нет — приложение поднимается как прежде', async () => {
    const withoutOption = await start(undefined);
    expect(withoutOption.applicationPlugins.list()).toEqual([]);
    expect(withoutOption.plugins.isActive('reformer.plugin-manager')).toBe(true);
    withoutOption.dispose();
    app = null;

    const withNull = await start(() => Promise.resolve(null));
    expect(withNull.applicationPlugins.list()).toEqual([]);
  });

  it('отказ слоя запуск не отменяет: встроенные работают, о сбое сказано', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const started = await start(() => Promise.reject(new Error('сеть недоступна')));

    expect(started.plugins.isActive('reformer.plugin-manager')).toBe(true);
    expect(started.applicationPlugins.list()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      '[boot] плагины приложения не загрузились',
      expect.any(Error)
    );
  });
});
