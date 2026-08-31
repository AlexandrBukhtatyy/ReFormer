import { describe, expect, it } from 'vitest';
import * as reformerBehaviors from '@reformer/core/behaviors';
import * as reformerCore from '@reformer/core';
import * as reformerValidation from '@reformer/core/validation';
import * as rendererJson from '@reformer/renderer-json';

import { createCompileCache } from '../host/modules/compile-cache';
import { ModuleRegistryError } from '../host/modules/registry';
import {
  TYPESCRIPT_ENGINE_VERSION,
  TYPESCRIPT_OPTIONS_SIGNATURE,
  TYPESCRIPT_TRANSPILER_ID,
} from '../host/plugin/typescript-transpiler';
import type { BuildCacheStore } from '../host/workspace/storage/build-cache';
import * as sdk from '../sdk';
import { createPluginModules } from './plugin-modules';

describe('модули, доступные плагину каталога', () => {
  it('под именем @builder/sdk лежит тот самый объект, что видит оболочка', () => {
    const modules = createPluginModules();

    // Идентичность — весь смысл упражнения: второй экземпляр SDK означал бы плагин,
    // который регистрирует вклады в чужой пустой реестр и молча ничего не делает.
    expect(modules.modules.registry.resolve('@builder/sdk', 'main.js')).toBe(sdk);
    modules.dispose();
  });

  it('React и его jsx-runtime — те же, что у оболочки', () => {
    const modules = createPluginModules();
    const registry = modules.modules.registry;

    // Два React дают два дерева хуков, а транспилированный `.tsx` требует `react/jsx-runtime`
    // по имени — поэтому оба обязаны быть заняты композицией.
    expect(registry.resolve('react', 'main.js')).toBeDefined();
    expect(registry.resolve('react/jsx-runtime', 'panel.tsx')).toBeDefined();
    modules.dispose();
  });

  it('занятые композицией имена плагин подменить не может', () => {
    const modules = createPluginModules();

    for (const specifier of ['@builder/sdk', 'react', 'react/jsx-runtime']) {
      expect(() => modules.modules.registry.register(specifier, { evil: true }), specifier).toThrow(
        ModuleRegistryError
      );
    }
    expect(modules.modules.registry.resolve('@builder/sdk', 'main.js')).toBe(sdk);
    modules.dispose();
  });

  it('движок транспиляции появляется только под TypeScript', async () => {
    const modules = createPluginModules();

    await modules.prepare(['main.js', 'panel.js']);
    expect(modules.modules.transpilers.list()).toEqual([]);

    await modules.prepare(['main.ts']);
    expect(modules.modules.transpilers.list().map((t) => t.id)).toEqual(['typescript']);

    modules.dispose();
  });

  it('prepare НЕ греет ленивые: плагину каталога кит не нужен, а чанк стоит секунд', async () => {
    const modules = createPluginModules();

    await modules.prepare(['main.js']);

    // Ленивые остались холодными — прогрев ленивых зовёт тот, кто исполняет код формы.
    expect(modules.modules.registry).toBeDefined();
    expect(() => modules.modules.registry.resolve('@reformer/ui-kit', 'main.js')).toThrowError(
      ModuleRegistryError
    );
    modules.dispose();
  });
});

describe('модули, доступные коду формы', () => {
  it('отдаёт сайдкарам ТЕ ЖЕ экземпляры ядра и рендерера, что держит оболочка', () => {
    const modules = createPluginModules();
    const registry = modules.modules.registry;

    // Второй экземпляр ядра ломает `instanceof Signal` и поиск узла по сигналу — форма
    // отрисовалась бы, но её листья остались бы без form-node.
    expect(registry.resolve('@reformer/core', 'form/model.ts')).toBe(reformerCore);
    expect(registry.resolve('@reformer/core/validation', 'form/validation.ts')).toBe(
      reformerValidation
    );
    expect(registry.resolve('@reformer/core/behaviors', 'form/form.behavior.ts')).toBe(
      reformerBehaviors
    );
    expect(registry.resolve('@reformer/renderer-json', 'form/registry.ts')).toBe(rendererJson);

    modules.dispose();
  });

  it('линкует сайдкар, импортирующий @reformer/core/validation', async () => {
    const modules = createPluginModules();

    // `.js`, а не `.ts`: движок транспиляции к резолву импортов отношения не имеет,
    // а тянуть настоящий tsc ради проверки реестра — лишняя секунда на каждом прогоне.
    await modules.prepare(['validation.js']);
    const result = await modules.modules.load(
      new Map([
        ['validation.js', 'exports.rules = require("@reformer/core/validation");'],
        ['main.js', 'exports.v = require("./validation").rules;'],
      ]),
      'main.js'
    );

    expect(result.errors).toEqual([]);
    expect((result.entry as { v: unknown }).v).toBe(reformerValidation);

    modules.dispose();
  });

  it('попадание в кэш НЕ будит движок транспиляции', async () => {
    const data = new Map<string, string>();
    const store: BuildCacheStore = {
      workspaceId: 'w1',
      read: (kind, hash) => Promise.resolve(data.get(`${kind}:${hash}`) ?? null),
      write: (kind, hash, text) => {
        data.set(`${kind}:${hash}`, text);
        return Promise.resolve();
      },
      sweep: () => Promise.resolve({ bytesBefore: 0, removed: 0 }),
      clear: () => Promise.resolve(),
    };
    const cache = createCompileCache(store, {
      engineId: TYPESCRIPT_TRANSPILER_ID,
      engineVersion: TYPESCRIPT_ENGINE_VERSION,
      optionsVersion: TYPESCRIPT_OPTIONS_SIGNATURE,
    });
    const files = new Map([['model.ts', 'export const initialFormModel = { a: 1 };']]);

    const first = createPluginModules({ cache: () => cache });
    const primed = await first.prepareCached(files);
    expect(primed.complete).toBe(false);
    // Промах — движок пришлось разбудить и транспилировать самим.
    const transpiled = first.modules.transpilers
      .find('model.ts')
      ?.transpile(files.get('model.ts') ?? '', 'model.ts');
    expect(transpiled?.js).toContain('exports.initialFormModel');
    await primed.commit(new Map([['model.ts', transpiled?.js ?? '']]));
    first.dispose();

    // Второй сеанс — как перезагрузка страницы: тот же кэш, свежие модули.
    const second = createPluginModules({ cache: () => cache });
    const again = await second.prepareCached(files);

    expect(again.complete).toBe(true);
    expect(again.ready.get('model.ts')).toContain('exports.initialFormModel');
    // Главное свойство кэша: `import('typescript')` не случился, значит 3.5 МБ чанка не поехали.
    expect(second.modules.transpilers.list()).toEqual([]);
    second.dispose();
  });

  it('без кэша ведёт себя как раньше: движок будится всегда', async () => {
    const modules = createPluginModules();

    const primed = await modules.prepareCached(new Map([['model.ts', 'export const a = 1;']]));

    expect(primed.complete).toBe(false);
    expect(modules.modules.transpilers.list().map((t) => t.id)).toEqual([TYPESCRIPT_TRANSPILER_ID]);
    modules.dispose();
  });

  it('после warm отдаёт ленивый кит и подпуть cdk, которого нет в его бочке', async () => {
    const modules = createPluginModules();

    await modules.warm();
    const registry = modules.modules.registry;

    expect(registry.resolve('@reformer/ui-kit', 'form/registry.ts')).toBeDefined();
    // `Step` живёт в подпути и в бочку `@reformer/cdk` не реэкспортирован — ровно поэтому
    // подпути перечислены поимённо, а не сведены к «любой подпуть = бочка».
    const wizard = registry.resolve('@reformer/cdk/form-wizard', 'form/registry.ts');
    expect((wizard as Record<string, unknown>).Step).toBeDefined();

    modules.dispose();
  });
});
