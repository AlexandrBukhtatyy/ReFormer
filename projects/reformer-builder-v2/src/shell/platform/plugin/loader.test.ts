import { describe, expect, it, vi } from 'vitest';

import * as sdkModule from '@/sdk';
import { createModuleLoader, type ModuleLoader } from '../modules/loader';
import { ModuleRegistryError } from '../modules/registry';
import { createMemorySource, type MemorySource } from '../source/memory';
import type { Source } from '../source/types';
import { createPluginLoader, PLUGIN_CATALOG_DIR, type PluginLoader } from './loader';
import { createTypeScriptSupport, type TypeScriptEngine } from './typescript-transpiler';
import type { Plugin } from './types';

/**
 * Источник проекта, которому разрешено исполнять свой код.
 *
 * Двойник объявляет `executesCode: false` — умолчание для всего, что не локальный диск, —
 * и это правильное умолчание, но тогда им нельзя проверить ни одну ветку загрузки. Поэтому
 * здесь возможность поднимается явно: ветка запрета проверяется отдельным тестом на голом
 * двойнике, а не подразумевается.
 */
function projectSource(files: Record<string, string>): { source: Source; memory: MemorySource } {
  const memory = createMemorySource(files);
  const source: Source = {
    ...memory,
    capabilities: { ...memory.capabilities, executesCode: true },
  };
  return { source, memory };
}

const manifestOf = (fields: Record<string, unknown>): string =>
  JSON.stringify({ apiVersion: '^1', main: 'main.js', ...fields });

/** Плагин-заглушка: минимум, который загрузчик обязан признать плагином. */
const pluginCode = (id: string): string =>
  `module.exports = { id: ${JSON.stringify(id)}, activate() {} };`;

interface Harness {
  readonly loader: PluginLoader;
  readonly modules: ModuleLoader;
  readonly memory: MemorySource;
}

/** Загрузчик над двойником источника. `sdk` — то, что окажется под именем `@builder/sdk`. */
function createHarness(files: Record<string, string>, sdk: unknown = sdkModule): Harness {
  const { source, memory } = projectSource(files);
  const modules = createModuleLoader({ builtins: [['@builder/sdk', sdk]] });
  const loader = createPluginLoader({ source: () => source, modules });
  return { loader, modules, memory };
}

const dir = (id: string, file: string): string => `${PLUGIN_CATALOG_DIR}/${id}/${file}`;

describe('обнаружение плагинов', () => {
  it('находит каталоги и разбирает их манифесты', async () => {
    const { loader } = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({
        id: 'acme-forms',
        name: 'Acme Forms',
        version: '2.1.0',
      }),
      [dir('acme-forms', 'main.js')]: pluginCode('acme-forms'),
      [dir('zeta', 'manifest.json')]: manifestOf({ id: 'zeta' }),
      [dir('zeta', 'main.js')]: pluginCode('zeta'),
    });

    const found = await loader.discover();

    expect(found.map((f) => f.id)).toEqual(['acme-forms', 'zeta']);
    expect(found[0].manifest?.name).toBe('Acme Forms');
    expect(found[0].dir).toBe(`${PLUGIN_CATALOG_DIR}/acme-forms`);
    expect(found[0].problem).toBeUndefined();
  });

  it('код при обнаружении не исполняется', async () => {
    const { loader } = createHarness({
      [dir('boom', 'manifest.json')]: manifestOf({ id: 'boom' }),
      [dir('boom', 'main.js')]: 'throw new Error("плагин исполнился при обнаружении");',
    });

    await expect(loader.discover()).resolves.toHaveLength(1);
  });

  it('нет проекта или нет каталога — пустой список, а не отказ', async () => {
    const withoutProject = createPluginLoader({
      source: () => null,
      modules: createModuleLoader(),
    });
    const { loader } = createHarness({ 'src/form.ts': 'export const a = 1;' });

    await expect(withoutProject.discover()).resolves.toEqual([]);
    await expect(loader.discover()).resolves.toEqual([]);
  });

  it('битый плагин виден строкой с причиной, а не исчезает', async () => {
    const { loader } = createHarness({
      [dir('broken-json', 'manifest.json')]: '{ "id": "broken-json"',
      [dir('no-manifest', 'main.js')]: pluginCode('no-manifest'),
      [dir('from-future', 'manifest.json')]: manifestOf({ id: 'from-future', apiVersion: '^2' }),
      [dir('renamed', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
    });

    const problems = new Map(
      (await loader.discover()).map((found) => [found.id, found.problem?.code])
    );

    // Каталог правит человек руками, поэтому испорченный манифест — обычное состояние,
    // а не авария: каждый такой случай обязан доехать до списка со своей причиной.
    expect(problems.get('broken-json')).toBe('manifest-unreadable');
    expect(problems.get('no-manifest')).toBe('manifest-missing');
    expect(problems.get('from-future')).toBe('api-version');
    expect(problems.get('renamed')).toBe('id-mismatch');
  });

  it('файл рядом с плагинами плагином не считается', async () => {
    const { loader } = createHarness({
      [`${PLUGIN_CATALOG_DIR}/README.md`]: '# как писать плагины',
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
    });

    expect((await loader.discover()).map((f) => f.id)).toEqual(['acme-forms']);
  });
});

describe('загрузка кода плагина', () => {
  const load = async (harness: Harness, id = 'acme-forms') => {
    const found = (await harness.loader.discover()).find((f) => f.id === id);
    expect(found, `плагин «${id}» не найден`).toBeDefined();
    return harness.loader.load(found!);
  };

  it('поднимает плагин и подставляет ему @builder/sdk оболочки', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: `
        const { definePlugin } = require('@builder/sdk');
        module.exports = definePlugin({ id: 'acme-forms', activate() {} });
      `,
    });

    const result = await load(harness);

    expect(result.ok).toBe(true);
    // `definePlugin` замораживает результат — значит выполнилась ИМЕННО функция оболочки,
    // а не что-то похожее по имени.
    expect(result.ok && Object.isFrozen(result.loaded.plugin)).toBe(true);
    expect(result.ok && result.loaded.plugin.id).toBe('acme-forms');
  });

  it('подставляется тот же объект, что видит оболочка', async () => {
    const sdk = { definePlugin: (p: Plugin): Plugin => p };
    const harness = createHarness(
      {
        [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
        [dir('acme-forms', 'main.js')]: `
          const sdk = require('@builder/sdk');
          module.exports = { id: 'acme-forms', activate() {}, sdk };
        `,
      },
      sdk
    );

    const result = await load(harness);

    // Идентичность, а не структурное сходство: второй экземпляр SDK означал бы плагин,
    // который регистрирует вклады в чужой пустой реестр и молча ничего не делает.
    expect(result.ok && (result.loaded.plugin as unknown as { sdk: unknown }).sdk).toBe(sdk);
  });

  it('свой файл с именем защищённого модуля ничего не подменяет', async () => {
    const sdk = { definePlugin: (p: Plugin): Plugin => p, real: true };
    const harness = createHarness(
      {
        [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
        // Плагин кладёт рядом собственный «@builder/sdk».
        [dir('acme-forms', '@builder/sdk.js')]: 'module.exports = { real: false, evil: true };',
        [dir('acme-forms', 'main.js')]: `
          const sdk = require('@builder/sdk');
          module.exports = { id: 'acme-forms', activate() {}, sdk };
        `,
      },
      sdk
    );

    const result = await load(harness);

    // Bare-спецификатор уходит только в реестр модулей — по путям он не резолвится вообще,
    // поэтому файл плагина с таким именем остаётся просто файлом.
    expect(result.ok && (result.loaded.plugin as unknown as { sdk: unknown }).sdk).toBe(sdk);
  });

  it('защищённый спецификатор нельзя занять через реестр загрузчика', () => {
    const harness = createHarness({});

    for (const specifier of ['@builder/sdk', 'react', '@reformer/core', '@reformer/core/x']) {
      const attempt = (): unknown => harness.modules.registry.register(specifier, { evil: true });

      expect(attempt, specifier).toThrow(ModuleRegistryError);
      try {
        attempt();
      } catch (error) {
        expect((error as ModuleRegistryError).reason, specifier).toBe('protected');
      }
    }
    // Слот остался за оболочкой: после отказа плагин по-прежнему получает её объект.
    expect(harness.modules.registry.resolve('@builder/sdk', 'main.js')).toBe(sdkModule);
  });

  it('видит относительные импорты внутри каталога плагина', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: `
        const { title } = require('./panel');
        module.exports = { id: 'acme-forms', activate() {}, title };
      `,
      [dir('acme-forms', 'panel.js')]: `exports.title = 'панель Acme';`,
    });

    const result = await load(harness);

    expect(result.ok && (result.loaded.plugin as unknown as { title: string }).title).toBe(
      'панель Acme'
    );
    expect(result.ok && result.loaded.files).toEqual(['main.js', 'panel.js']);
  });
});

describe('загрузка отказывает', () => {
  const loadFirst = async (harness: Harness) => {
    const found = await harness.loader.discover();
    return harness.loader.load(found[0]);
  };

  it('когда точки входа нет среди файлов', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms', main: 'dist/main.js' }),
      [dir('acme-forms', 'main.js')]: pluginCode('acme-forms'),
    });

    const result = await loadFirst(harness);

    expect(!result.ok && result.problem.code).toBe('entry-missing');
  });

  it('когда код бросил при исполнении', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: 'throw new Error("плагин не собрался");',
    });

    const result = await loadFirst(harness);

    expect(!result.ok && result.problem.code).toBe('code-failed');
    expect(!result.ok && result.problem.message).toContain('плагин не собрался');
    expect(!result.ok && result.problem.file).toBe('main.js');
  });

  it('когда точка входа экспортировала не плагин', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: 'module.exports = { hello: 1 };',
    });

    const result = await loadFirst(harness);

    expect(!result.ok && result.problem.code).toBe('not-a-plugin');
  });

  it('когда код и манифест объявляют разные идентификаторы', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: pluginCode('acme-forms-dev'),
    });

    const result = await loadFirst(harness);

    expect(!result.ok && result.problem.code).toBe('id-mismatch');
  });

  it('когда источник не разрешает исполнять свой код', async () => {
    // Голый двойник: `executesCode: false` — умолчание для всего, что приехало не с диска.
    const source = createMemorySource({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: pluginCode('acme-forms'),
    });
    const loader = createPluginLoader({
      source: () => source,
      modules: createModuleLoader({ builtins: [['@builder/sdk', sdkModule]] }),
    });

    const found = await loader.discover();
    const result = await loader.load(found[0]);

    // Обнаружение при этом работает: показать плагин можно, исполнить — нет.
    expect(found[0].manifest?.id).toBe('acme-forms');
    expect(!result.ok && result.problem.code).toBe('source-forbids-code');
  });

  it('когда в каталоге плагина слишком много файлов', async () => {
    const { source } = projectSource({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: pluginCode('acme-forms'),
      [dir('acme-forms', 'a.js')]: 'exports.a = 1;',
      [dir('acme-forms', 'b.js')]: 'exports.b = 1;',
    });
    const loader = createPluginLoader({
      source: () => source,
      modules: createModuleLoader(),
      fileLimit: 2,
    });

    const result = await loader.load((await loader.discover())[0]);

    // Отказ, а не усечение: молча недочитанный плагин ломался бы на первом же импорте
    // «необъяснимо», и чинить это пришлось бы гаданием.
    expect(!result.ok && result.problem.code).toBe('too-many-files');
  });
});

describe('транспиляция на лету', () => {
  it('главный файл на TypeScript компилируется настоящим движком', async () => {
    const { source } = projectSource({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms', main: 'main.ts' }),
      [dir('acme-forms', 'main.ts')]: `
        import { definePlugin, type PluginContext } from '@builder/sdk';

        interface Options { readonly label: string }
        const options: Options = { label: 'панель Acme' };

        export default definePlugin({
          id: 'acme-forms',
          activate(ctx: PluginContext): void {
            void ctx;
            void options;
          },
        });
      `,
    });
    const modules = createModuleLoader({ builtins: [['@builder/sdk', sdkModule]] });
    const support = createTypeScriptSupport(modules.transpilers);
    const loader = createPluginLoader({
      source: () => source,
      modules,
      prepare: (files) => support.ensure(files),
    });

    const result = await loader.load((await loader.discover())[0]);

    // `export default` после транспиляции — это `exports.default`, и загрузчик обязан
    // признать обе формы: собранный `main.js` кладёт плагин прямо в `module.exports`.
    expect(result.ok && result.loaded.plugin.id).toBe('acme-forms');
    expect(modules.transpilers.list().map((t) => t.id)).toEqual(['typescript']);
    support.dispose();
  });

  it('манифест зовёт main.js, а рядом лежит main.ts — грузится он', async () => {
    // Ровно то, что контракт называет разработкой в каталоге: плагин распространяется
    // собранным, а автор правит исходник рядом, не трогая манифест.
    const { source } = projectSource({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms', main: 'main.js' }),
      [dir('acme-forms', 'main.ts')]: `
        export default { id: 'acme-forms', activate(): void {} };
      `,
    });
    const modules = createModuleLoader({ builtins: [['@builder/sdk', sdkModule]] });
    const support = createTypeScriptSupport(modules.transpilers);
    const loader = createPluginLoader({
      source: () => source,
      modules,
      prepare: (files) => support.ensure(files),
    });

    const result = await loader.load((await loader.discover())[0]);

    expect(result.ok && result.loaded.plugin.id).toBe('acme-forms');
    support.dispose();
  });

  it('плагину из собранного JS движок не грузится вовсе', async () => {
    const { source } = projectSource({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: pluginCode('acme-forms'),
    });
    const modules = createModuleLoader({ builtins: [['@builder/sdk', sdkModule]] });
    const load = vi.fn<() => Promise<TypeScriptEngine>>();
    const support = createTypeScriptSupport(modules.transpilers, { load });
    const loader = createPluginLoader({
      source: () => source,
      modules,
      prepare: (files) => support.ensure(files),
    });

    const result = await loader.load((await loader.discover())[0]);

    expect(result.ok).toBe(true);
    // Семь мегабайт компилятора ради плагина без единого `.ts` — цена, которую платят все,
    // включая тех, кто плагинов не включал вовсе.
    expect(load).not.toHaveBeenCalled();
  });

  it('ошибка синтаксиса в TypeScript доезжает как отказ загрузки', async () => {
    const { source } = projectSource({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms', main: 'main.ts' }),
      [dir('acme-forms', 'main.ts')]: 'export default { id: "acme-forms", activate(): void {',
    });
    const modules = createModuleLoader({ builtins: [['@builder/sdk', sdkModule]] });
    const support = createTypeScriptSupport(modules.transpilers);
    const loader = createPluginLoader({
      source: () => source,
      modules,
      prepare: (files) => support.ensure(files),
    });

    const result = await loader.load((await loader.discover())[0]);

    expect(!result.ok && result.problem.code).toBe('code-failed');
    expect(!result.ok && result.problem.file).toBe('main.ts');
    support.dispose();
  });
});
