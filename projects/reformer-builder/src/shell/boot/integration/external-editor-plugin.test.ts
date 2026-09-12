/**
 * Внешний плагин каталога умеет быть редактором кода — сквозь всю сборку.
 *
 * Это приёмка фазы 0 плана `docs/plans/builder-v4-plugin-platform-plan.md`, и проверяет она
 * не отдельный шов, а ЦЕПОЧКУ, которой до сих пор не существовало: плагин лежит файлом
 * в открытом проекте, поднимается загрузчиком, получает настоящий `@builder/sdk`, вносит
 * редактор и команду, правит текст документа службой, показывает переведённый заголовок
 * и уходит целиком при выключении.
 *
 * ## Почему одним тестом, а не четырьмя рядом с модулями
 *
 * Каждое звено уже покрыто у себя: загрузчик — в `platform/plugin/loader.test`, словари
 * и стили — в `catalog.test`, служба документов — в `boot/ports/documents.test`. Но до
 * фазы 0 внешний редактор был невозможен НЕ потому, что какое-то звено ломалось, а потому,
 * что их нечем было соединить: тело редактора получает один `documentId`, а прочитать по нему
 * текст было нечем. Такую дыру видно только на цепочке целиком, поэтому тест живёт
 * в `integration/` — единственном узаконенном исключении из «тест рядом с кодом».
 *
 * ## Что здесь НАСТОЯЩЕЕ
 *
 * Всё, кроме браузерных хранилищ: реестр модулей с подлинным `@/sdk`, загрузчик, каталог
 * плагинов, рантайм плагинов, служба локализации, держатель проекта и служба документов.
 * Подменены только IndexedDB и OPFS (памятью) и установка стилей: `CSSStyleSheet`
 * в окружении `node` нет, а вызов установки наблюдаем и без него.
 *
 * @module shell/boot/integration/external-editor-plugin.test
 */

import { describe, expect, it, vi } from 'vitest';

import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import {
  createProjectPluginCatalog,
  type EnabledPluginsStore,
} from '@/shell/platform/plugin/catalog';
import { createPluginLoader, PLUGIN_CATALOG_DIR } from '@/shell/platform/plugin/loader';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { createDiagnosticsService } from '@/shell/platform/services/diagnostics/service';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { DocumentsServiceToken } from '@reformer/builder-plugin-api/internal';
import { createMemorySource } from '@/shell/platform/source/memory';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import type { Source } from '@/shell/platform/source/types';
import { resolveEditorForDocument } from '@/shell/platform/ui/contributions/editors';
import { EditorPoint } from '@reformer/builder-plugin-api/internal';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createPluginModules } from '@/shell/boot/plugin-modules';
import { createDocumentsService } from '@/shell/boot/ports/documents';
import { createProjectHost } from '@/shell/boot/project/project';

let seq = 0;

const dir = (file: string): string => `${PLUGIN_CATALOG_DIR}/ext/${file}`;

/**
 * Код плагина — обычный JavaScript, как у собранного плагина из npm.
 *
 * Ровно то, чего внешний плагин не мог до фазы 0: `DocumentsServiceToken` даёт ему текст
 * документа и запись, а `EditorPoint` — право этот документ рисовать. Приоритет 1000 больше
 * любого встроенного (файлы дают 1, Monaco 10, markdown 50, схема 100), то есть выбор
 * редактора — это число в чужом коде, а не список в оболочке.
 */
const PLUGIN_CODE = `
const { definePlugin, EditorPoint, DocumentsServiceToken } = require('@builder/sdk');

module.exports = definePlugin({
  id: 'ext',
  activate(ctx) {
    // Словарь СВОИМ кодом, а не файлом манифеста: у собранного плагина из npm строки обычно
    // лежат в коде, и другого способа их отдать, кроме поля контекста, у него нет.

    ctx.i18n.contribute('ru', { 'command.own': 'Своя строка' });
    ctx.subscriptions.push(
      ctx.extensions.contribute(EditorPoint, {
        id: 'ext.editor',
        titleKey: 'editor.title',
        canOpen: (ref) => (ref.path.endsWith('.txt') ? 1000 : false),
        Body: () => null,
      }),
      ctx.commands.register({
        id: 'ext.own',
        titleKey: 'command.own',
        run: () => true,
      }),
      ctx.commands.register({
        id: 'ext.upper',
        titleKey: 'command.upper',
        run: async () => {
          const documents = ctx.services.require(DocumentsServiceToken);
          const id = documents.activeResource();
          if (id === null) return false;
          const document = documents.documentOf(id);
          if (document === null) return false;
          await documents.writeText(id, document.getText().toUpperCase(), { origin: 'agent' });
          return true;
        },
      })
    );
  },
});
`;

const MANIFEST = JSON.stringify({
  id: 'ext',
  name: 'External Editor',
  version: '1.0.0',
  apiVersion: '^1',
  main: 'main.js',
  styles: { file: 'styles.css', isolation: 'scoped' },
  contributes: { messages: { ru: 'locales/ru.json' } },
});

/** Память вместо настроек рабочей области: то же, что кладёт туда композиция. */
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

function harness() {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-external-${seq}` });
  const opfs = createMemoryOpfs();
  const sources = createSourceRegistry();
  const sourceId = `mem${seq}`;

  const memory = createMemorySource(
    {
      'notes.txt': 'заметка',
      [dir('manifest.json')]: MANIFEST,
      [dir('main.js')]: PLUGIN_CODE,
      [dir('locales/ru.json')]: JSON.stringify({ 'command.upper': 'Верхний регистр' }),
      [dir('styles.css')]: '.panel { color: red }',
    },
    { id: sourceId, label: `src-${seq}`, writable: true }
  );
  // Каталог проекта — локальный диск, ему исполнение своего кода разрешено. Ветка запрета
  // проверяется у загрузчика отдельно и подразумеваться здесь не должна.
  const source: Source = {
    ...memory,
    capabilities: { ...memory.capabilities, executesCode: true },
    descriptor: { kind: 'fs', handleKey: sourceId },
  };
  sources.register({ kind: 'fs', restore: () => Promise.resolve(source) });

  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  // Конкурент из оболочки, и он обязателен: без него «внешний выигрывает выбор» проверяло бы
  // пустое множество — мутация приоритета 1000 → 1 оставляла тест зелёным. Сто — столько даёт
  // редактор схемы, самый приоритетный из встроенных.
  extensions.forPlugin('builtin-editor').contribute(EditorPoint, {
    id: 'builtin.editor',
    canOpen: () => 100,
    Body: () => null,
  });
  const commands = createCommandRegistry();
  const events = createEventBus();
  const diagnostics = createDiagnosticsService();

  const project = createProjectHost({
    sources,
    handles: { keys: () => Promise.resolve([]) } as never,
    meta,
    whenContext: createWhenContextStore(),
    extensions,
    diagnostics,
    supported: () => true,
    createFiles: (workspaceId) =>
      createWorkspaceFileStore(workspaceId, {
        directory: opfs.directory,
        lock: (_name, body) => body(),
      }),
  });

  const documents = createDocumentsService({ project });
  services.register(DocumentsServiceToken, documents);

  const i18n = createI18nService({ dev: true, loadHostMessages: () => Promise.resolve({}) });

  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    // Корень службы локализации: из него сборка контекста делает `ctx.i18n` — вид
    // в пространстве имён плагина. Без него плагин получил бы словарь-пустышку.
    i18n,
    storage: createMemoryStorageBackend(),
  });

  // Реестр модулей — тот же, что собирает композиция: под именем `@builder/sdk` окажется
  // подлинный объект `@/sdk`, а не его двойник.
  const pluginModules = createPluginModules();
  // Установка стилей подменена, но ФОРМА ответа настоящая: каталог читает `ok` и держит
  // подписку, чтобы снять таблицу при выключении плагина.
  const installStyles = vi.fn(() => ({ ok: true as const, subscription: { dispose: () => {} } }));
  const onProblem = vi.fn();

  const catalog = createProjectPluginCatalog({
    loader: createPluginLoader({
      source: () => project.get()?.source ?? null,
      modules: pluginModules.modules,
      prepare: pluginModules.prepare,
    }),
    plugins,
    enabled: createStore(),
    installStyles,
    i18n,
    onProblem,
  });

  return {
    catalog,
    commands,
    extensions,
    documents,
    i18n,
    installStyles,
    onProblem,
    project,
    id: (path: string): ResourceId => `${sourceId}:${path}`,
    editors: () => extensions.get(EditorPoint),
    /** Открывает проект и включает внешний плагин — состояние, ради которого тест написан. */
    start: async () => {
      await meta.putWorkspace({
        id: sourceId,
        sourceId,
        descriptor: { ...source.descriptor },
        createdAt: 1,
        lastOpenedAt: 1,
      });
      await project.restoreLast();
      const session = project.get();
      if (session === null) throw new Error('проект не открылся');
      await catalog.refresh();
      const enabled = await catalog.enable('ext');
      if (!enabled) throw new Error('внешний плагин не включился');
      await session.documents.open(`${sourceId}:notes.txt`);
      return session;
    },
    dispose: () => {
      catalog.dispose();
      plugins.deactivateAll();
      pluginModules.dispose();
      documents.dispose();
      project.dispose();
      meta.dispose();
    },
  };
}

describe('внешний плагин каталога как редактор кода', () => {
  it('поднимается из проекта и вносит редактор от своего имени', async () => {
    const h = harness();
    await h.start();

    expect(h.catalog.list().map((entry) => [entry.id, entry.state])).toEqual([['ext', 'enabled']]);
    // Владельца проставляет реестр, а не вносящий: по нему разрешается словарь заголовка.
    expect(h.editors().map((entry) => [entry.pluginId, entry.value.id])).toContainEqual([
      'ext',
      'ext.editor',
    ]);
    h.dispose();
  });

  it('выигрывает выбор редактора у встроенных — приоритетом, а не списком в оболочке', async () => {
    const h = harness();
    const session = await h.start();
    const document = session.documents.documentOf(h.id('notes.txt'));
    if (document === null) throw new Error('документ не открылся');

    const winner = resolveEditorForDocument(h.editors(), document);

    expect(winner?.value.id).toBe('ext.editor');
    h.dispose();
  });

  it('его команда правит текст документа службой документов', async () => {
    // Главное звено фазы 0. До неё тело внешнего редактора получало `documentId` и не могло
    // ни прочитать текст, ни записать его: в `@/sdk` не было ни одного такого имени.
    const h = harness();
    const session = await h.start();
    const id = h.id('notes.txt');

    await expect(h.commands.execute('ext.upper')).resolves.toBe(true);

    expect(session.documents.documentOf(id)?.getText()).toBe('ЗАМЕТКА');
    h.dispose();
  });

  it('заголовок его команды переводится словарём из манифеста, а не маркером промаха', async () => {
    const h = harness();
    await h.start();
    await h.i18n.setLocale('ru');

    const command = h.commands.getAll().find((entry) => entry.id === 'ext.upper');

    expect(command?.pluginId).toBe('ext');
    expect(h.i18n.forPlugin('ext').t(command?.titleKey ?? '')).toBe('Верхний регистр');
    h.dispose();
  });

  it('словарь, отданный ЕГО КОДОМ, попадает в его же пространство имён', async () => {
    // Второй путь словаря, и он важнее первого: у собранного плагина из npm строки обычно
    // лежат в коде, а не отдельным файлом манифеста. До поля `ctx.i18n` отдать их было
    // некуда — сервиса локализации в `@/sdk` не было вовсе.
    const h = harness();
    await h.start();
    await h.i18n.setLocale('ru');

    const command = h.commands.getAll().find((entry) => entry.id === 'ext.own');

    expect(h.i18n.forPlugin('ext').t(command?.titleKey ?? '')).toBe('Своя строка');
    // И то же пространство имён: у оболочки этого ключа нет, подмешаться он не мог.
    expect(h.i18n.t('command.own')).toBe('⟦command.own⟧');
    h.dispose();
  });

  it('его таблица стилей уходит на установку под его же именем', async () => {
    const h = harness();
    await h.start();

    expect(h.installStyles).toHaveBeenCalledWith('.panel { color: red }', 'ext');
    expect(h.onProblem).not.toHaveBeenCalled();
    h.dispose();
  });

  it('выключение снимает редактор и команду, а документ остаётся читаемым', async () => {
    // Обратная половина контракта: плагин, ушедший не целиком, оставил бы вкладку, которую
    // рисовать больше некому.
    const h = harness();
    const session = await h.start();

    h.catalog.disable('ext');

    // Уходит ТОЛЬКО его вклад: встроенный конкурент на месте, иначе тест проходил бы и на
    // реестре, очищенном целиком.
    expect(h.editors().map((entry) => entry.value.id)).toEqual(['builtin.editor']);
    expect(h.commands.getAll().map((entry) => entry.id)).not.toContain('ext.upper');
    expect(session.documents.documentOf(h.id('notes.txt'))?.getText()).toBe('заметка');
    h.dispose();
  });
});
