/**
 * Настройки плагина каталога — вся цепочка целиком.
 *
 * Каждое звено покрыто своим тестом, но между ними и живёт ошибка сборки: плагин вносит вклад
 * в точку из `@builder/sdk`, каталог поднимает его настоящим загрузчиком, а композиция читает
 * вклад и отдаёт разделу схему. Двойники по краям этого не ловят — точку-двойник композиция
 * прочитала бы пустой и не заметила.
 *
 * Здесь настоящие: реестр вкладов, рантайм плагинов, каталог, загрузчик и модуль `@builder/sdk`,
 * который получает плагин. Подделан только источник — память вместо файловой системы, ровно как
 * в тестах каталога.
 *
 * @module shell/boot/integration/plugin-settings.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createProjectPluginCatalog } from '@/shell/platform/plugin/catalog';
import { createPluginLoader, PLUGIN_CATALOG_DIR } from '@/shell/platform/plugin/loader';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { createModuleLoader } from '@/shell/platform/modules/loader';
import { createMemorySource } from '@/shell/platform/source/memory';
import type { Source } from '@/shell/platform/source/types';
import { definePlugin } from '@/shell/platform/plugin/types';
import { CatalogPluginSettingsPoint } from '@/shell/platform/ui/contributions/plugin-settings';
import { asFormSchema } from '../settings/schema-guard';

const dir = (id: string, file: string): string => `${PLUGIN_CATALOG_DIR}/${id}/${file}`;

const manifest = (id: string): string =>
  JSON.stringify({ id, name: id, version: '1.0.0', apiVersion: '1.0.0', main: 'main.js' });

/**
 * Плагин ровно так, как его напишет автор: схема формы из двух полей и вклад в точку.
 *
 * Текстом, а не импортом: он проходит через настоящий загрузчик и линковщик, то есть
 * проверяется в том числе и то, что `@builder/sdk` отдаёт нужные имена.
 */
const PLUGIN_SOURCE = `
  const { CatalogPluginSettingsPoint, definePlugin } = require('@builder/sdk');
  const SCHEMA = {
    version: '1.0',
    root: {
      $nodeId: 'root',
      component: '$html(div)',
      children: [
        { $nodeId: 'endpoint', component: '$component(Input)', value: '$model(endpoint)',
          componentProps: { label: 'Адрес сервиса' } },
        { $nodeId: 'verbose', component: '$component(Switch)', value: '$model(verbose)',
          componentProps: { label: 'Подробный журнал' } },
      ],
    },
  };
  module.exports = definePlugin({
    id: 'acme',
    activate(ctx) {
      ctx.subscriptions.push(
        ctx.extensions.contribute(CatalogPluginSettingsPoint, { pluginId: ctx.id, schema: SCHEMA })
      );
    },
  });
`;

function harness(files: Record<string, string>) {
  const memory = createMemorySource(files);
  // Источник проекта — локальный каталог, ему исполнение кода разрешено (см. `loader.test`).
  const source: Source = {
    ...memory,
    capabilities: { ...memory.capabilities, executesCode: true },
  };
  const extensions = createExtensionRegistry();
  const plugins = createPluginRegistry({
    services: createServiceRegistry(),
    extensions,
    commands: createCommandRegistry(),
    events: createEventBus(),
    storage: createMemoryStorageBackend(),
    onError: vi.fn(),
  });
  const problems = vi.fn();
  const catalog = createProjectPluginCatalog({
    loader: createPluginLoader({
      source: () => source,
      // Тот же набор имён, что композиция кладёт плагину. Если бы точка приехала сюда
      // копией, вклад ушёл бы в двойника и этот тест бы это увидел.
      modules: createModuleLoader({
        builtins: [['@builder/sdk', { definePlugin, CatalogPluginSettingsPoint }]],
      }),
    }),
    plugins,
    onProblem: problems,
  });

  /** То же чтение, что делает композиция в `boot`. */
  const schemaOf = (pluginId: string): unknown => {
    const found = extensions
      .get(CatalogPluginSettingsPoint)
      .find(({ pluginId: owner, value }) => owner === pluginId && value.pluginId === pluginId);
    return found === undefined ? null : asFormSchema(found.value.schema);
  };

  return { catalog, extensions, schemaOf, problems };
}

describe('настройки плагина каталога: от вклада до раздела', () => {
  it('включённый плагин отдаёт композиции пригодную схему', async () => {
    const h = harness({
      [dir('acme', 'manifest.json')]: manifest('acme'),
      [dir('acme', 'main.js')]: PLUGIN_SOURCE,
    });
    await h.catalog.refresh();

    await h.catalog.enable('acme');

    const schema = h.schemaOf('acme') as { root: { children: unknown[] } } | null;
    expect(schema).not.toBeNull();
    expect(schema?.root.children).toHaveLength(2);
  });

  it('выключение убирает настройки вместе с плагином', async () => {
    // Вклад лежит в `ctx.subscriptions`, поэтому снимается сам. Если бы не снимался, карточка
    // предлагала бы настроить плагин, чей код уже не исполняется.
    const h = harness({
      [dir('acme', 'manifest.json')]: manifest('acme'),
      [dir('acme', 'main.js')]: PLUGIN_SOURCE,
    });
    await h.catalog.refresh();
    await h.catalog.enable('acme');

    h.catalog.disable('acme');

    expect(h.schemaOf('acme')).toBeNull();
  });

  it('чужой вклад не настраивает соседа', async () => {
    // `pluginId` вклада проставляет реестр, а не вносящий, и сверка с полем — это и есть запрет.
    const h = harness({
      [dir('acme', 'manifest.json')]: manifest('acme'),
      [dir('acme', 'main.js')]: PLUGIN_SOURCE.replace('pluginId: ctx.id', "pluginId: 'victim'"),
    });
    await h.catalog.refresh();
    await h.catalog.enable('acme');

    expect(h.schemaOf('victim')).toBeNull();
    expect(h.schemaOf('acme')).toBeNull();
  });

  it('не объявивший настройки не получает их места в карточке', async () => {
    const h = harness({
      [dir('quiet', 'manifest.json')]: manifest('quiet'),
      [dir('quiet', 'main.js')]:
        "import { definePlugin } from '@builder/sdk';\nexport default definePlugin({ id: 'quiet', activate() {} });\n",
    });
    await h.catalog.refresh();
    await h.catalog.enable('quiet');

    expect(h.schemaOf('quiet')).toBeNull();
  });
});
