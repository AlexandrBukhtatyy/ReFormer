/**
 * Шаблоны в контекстном меню дерева — настоящим `boot` на профиле `reformer.builder`.
 *
 * Вклады плагина проверяет его собственный тест, но подписи там — ключи, а вложенность — поля
 * `menu`/`submenu`. Что человек увидит ОДИН заголовок «Шаблоны» с двумя строками под ним,
 * решают трое: вклады, сборщик меню оболочки и словарь плагина. Здесь они сведены вместе.
 *
 * @module shell/boot/integration/templates-menu.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { reformerApplication } from './application';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import {
  MenuPoint,
  RESOURCE_CONTEXT_MENU,
  type ResourceRef,
} from '@reformer/builder-plugin-api/internal';
import { buildMenu, type MenuNode, type MenuSubmenuNode } from '@/shell/platform/ui/menu/menu';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

/** Окружение браузера в объёме, который трогает `boot` при сборке (см. `base-profile.test`). */
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
});

async function start(): Promise<BuilderApp> {
  stubBrowser();
  app = boot({ application: reformerApplication() });
  await app.ready;
  await app.i18n.setLocale('ru');
  return app;
}

const DIRECTORY: ResourceRef = {
  id: 'mem:forms',
  sourceId: 'mem',
  path: 'forms',
  name: 'forms',
  kind: 'directory',
  mediaType: 'inode/directory',
};

const FILE: ResourceRef = {
  id: 'mem:forms/model.ts',
  sourceId: 'mem',
  path: 'forms/model.ts',
  name: 'model.ts',
  kind: 'file',
  mediaType: 'text/typescript',
};

/** Меню дерева так, как его соберёт оболочка по щелчку на `ref` (`null` — пустое место). */
function treeMenu(started: BuilderApp, ref: ResourceRef | null): readonly MenuNode[] {
  return buildMenu(
    {
      entries: started.extensions.get(MenuPoint),
      ctx: started.whenContext.get(),
      target: {
        ref,
        dir: ref?.kind === 'directory' ? ref.id : 'mem:',
        selection: ref === null ? [] : [ref],
        rootId: 'mem:',
      },
      commands: started.commands,
      translate: (key, owner) =>
        owner?.pluginId === undefined
          ? started.i18n.t(key)
          : started.i18n.forPlugin(owner.pluginId).t(key),
      execute: () => {},
    },
    RESOURCE_CONTEXT_MENU
  );
}

/** Подписи строк одного уровня; разделители опущены. */
function titles(nodes: readonly MenuNode[]): readonly string[] {
  return nodes.flatMap((node) => (node.kind === 'separator' ? [] : [node.title]));
}

function templatesOf(nodes: readonly MenuNode[]): MenuSubmenuNode | undefined {
  return nodes.find(
    (node): node is MenuSubmenuNode => node.kind === 'submenu' && node.title === 'Шаблоны'
  );
}

describe('шаблоны в меню дерева', () => {
  it('на каталоге — один заголовок «Шаблоны»: создать шаблон и создать по шаблону', async () => {
    const started = await start();

    // Список шаблонов читается обещанием: до первого ответа хранилищ подменю «Создать по
    // шаблону» пусто и не рисуется.
    await vi.waitFor(() => {
      expect(titles(templatesOf(treeMenu(started, DIRECTORY))?.items ?? [])).toEqual([
        'Создать шаблон…',
        'Создать по шаблону',
      ]);
    });

    const root = titles(treeMenu(started, DIRECTORY));
    expect(root.filter((title) => title.toLowerCase().includes('шаблон'))).toEqual(['Шаблоны']);
  });

  it('под «Создать по шаблону» — сами шаблоны, а не ещё один диалог выбора', async () => {
    const started = await start();

    await vi.waitFor(() => {
      const apply = templatesOf(treeMenu(started, DIRECTORY))?.items.find(
        (node): node is MenuSubmenuNode => node.kind === 'submenu'
      );
      expect(apply?.items.length).toBeGreaterThan(0);
      expect(apply?.items.every((node) => node.kind === 'item')).toBe(true);
    });
  });

  it('на файле заголовок гаснет, а не исчезает', async () => {
    const started = await start();

    await vi.waitFor(() => {
      expect(templatesOf(treeMenu(started, FILE))?.enabled).toBe(false);
    });
    expect(templatesOf(treeMenu(started, DIRECTORY))?.enabled).toBe(true);
  });

  it('на пустом месте панели шаблон не собирают: остаётся только «Создать по шаблону»', async () => {
    const started = await start();

    await vi.waitFor(() => {
      expect(titles(templatesOf(treeMenu(started, null))?.items ?? [])).toEqual([
        'Создать по шаблону',
      ]);
    });
  });
});
