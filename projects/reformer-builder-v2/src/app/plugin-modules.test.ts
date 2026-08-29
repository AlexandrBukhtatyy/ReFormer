import { describe, expect, it } from 'vitest';

import { ModuleRegistryError } from '../host/modules/registry';
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
});
