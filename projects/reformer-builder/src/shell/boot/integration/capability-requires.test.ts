/**
 * Плагин каталога объявляет, что ему нужно, — и это проверяется ДО его кода.
 *
 * Это приёмка фазы 3 плана `docs/plans/builder-v4-plugin-platform-plan.md`, и проверяет она
 * ЦЕПОЧКУ, а не отдельный шов: возможность объявлена плагином китов и попала в состав
 * приложения (`application/composer/builtin-plugins`), состав отдал её объявление каталогу,
 * каталог сверил с ним `requires` манифеста, и внешний плагин либо поднялся, либо получил
 * строку с причиной. Ни одно звено в одиночку этого не показывает: разбор манифеста ничего
 * не знает о составе, резолвер — о загрузчике, а каталог — о том, откуда взялась версия.
 *
 * ## Что здесь НАСТОЯЩЕЕ
 *
 * Реестр модулей с подлинным `@reformer/builder-plugin-api` (внешний плагин объявляет свою `defineCapability`
 * ровно тем же значением, каким пользуется встроенный), загрузчик, каталог, рантайм плагинов,
 * служба локализации, плагин китов целиком и список возможностей из НАСТОЯЩЕГО состава
 * приложения — `builderApplication.capabilities`, а не выдуманная пара «идентификатор,
 * версия». Подменены только источник (память вместо File System Access) и каталог кита
 * (крошечный вместо 864 кБ встроенного: проверяется версия контракта, а не его содержимое).
 *
 * @module shell/boot/integration/capability-requires.test
 */

import { describe, expect, it, vi } from 'vitest';

import { builderApplication } from '@/application/builder-application';
import type { CatalogJson } from '@/plugins/reformer/core/catalog';
import { createKitsPlugin, KITS_PLUGIN_ID } from '@/plugins/kits/registry';
import { createProjectPluginCatalog } from '@/shell/platform/plugin/catalog';
import { createPluginLoader } from '@/shell/platform/plugin/loader';
import { KitsCapability, PLUGIN_CATALOG_DIR } from '@reformer/builder-plugin-api/internal';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createMemorySource } from '@/shell/platform/source/memory';
import type { Source } from '@/shell/platform/source/types';
import { createPluginModules } from '@/shell/boot/plugin-modules';

const dir = (file: string): string => `${PLUGIN_CATALOG_DIR}/ext/${file}`;

/**
 * Код внешнего плагина — обычный JavaScript, как у собранного плагина из npm.
 *
 * `defineCapability` он берёт из `@builder/sdk`: без этого имени объявить требование
 * средствами SDK было бы нечем, и версионирование существовало бы только для встроенных —
 * ровно наоборот к тому, зачем оно заводилось. Токен, который он строит, — СВОЙ объект
 * с тем же идентификатором; находит он им ту же службу, потому что реестр ключуется строкой.
 */
const PLUGIN_CODE = `
const { definePlugin, defineCapability } = require('@builder/sdk');

const Kits = defineCapability({ id: 'reformer.kit.catalog', version: '2.0.0' });

module.exports = definePlugin({
  id: 'ext',
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.commands.register({
        id: 'ext.kit',
        titleKey: 'command.kit',
        run: () => ctx.capabilities.require(Kits).activeId(),
      })
    );
  },
});
`;

/** Требование к возможности: идентификатор плюс диапазон — форма поля `requires` манифеста. */
interface Requirement {
  readonly id: string;
  readonly range: string;
}

const manifest = (range: string, extra: readonly Requirement[] = []): string =>
  JSON.stringify({
    id: 'ext',
    name: 'External Kit Reader',
    version: '1.0.0',
    apiVersion: '^1',
    main: 'main.js',
    requires: { required: [{ id: 'reformer.kit.catalog', range }, ...extra] },
  });

/** Крошечный кит: проверяется версия контракта службы, а не содержимое каталога. */
const KIT_CATALOG: CatalogJson = {
  version: '2.0',
  kit: { id: 'kit-a', label: 'Кит А', package: '@vendor/kit-a', version: '1.2.3' },
  components: [{ name: 'Alpha', role: 'field', propsSchema: { type: 'object' } }],
};

function harness(range: string, extra: readonly Requirement[] = []) {
  const memory = createMemorySource({
    [dir('manifest.json')]: manifest(range, extra),
    [dir('main.js')]: PLUGIN_CODE,
  });
  // Каталог проекта — локальный диск, ему исполнение своего кода разрешено. Ветка запрета
  // проверяется у загрузчика отдельно и подразумеваться здесь не должна.
  const source: Source = {
    ...memory,
    capabilities: { ...memory.capabilities, executesCode: true },
  };

  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  const commands = createCommandRegistry();
  const events = createEventBus();

  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    storage: createMemoryStorageBackend(),
  });

  // Провайдер поднимается ПО-НАСТОЯЩЕМУ и с тем же объявлением, что в карте состава: иначе
  // проверялась бы декларация против декларации, а не против реестра служб.
  plugins.register(createKitsPlugin({ sources: [{ catalog: KIT_CATALOG }] }), [KitsCapability]);
  plugins.activate(KITS_PLUGIN_ID);

  const pluginModules = createPluginModules();
  const i18n = createI18nService({ dev: true, loadHostMessages: () => Promise.resolve({}) });
  const onProblem = vi.fn();

  const catalog = createProjectPluginCatalog({
    loader: createPluginLoader({
      source: () => source,
      modules: pluginModules.modules,
      prepare: pluginModules.prepare,
    }),
    plugins,
    // То, что объявляет НАСТОЯЩИЙ состав приложения. Подставь сюда выдуманную пару —
    // и тест перестал бы отвечать на вопрос «объявлена ли возможность китов в билдере».
    capabilities: () => builderApplication.capabilities,
    i18n,
    onProblem,
  });

  return {
    catalog,
    commands,
    services,
    onProblem,
    dispose: () => {
      catalog.dispose();
      plugins.deactivateAll();
      pluginModules.dispose();
    },
  };
}

describe('внешний плагин с требованием к возможности', () => {
  it('состав приложения объявляет возможность китов — без этого проверять нечего', () => {
    expect(builderApplication.capabilities).toContainEqual({
      id: 'reformer.kit.catalog',
      version: '2.0.0',
      by: KITS_PLUGIN_ID,
    });
  });

  it('требование «^3» при провайдере 2.x — плагин НЕ включается', async () => {
    const h = harness('^3');
    await h.catalog.refresh();

    expect(await h.catalog.enable('ext')).toBe(false);
    // Код плагина не исполнялся: команда не появилась вовсе.
    expect(h.commands.getAll().map((entry) => entry.id)).not.toContain('ext.kit');
    h.dispose();
  });

  it('причина видна СТРОКОЙ в списке плагинов и называет то, что есть', async () => {
    const h = harness('^3');
    await h.catalog.refresh();
    await h.catalog.enable('ext');

    const entry = h.catalog.list().find((item) => item.id === 'ext');

    expect(entry?.state).toBe('failed');
    expect(entry?.problem?.code).toBe('requires-unsatisfied');
    expect(entry?.problem?.message).toContain('reformer.kit.catalog');
    expect(entry?.problem?.message).toContain('^3');
    // «Поставь новее» и «поставь вообще» — разные ответы, и человеку нужен второй.
    expect(entry?.problem?.message).toContain('2.0.0');
    expect(entry?.problem?.message).toContain(`«${KITS_PLUGIN_ID}»`);
    h.dispose();
  });

  it('требование к возможности ОБОЛОЧКИ выполняется: её объявляет не плагин', async () => {
    // Рабочую область, фокус текстового редактора и снимки вида даёт сама оболочка, и без
    // части «builder.host» в составе (`composer/compose`) это требование выглядело бы как
    // «никто не предоставляет» — у службы, которая заведена ровно для внешнего плагина.
    const h = harness('^2', [{ id: 'reformer.workspace', range: '^1' }]);
    await h.catalog.refresh();

    expect(await h.catalog.enable('ext')).toBe(true);
    h.dispose();
  });

  it('несовпадение версии возможности оболочки отказывает и называет оболочку', async () => {
    const h = harness('^2', [{ id: 'reformer.workspace', range: '^2' }]);
    await h.catalog.refresh();
    await h.catalog.enable('ext');

    const entry = h.catalog.list().find((item) => item.id === 'ext');
    expect(entry?.state).toBe('failed');
    expect(entry?.problem?.message).toContain('reformer.workspace');
    expect(entry?.problem?.message).toContain('«builder.host»');
    h.dispose();
  });

  it('тот же плагин с «^2» включается и работает', async () => {
    const h = harness('^2');
    await h.catalog.refresh();

    expect(await h.catalog.enable('ext')).toBe(true);
    expect(h.catalog.list().find((item) => item.id === 'ext')?.state).toBe('enabled');
    // «Работает» — это не «числится включённым»: его команда достаёт службу через
    // `ctx.capabilities` и отвечает тем, что знает провайдер.
    await expect(h.commands.execute('ext.kit')).resolves.toBe('kit-a');
    expect(h.onProblem).not.toHaveBeenCalled();
    h.dispose();
  });
});
