import { describe, expect, it, vi } from 'vitest';

import * as sdkModule from '@reformer/builder-plugin-api';
import { createModuleLoader, type ModuleLoader } from '@/shell/platform/modules/loader';
import {
  createModuleRegistry,
  lazyBuiltin,
  ModuleRegistryError,
} from '@/shell/platform/modules/registry';
import { collectBareSpecifiers } from '@/shell/platform/modules/specifiers';
import { createMemorySource, type MemorySource } from '@/shell/platform/source/memory';
import { SourceError } from '@/shell/platform/source/errors';
import type { Source } from '@/shell/platform/source/types';
import { createPluginLoader, type PluginLoader } from './loader';
import { PLUGIN_CATALOG_DIR } from '@reformer/builder-plugin-api/internal';
import { createTypeScriptSupport, type TypeScriptEngine } from './typescript-transpiler';
import type { Plugin } from '@reformer/builder-plugin-api/internal';

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

describe('каталог домена', () => {
  it('плагины лежат уровнем ниже, идентификатор — из манифеста, ядро плагином не считается', async () => {
    const { loader } = createHarness({
      [dir('acme', 'core/index.js')]: 'exports.shared = 1;',
      [dir('acme', 'editor/manifest.json')]: manifestOf({ id: 'acme.forms.editor' }),
      [dir('acme', 'editor/main.js')]: pluginCode('acme.forms.editor'),
      [dir('acme', 'render/manifest.json')]: manifestOf({ id: 'acme.forms.render' }),
      [dir('acme', 'render/main.js')]: pluginCode('acme.forms.render'),
      [dir('zeta', 'manifest.json')]: manifestOf({ id: 'zeta' }),
    });

    const found = await loader.discover();

    expect(found.map((f) => [f.id, f.dir, f.problem?.code])).toEqual([
      ['acme.forms.editor', `${PLUGIN_CATALOG_DIR}/acme/editor`, undefined],
      ['acme.forms.render', `${PLUGIN_CATALOG_DIR}/acme/render`, undefined],
      ['zeta', `${PLUGIN_CATALOG_DIR}/zeta`, undefined],
    ]);
    expect(found[0].manifest?.source).toEqual({ kind: 'project', dir: 'editor', group: 'acme' });

    const result = await loader.load(found[0]);
    expect(result.ok && result.loaded.plugin.id).toBe('acme.forms.editor');
  });

  it('несобранный плагин домена виден строкой с причиной, под идентификатором из исходников', async () => {
    const { loader } = createHarness({
      [dir('acme', 'editor/manifest.json')]: manifestOf({ id: 'acme.forms.editor' }),
      [dir('acme', 'render/package.json')]: '{}',
      [dir('acme', 'render/src/manifest.json')]: manifestOf({ id: 'acme.forms.render' }),
    });

    const found = await loader.discover();

    expect(found.map((f) => [f.id, f.problem?.code])).toEqual([
      ['acme.forms.editor', undefined],
      ['acme.forms.render', 'manifest-missing'],
    ]);
    expect(found[1].problem?.message).toContain('acme/render');
  });

  it('пакет плагина без сборки — не домен: из исходников он не поднимается', async () => {
    const { loader } = createHarness({
      [dir('acme-forms', 'package.json')]: '{}',
      [dir('acme-forms', 'src/manifest.json')]: manifestOf({ id: 'acme-forms', main: 'main.ts' }),
      [dir('acme-forms', 'src/main.ts')]: 'export default { id: "acme-forms", activate() {} };',
      [dir('acme-forms', 'dist/manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'dist/main.js')]: pluginCode('acme-forms'),
    });

    const found = await loader.discover();

    expect(found.map((f) => [f.id, f.problem?.code])).toEqual([['acme-forms', 'manifest-missing']]);
  });

  it('второй каталог с тем же идентификатором — отказ, рабочий плагин он не затирает', async () => {
    const { loader } = createHarness({
      [dir('acme', 'editor/manifest.json')]: manifestOf({ id: 'zeta' }),
      [dir('zeta', 'manifest.json')]: manifestOf({ id: 'zeta' }),
    });

    const found = await loader.discover();

    // Спор выигрывает плагин верхнего уровня: его идентификатор — имя его каталога.
    expect(found.map((f) => [f.id, f.problem?.code])).toEqual([
      ['acme/editor', 'id-taken'],
      ['zeta', undefined],
    ]);
    expect(found[0].problem?.message).toContain(`${PLUGIN_CATALOG_DIR}/zeta`);
  });
});

describe('пакет, собранный на месте', () => {
  it('исходники и сборка для поставки лежат рядом, но в набор файлов не идут', async () => {
    const { loader } = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: pluginCode('acme-forms'),
      [dir('acme-forms', 'src/manifest.json')]: manifestOf({ id: 'acme-forms', main: 'main.ts' }),
      [dir('acme-forms', 'src/main.ts')]: 'export default { id: "acme-forms", activate() {} };',
      [dir('acme-forms', 'src/ui/view.tsx')]: 'export const View = () => null;',
      [dir('acme-forms', 'dist/manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'dist/main.js')]: pluginCode('acme-forms'),
    });

    const result = await loader.load((await loader.discover())[0]);

    expect(result.ok && result.loaded.files).toEqual(['main.js']);
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

  it('модуль данных из chunks/ исполняется при первом обращении, а не при загрузке', async () => {
    // Так `reformer-plugin build` собирает отложенный импорт JSON: данные — отдельным файлом,
    // в `main.js` — `require` внутри функции. Загрузка плагина модуль данных не трогает:
    // ради этого корпус знаний ассистента и вынесен из `main.js`.
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: `
        module.exports = {
          id: 'acme-forms',
          activate() {},
          loadCorpus: () => Promise.resolve().then(() => require('./chunks/corpus.js')),
        };
      `,
      [dir('acme-forms', 'chunks/corpus.js')]: `
        globalThis.__acmeCorpusEvaluated = (globalThis.__acmeCorpusEvaluated ?? 0) + 1;
        module.exports = { title: 'Справка' };
      `,
    });
    const counter = globalThis as unknown as { __acmeCorpusEvaluated?: number };
    delete counter.__acmeCorpusEvaluated;

    const result = await load(harness);

    expect(result.ok && result.loaded.files).toEqual(['main.js', 'chunks/corpus.js']);
    expect(counter.__acmeCorpusEvaluated).toBeUndefined();

    const plugin = (result.ok ? result.loaded.plugin : undefined) as unknown as {
      loadCorpus: () => Promise<{ title: string }>;
    };
    expect((await plugin.loadCorpus()).title).toBe('Справка');
    // Второе обращение берёт уже исполненный модуль.
    await plugin.loadCorpus();
    expect(counter.__acmeCorpusEvaluated).toBe(1);
    delete counter.__acmeCorpusEvaluated;
  });
});

/**
 * Ленивый модуль оболочки в коде плагина.
 *
 * Реестр отдаёт ленивый модуль синхронно только после прогрева, а `require` исполняется синхронно.
 * Кит-плагин упирается в это первым: его обёртка поля стоит на `@reformer/cdk/form-field`, а cdk
 * в реестре оболочки — ленивый. Без прогрева загрузка такого плагина падала «cold», хотя модуль
 * оболочке известен.
 */
describe('ленивые модули оболочки', () => {
  const files = {
    [dir('acme-kit', 'manifest.json')]: manifestOf({ id: 'acme-kit' }),
    [dir('acme-kit', 'main.js')]: `
      const { marker } = require('acme-shared/lazy');
      module.exports = { id: 'acme-kit', marker, activate() {} };
    `,
  };

  function harness(withWarm: boolean): Harness {
    const { source, memory } = projectSource(files);
    const registry = createModuleRegistry([
      ['acme-shared/lazy', lazyBuiltin(() => Promise.resolve({ marker: 'прогрет' }))],
    ]);
    const modules = createModuleLoader({ registry });
    const loader = createPluginLoader({
      source: () => source,
      modules,
      ...(withWarm ? { warm: (all) => registry.warm(collectBareSpecifiers(all)) } : {}),
    });
    return { loader, modules, memory };
  }

  const load = async (h: Harness) => {
    const found = (await h.loader.discover()).find((f) => f.id === 'acme-kit');
    expect(found).toBeDefined();
    return h.loader.load(found!);
  };

  it('с прогревом верхнеуровневый require ленивого модуля проходит', async () => {
    const result = await load(harness(true));
    expect(result.ok).toBe(true);
    expect(result.ok && (result.loaded.plugin as unknown as { marker: string }).marker).toBe(
      'прогрет'
    );
  });

  it('без прогрева тот же плагин отказывает «cold» — ради этого прогрев и заведён', async () => {
    const result = await load(harness(false));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem.code).toBe('code-failed');
    expect(!result.ok && result.problem.message).toMatch(/cold|прогрет/);
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

describe('словари плагина', () => {
  const loadFirst = async (harness: Harness) => {
    const found = await harness.loader.discover();
    return harness.loader.load(found[0]);
  };

  const withMessages = (
    messages: Record<string, string>,
    files: Record<string, string> = {}
  ): Record<string, string> => ({
    [dir('acme-forms', 'manifest.json')]: manifestOf({
      id: 'acme-forms',
      contributes: { messages },
    }),
    [dir('acme-forms', 'main.js')]: pluginCode('acme-forms'),
    ...files,
  });

  it('читает объявленные файлы, но в набор файлов кода они не попадают', async () => {
    const harness = createHarness(
      withMessages(
        { ru: 'locales/ru.json', en: 'locales/en.json' },
        {
          [dir('acme-forms', 'locales/ru.json')]: JSON.stringify({
            'command.format': 'Форматировать',
          }),
          [dir('acme-forms', 'locales/en.json')]: JSON.stringify({ 'command.format': 'Format' }),
        }
      )
    );

    const result = await loadFirst(harness);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.loaded.messages).toEqual({
      ru: { 'command.format': 'Форматировать' },
      en: { 'command.format': 'Format' },
    });
    // `.json` — не файл кода: линковщику он не отдаётся, и потолок `PLUGIN_FILE_LIMIT`
    // чтением словарей не двигается.
    expect(result.loaded.files).toEqual(['main.js']);
  });

  it('плагин без словарей их и не получает', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf({ id: 'acme-forms' }),
      [dir('acme-forms', 'main.js')]: pluginCode('acme-forms'),
    });

    const result = await loadFirst(harness);

    expect(result.ok && result.loaded.messages).toBeUndefined();
  });

  it('объявленного файла нет — отказ называет файл', async () => {
    const harness = createHarness(withMessages({ ru: 'locales/ru.json' }));

    const result = await loadFirst(harness);

    expect(!result.ok && result.problem.code).toBe('messages-invalid');
    expect(!result.ok && result.problem.file).toBe('locales/ru.json');
    expect(!result.ok && result.problem.message).toContain('ru');
  });

  it('словарь не разбирается как JSON — отказ', async () => {
    const harness = createHarness(
      withMessages(
        { ru: 'locales/ru.json' },
        { [dir('acme-forms', 'locales/ru.json')]: '{ "command.format": "Формат"' }
      )
    );

    const result = await loadFirst(harness);

    expect(!result.ok && result.problem.code).toBe('messages-invalid');
    expect(!result.ok && result.problem.file).toBe('locales/ru.json');
  });

  it('словарь не плоский «ключ → строка» — отказ', async () => {
    // Вложенность не разворачивается сознательно: ключ и так составной, и второй способ
    // записать тот же ключ дал бы словарь, в котором промах ищется в двух местах.
    for (const text of [
      JSON.stringify({ command: { format: 'Форматировать' } }),
      JSON.stringify({ 'command.format': 42 }),
      JSON.stringify(['Форматировать']),
    ]) {
      const harness = createHarness(
        withMessages({ ru: 'locales/ru.json' }, { [dir('acme-forms', 'locales/ru.json')]: text })
      );

      const result = await loadFirst(harness);

      expect(result.ok, text).toBe(false);
      expect(!result.ok && result.problem.code).toBe('messages-invalid');
    }
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

describe('предзагрузка: чтение заранее, исполнение — потом', () => {
  /** Источник со счётчиком чтений по пути: предзагрузка обязана не читать дважды. */
  function countingSource(files: Record<string, string>): {
    source: Source;
    reads: Map<string, number>;
  } {
    const { source: inner } = projectSource(files);
    const reads = new Map<string, number>();
    const source: Source = {
      ...inner,
      read: (path) => {
        reads.set(path, (reads.get(path) ?? 0) + 1);
        return inner.read(path);
      },
    };
    return { source, reads };
  }

  const FILES = {
    [dir('acme', 'manifest.json')]: manifestOf({
      id: 'acme',
      styles: { file: 'styles.css' },
      contributes: { messages: { ru: 'locales/ru.json' } },
    }),
    [dir('acme', 'main.js')]: pluginCode('acme'),
    [dir('acme', 'styles.css')]: '.acme { color: red; }',
    [dir('acme', 'locales/ru.json')]: '{ "title": "Акме" }',
  };
  const modulesOf = (): ModuleLoader =>
    createModuleLoader({ builtins: [['@builder/sdk', sdkModule]] });

  it('код, стили и словари читаются один раз: загрузка берёт начатое чтение', async () => {
    const { source, reads } = countingSource(FILES);
    const loader = createPluginLoader({ source: () => source, modules: modulesOf() });
    const [found] = await loader.discover();
    reads.clear();

    loader.prefetch?.(found);
    // Чтение начато предзагрузкой, а не загрузкой: в этом и смысл — тринадцать плагинов
    // читаются разом, пока включаются по одному. Стили и словари запрошены сразу же; код —
    // после листинга каталога, поэтому его счётчик проверяется по итогу.
    expect(reads.get(dir('acme', 'styles.css'))).toBe(1);
    expect(reads.get(dir('acme', 'locales/ru.json'))).toBe(1);

    const result = await loader.load(found);

    expect(result.ok).toBe(true);
    expect(result.ok && result.loaded.styles?.css).toContain('.acme');
    expect(result.ok && result.loaded.messages?.ru).toEqual({ title: 'Акме' });
    expect(Object.fromEntries(reads)).toEqual({
      [dir('acme', 'main.js')]: 1,
      [dir('acme', 'styles.css')]: 1,
      [dir('acme', 'locales/ru.json')]: 1,
    });
  });

  it('прочитанное заранее — на одну загрузку: повторная читает заново', async () => {
    const { source, reads } = countingSource(FILES);
    const loader = createPluginLoader({ source: () => source, modules: modulesOf() });
    const [found] = await loader.discover();
    reads.clear();

    loader.prefetch?.(found);
    await loader.load(found);
    // Файл на диске мог измениться — перезагрузка плагина «в разработке» обязана это увидеть.
    await loader.load(found);

    expect(reads.get(dir('acme', 'main.js'))).toBe(2);
  });

  it('источник сменился между чтением и загрузкой — загрузка читает с нового', async () => {
    const before = countingSource(FILES);
    const after = countingSource({
      ...FILES,
      [dir('acme', 'styles.css')]: '.acme { color: blue; }',
    });
    let current = before.source;
    const loader = createPluginLoader({ source: () => current, modules: modulesOf() });
    const [found] = await loader.discover();

    loader.prefetch?.(found);
    // Другой проект — другое имя источника: по нему загрузка и узнаёт, что чтение чужое.
    current = { ...after.source, id: 'другой-проект' };
    const result = await loader.load(found);

    // Проект сменили: прочитанное с прежнего каталога этой загрузке не годится.
    expect(result.ok && result.loaded.styles?.css).toContain('blue');
    expect(after.reads.get(dir('acme', 'main.js'))).toBe(1);
  });

  it('отказ чтения при предзагрузке не всплывает сам: его высказывает загрузка, прежним кодом', async () => {
    const { source } = countingSource({
      [dir('acme', 'manifest.json')]: manifestOf({ id: 'acme', styles: { file: 'styles.css' } }),
      [dir('acme', 'main.js')]: pluginCode('acme'),
    });
    const loader = createPluginLoader({ source: () => source, modules: modulesOf() });
    const [found] = await loader.discover();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    try {
      loader.prefetch?.(found);
      // Даём отказу чтения стилей случиться ДО загрузки: необработанным он стать не должен.
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await loader.load(found);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.problem.code).toBe('styles-invalid');
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('код и стили сломаны разом — отказ про код: порядок разбора прежний', async () => {
    const { source } = countingSource({
      [dir('acme', 'manifest.json')]: manifestOf({ id: 'acme', styles: { file: 'styles.css' } }),
      [dir('acme', 'main.js')]: 'throw new Error("код сломан");',
    });
    const loader = createPluginLoader({ source: () => source, modules: modulesOf() });
    const [found] = await loader.discover();

    loader.prefetch?.(found);
    const result = await loader.load(found);

    expect(!result.ok && result.problem.code).toBe('code-failed');
  });

  it('плагин без разобранного манифеста и закрытый проект не предзагружаются', async () => {
    const { source, reads } = countingSource({
      [dir('broken', 'manifest.json')]: '{ "id": ',
    });
    let current: Source | null = source;
    const loader = createPluginLoader({ source: () => current, modules: modulesOf() });
    const [broken] = await loader.discover();
    reads.clear();

    loader.prefetch?.(broken);
    current = null;
    loader.prefetch?.({ ...broken, manifest: undefined });

    expect(reads.size).toBe(0);
  });
});

describe('обнаружение читает манифесты разом', () => {
  it('порядок найденного — порядок каталога, а не порядок ответов источника', async () => {
    const { source: inner } = projectSource({
      [dir('alpha', 'manifest.json')]: manifestOf({ id: 'alpha' }),
      [dir('beta', 'manifest.json')]: manifestOf({ id: 'beta' }),
      [dir('gamma', 'manifest.json')]: manifestOf({ id: 'gamma' }),
    });
    // Первый по каталогу отвечает последним: при параллельном чтении порядок результата
    // обязан остаться порядком каталога — на него опирается разбор совпавших идентификаторов.
    const delays: Record<string, number> = { alpha: 30, beta: 15, gamma: 0 };
    let inFlight = 0;
    let peak = 0;
    const source: Source = {
      ...inner,
      read: async (path) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        const id = Object.keys(delays).find((name) => path.includes(`/${name}/`));
        await new Promise((resolve) => setTimeout(resolve, id === undefined ? 0 : delays[id]));
        inFlight -= 1;
        return inner.read(path);
      },
    };
    const loader = createPluginLoader({ source: () => source, modules: createModuleLoader() });

    const found = await loader.discover();

    expect(found.map((item) => item.id)).toEqual(['alpha', 'beta', 'gamma']);
    // Чтения шли одновременно, а не очередью.
    expect(peak).toBe(3);
  });
});

describe('собранный плагин читается по графу сборки', () => {
  /** Источник, который записывает каждое чтение и каждый обход каталога. */
  function tracingSource(files: Record<string, string>): {
    source: Source;
    reads: string[];
    lists: string[];
  } {
    const { source: inner } = projectSource(files);
    const reads: string[] = [];
    const lists: string[] = [];
    const source: Source = {
      ...inner,
      read: (path) => {
        reads.push(path);
        return inner.read(path);
      },
      list: (path) => {
        lists.push(path);
        return inner.list(path);
      },
    };
    return { source, reads, lists };
  }

  /** Плагин, собранный с делением кода: общий чанк нужен сразу, движок — по требованию. */
  const built = (extra: Record<string, string> = {}): Record<string, string> => ({
    [dir('acme', 'manifest.json')]: manifestOf({
      id: 'acme',
      build: {
        format: 1,
        files: {
          'main.js': { imports: ['chunks/shared.js'], runtime: ['@builder/sdk'] },
          'chunks/shared.js': {},
          'chunks/engine.js': { imports: ['chunks/shared.js'], runtime: ['heavy-kit'] },
          'chunks/corpus.js': {},
        },
      },
    }),
    [dir('acme', 'main.js')]: [
      'const shared = require("./chunks/shared.js");',
      'module.exports = {',
      '  id: "acme",',
      '  activate() {},',
      '  tag: shared.tag,',
      '  loadEngine: () => __reformerImport("./chunks/engine.js"),',
      '  loadAny: (target) => __reformerImport(target),',
      '};',
    ].join('\n'),
    [dir('acme', 'chunks/shared.js')]: 'exports.tag = "общий";',
    [dir('acme', 'chunks/engine.js')]:
      'exports.name = "движок:" + require("./shared.js").tag + ":" + require("heavy-kit").kit;',
    [dir('acme', 'chunks/corpus.js')]: 'module.exports = { title: "Справка" };',
    // Файл в каталоге есть, но сборка его не называет.
    [dir('acme', 'chunks/stray.js')]: 'exports.stray = true;',
    ...extra,
  });

  interface Stand {
    readonly loader: PluginLoader;
    readonly reads: string[];
    readonly lists: string[];
    readonly warmedByName: string[][];
    readonly warmedByText: number;
    readonly kitLoads: () => number;
  }

  function stand(files: Record<string, string>, onDemand: boolean): Stand {
    const { source, reads, lists } = tracingSource(files);
    let kitLoads = 0;
    const registry = createModuleRegistry([
      ['@builder/sdk', sdkModule],
      [
        'heavy-kit',
        lazyBuiltin(() => {
          kitLoads += 1;
          return Promise.resolve({ kit: 'кит' });
        }),
      ],
    ]);
    const warmedByName: string[][] = [];
    const state = { warmedByText: 0 };
    const loader = createPluginLoader({
      source: () => source,
      modules: createModuleLoader({ registry }),
      warm: (texts) => {
        state.warmedByText += 1;
        return registry.warm(collectBareSpecifiers(texts));
      },
      warmNamed: (names) => {
        warmedByName.push([...names]);
        return registry.warm(names);
      },
      onDemand,
    });
    return {
      loader,
      reads,
      lists,
      warmedByName,
      get warmedByText() {
        return state.warmedByText;
      },
      kitLoads: () => kitLoads,
    };
  }

  type Loaded = Plugin & {
    tag: string;
    loadEngine: () => Promise<{ name: string }>;
    loadAny: (target: string) => Promise<Record<string, unknown>>;
  };

  async function loadAcme(s: Stand) {
    const [found] = await s.loader.discover();
    s.reads.length = 0;
    s.lists.length = 0;
    const result = await s.loader.load(found);
    if (!result.ok) throw new Error(result.problem.message);
    return result.loaded;
  }

  it('при загрузке читаются точка входа и её замыкание — без обхода каталога', async () => {
    const s = stand(built(), true);

    const loaded = await loadAcme(s);

    expect((loaded.plugin as Loaded).tag).toBe('общий');
    expect([...s.reads].sort()).toEqual([dir('acme', 'chunks/shared.js'), dir('acme', 'main.js')]);
    // Имена называет манифест: каталог плагина не перечисляется вовсе.
    expect(s.lists).toEqual([]);
    expect([...loaded.files].sort()).toEqual(['chunks/shared.js', 'main.js']);
  });

  it('модули оболочки греются по спискам манифеста, а отложенный — только при импорте', async () => {
    const s = stand(built(), true);

    const loaded = await loadAcme(s);

    // Текст файлов ради импортов не просматривается, и кит движка при запуске не грузится.
    expect(s.warmedByText).toBe(0);
    // Дважды об одном и том же: при начале чтения и перед линковкой (второй ждёт первый).
    expect(s.warmedByName).toEqual([['@builder/sdk'], ['@builder/sdk']]);
    expect(s.kitLoads()).toBe(0);

    const engine = await (loaded.plugin as Loaded).loadEngine();

    expect(engine.name).toBe('движок:общий:кит');
    expect(s.kitLoads()).toBe(1);
    expect(s.warmedByName.at(-1)).toEqual(['heavy-kit']);
  });

  it('прогрев модулей оболочки начинается вместе с предзагрузкой, а не в очереди включения', async () => {
    const s = stand(built(), true);
    const [found] = await s.loader.discover();

    s.loader.prefetch?.(found);

    // Имена называет манифест — ждать, пока прочитается код, незачем: чанки оболочки едут
    // по сети одновременно с файлами плагина.
    expect(s.warmedByName).toEqual([['@builder/sdk']]);
    expect((await s.loader.load(found)).ok).toBe(true);
  });

  it('отложенный файл читается при первом импорте и один раз', async () => {
    const s = stand(built(), true);
    const loaded = await loadAcme(s);
    const plugin = loaded.plugin as Loaded;
    s.reads.length = 0;

    const [first, second] = await Promise.all([plugin.loadEngine(), plugin.loadEngine()]);

    // Общий чанк уже прочитан ради точки входа — второй раз за ним не ходят.
    expect(s.reads).toEqual([dir('acme', 'chunks/engine.js')]);
    expect(second).toBe(first);
    expect((await plugin.loadAny('./chunks/corpus.js')).default).toEqual({ title: 'Справка' });
    expect(s.reads).toEqual([dir('acme', 'chunks/engine.js'), dir('acme', 'chunks/corpus.js')]);
  });

  it('файл, которого сборка не называет, не читается — даже если он лежит в каталоге', async () => {
    const s = stand(built(), true);
    const loaded = await loadAcme(s);
    s.reads.length = 0;

    const failure = await (loaded.plugin as Loaded)
      .loadAny('./chunks/stray.js')
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ name: 'ModuleLinkError', phase: 'resolve' });
    expect((failure as Error).message).toContain('секция сборки');
    expect(s.reads).toEqual([]);
  });

  it('слой без разрешения читает каталог целиком, а отложенный импорт находит прочитанное', async () => {
    // Так грузится плагин проекта: собран тем же сборщиком, но каталог проекта могут сменить
    // или поправить под работающим плагином — дочитывать из него позже нельзя.
    const s = stand(built(), false);

    const loaded = await loadAcme(s);
    const plugin = loaded.plugin as Loaded;

    expect(s.lists.length).toBeGreaterThan(0);
    expect([...loaded.files].sort()).toEqual([
      'chunks/corpus.js',
      'chunks/engine.js',
      'chunks/shared.js',
      'chunks/stray.js',
      'main.js',
    ]);
    // Прогрев — по тексту, как раньше: кит назван в прочитанном файле и греется сразу.
    expect(s.warmedByText).toBe(1);
    expect(s.kitLoads()).toBe(1);

    s.reads.length = 0;
    expect((await plugin.loadEngine()).name).toBe('движок:общий:кит');
    expect((await plugin.loadAny('./chunks/stray.js')).stray).toBe(true);
    expect(s.reads).toEqual([]);
  });

  it('секция сборки, не называющая точку входа, — не повод ей верить: каталог читается целиком', async () => {
    const files = built();
    files[dir('acme', 'manifest.json')] = manifestOf({
      id: 'acme',
      build: { format: 1, files: { 'other.js': {} } },
    });
    const s = stand(files, true);

    const loaded = await loadAcme(s);

    expect(s.lists.length).toBeGreaterThan(0);
    expect(loaded.files).toContain('chunks/engine.js');
  });

  it('предел файлов считается по манифесту — до первого чтения', async () => {
    const { source, reads } = tracingSource(built());
    const loader = createPluginLoader({
      source: () => source,
      modules: createModuleLoader({ builtins: [['@builder/sdk', sdkModule]] }),
      onDemand: true,
      fileLimit: 3,
    });
    const [found] = await loader.discover();
    reads.length = 0;

    const result = await loader.load(found);

    expect(result.ok || result.problem.code).toBe('too-many-files');
    expect(reads).toEqual([]);
  });

  it('файл из замыкания не читается — отказ загрузки, как у любого нечитаемого файла', async () => {
    const files = built();
    delete files[dir('acme', 'chunks/shared.js')];
    const s = stand(files, true);
    const [found] = await s.loader.discover();

    const result = await s.loader.load(found);

    expect(result.ok || result.problem.code).toBe('code-failed');
  });

  it('выгрузка графа: отложенный импорт выключенного плагина отказывает', async () => {
    const s = stand(built(), true);
    const loaded = await loadAcme(s);
    const plugin = loaded.plugin as Loaded;
    s.reads.length = 0;

    loaded.dispose?.();

    await expect(plugin.loadEngine()).rejects.toMatchObject({ phase: 'resolve' });
    expect(s.reads).toEqual([]);
  });

  it('отказ после линковки выгружает граф: начатый кодом импорт не доезжает', async () => {
    const files = built({
      [dir('acme', 'main.js')]: [
        'globalThis.__acmePending = __reformerImport("./chunks/engine.js");',
        'module.exports = { id: "другой", activate() {} };',
      ].join('\n'),
      [dir('acme', 'chunks/engine.js')]: 'globalThis.__acmeExecuted = true;',
    });
    files[dir('acme', 'manifest.json')] = manifestOf({
      id: 'acme',
      build: { format: 1, files: { 'main.js': {}, 'chunks/engine.js': {} } },
    });
    const s = stand(files, true);
    const [found] = await s.loader.discover();
    const holder = globalThis as { __acmePending?: Promise<unknown>; __acmeExecuted?: boolean };
    try {
      const result = await s.loader.load(found);
      const pending = holder.__acmePending?.catch((error: unknown) => error);

      expect(result.ok || result.problem.code).toBe('id-mismatch');
      expect(await pending).toMatchObject({ phase: 'resolve' });
      // Чтение могло успеть начаться — важно, что прочитанное не исполнилось.
      expect(holder.__acmeExecuted).toBeUndefined();
    } finally {
      delete holder.__acmePending;
      delete holder.__acmeExecuted;
    }
  });

  it('предзагрузка читает то же замыкание — и один раз', async () => {
    const s = stand(built(), true);
    const [found] = await s.loader.discover();
    s.reads.length = 0;

    s.loader.prefetch?.(found);
    const result = await s.loader.load(found);

    expect(result.ok).toBe(true);
    expect([...s.reads].sort()).toEqual([dir('acme', 'chunks/shared.js'), dir('acme', 'main.js')]);
  });
});

describe('отложенное чтение плагина: повтор и дочитка заранее', () => {
  /** Собранный плагин с одним отложенным файлом. */
  const FILES: Record<string, string> = {
    [dir('acme', 'manifest.json')]: manifestOf({
      id: 'acme',
      build: {
        format: 1,
        files: { 'main.js': {}, 'chunks/engine.js': {}, 'chunks/corpus.js': {} },
      },
    }),
    [dir('acme', 'main.js')]: [
      'module.exports = {',
      '  id: "acme",',
      '  activate() {},',
      '  load: (target) => __reformerImport(target),',
      '};',
    ].join('\n'),
    [dir('acme', 'chunks/engine.js')]: 'exports.name = "движок";',
    [dir('acme', 'chunks/corpus.js')]: 'module.exports = { title: "Справка" };',
  };

  type Loaded = Plugin & { load: (target: string) => Promise<Record<string, unknown>> };

  /** Источник, у которого чтение названного файла отказывает заданное число раз. */
  function flaky(failures: number, error: () => Error) {
    const { source: inner } = projectSource(FILES);
    const reads: string[] = [];
    let left = failures;
    const source: Source = {
      ...inner,
      read: (path) => {
        reads.push(path);
        if (path.endsWith('chunks/engine.js') && left > 0) {
          left -= 1;
          return Promise.reject(error());
        }
        return inner.read(path);
      },
    };
    return { source, reads };
  }

  async function loadAcme(
    source: Source,
    options: { onDemand?: boolean; onLazyError?: (id: string, error: unknown) => void } = {}
  ) {
    const loader = createPluginLoader({
      source: () => source,
      modules: createModuleLoader({ builtins: [['@builder/sdk', sdkModule]] }),
      onDemand: options.onDemand ?? true,
      lazyRetryDelays: [0, 0],
      onLazyError: options.onLazyError,
    });
    const [found] = await loader.discover();
    const result = await loader.load(found);
    if (!result.ok) throw new Error(result.problem.message);
    return result.loaded;
  }

  const network = (): Error => new SourceError('network', 'сеть недоступна');
  const engineReads = (reads: readonly string[]): number =>
    reads.filter((path) => path.endsWith('chunks/engine.js')).length;

  it('сетевой отказ повторяется: икота сети не доходит до кода плагина', async () => {
    const { source, reads } = flaky(2, network);
    const problems = vi.fn();
    const loaded = await loadAcme(source, { onLazyError: problems });

    const engine = await (loaded.plugin as Loaded).load('./chunks/engine.js');

    expect(engine.name).toBe('движок');
    expect(engineReads(reads)).toBe(3);
    expect(problems).not.toHaveBeenCalled();
  });

  it('повторы кончились — импорт отказывает, а о сбое узнаёт каталог', async () => {
    const { source, reads } = flaky(3, network);
    const problems = vi.fn();
    const loaded = await loadAcme(source, { onLazyError: problems });
    const plugin = loaded.plugin as Loaded;

    await expect(plugin.load('./chunks/engine.js')).rejects.toMatchObject({ phase: 'resolve' });

    expect(engineReads(reads)).toBe(3);
    expect(problems).toHaveBeenCalledTimes(1);
    expect(problems.mock.calls[0][0]).toBe('acme');
    // Отказ не запомнен: когда сеть вернулась, тот же импорт проходит.
    expect((await plugin.load('./chunks/engine.js')).name).toBe('движок');
  });

  it('«файла нет» не повторяется: вторая попытка ответила бы тем же', async () => {
    const { source, reads } = flaky(1, () => new SourceError('not-found', 'нет файла'));
    const loaded = await loadAcme(source);

    await expect((loaded.plugin as Loaded).load('./chunks/engine.js')).rejects.toMatchObject({
      phase: 'resolve',
    });

    expect(engineReads(reads)).toBe(1);
  });

  it('дочитка заранее читает весь отложенный код один раз, не исполняя его', async () => {
    const { source, reads } = flaky(0, network);
    const loaded = await loadAcme(source);
    reads.length = 0;

    await loaded.preload?.();

    expect([...reads].sort()).toEqual([
      dir('acme', 'chunks/corpus.js'),
      dir('acme', 'chunks/engine.js'),
    ]);
    // Импорт после дочитки в сеть не ходит: файл уже в графе.
    expect((await (loaded.plugin as Loaded).load('./chunks/engine.js')).name).toBe('движок');
    expect(reads).toHaveLength(2);
  });

  it('плагину, прочитанному целиком, дочитывать нечего', async () => {
    const { source } = flaky(0, network);

    const loaded = await loadAcme(source, { onDemand: false });

    expect(loaded.preload).toBeUndefined();
  });
});
