/**
 * Реестр модулей для плагинов каталога: что оболочка даёт плагину под именем пакета.
 *
 * Место этого файла в композиции неслучайно. Занять защищённый слот реестра может **только
 * тот, кто реестр создаёт** (`createModuleRegistry(builtins)`), а публичный `register`
 * не может к ним прикоснуться уже никогда. Значит настоящий `@builder/sdk`, настоящий React
 * и настоящий `react/jsx-runtime` сажает сюда композиция — единственный слой, которому
 * можно всё, — и ровно поэтому подмена этих имён плагином невыразима, а не запрещена.
 *
 * ## Почему именно эти три
 *
 * `@builder/sdk` — то, ради чего `sdk/` существует: буквально тот объект, который загрузчик
 * подставляет плагину. Второй экземпляр означал бы плагин, регистрирующий вклады в чужой
 * пустой реестр. React и его `jsx-runtime` — потому что панель плагина обязана строиться тем же
 * React, что и оболочка: два React дают два дерева хуков, а транспилированный `.tsx` требует
 * `react/jsx-runtime` по имени.
 *
 * `@reformer/*` здесь пока нет намеренно. Список — цена платформы, и каждый пункт в нём стоит
 * того, что он тянет в основной чанк; добавлять их надо по требованию первого плагина,
 * которому они действительно нужны, а не «на будущее».
 *
 * @module app/plugin-modules
 */

import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';

import { createModuleLoader, type ModuleLoader } from '../host/modules/loader';
import {
  createTypeScriptSupport,
  type TypeScriptSupport,
} from '../host/plugin/typescript-transpiler';
import type { Disposable } from '../host/primitives/disposable';
import * as sdk from '../sdk';

/** Загрузка кода плагинов: реестр модулей плюс прогретые по требованию транспиляторы. */
export interface PluginModules extends Disposable {
  readonly modules: ModuleLoader;
  /**
   * Прогрев перед линковкой. Отдельная фаза, потому что движок TypeScript приезжает лениво,
   * а `require` внутри модуля синхронен — асинхронному шагу внутри линковки места нет.
   */
  prepare(fileNames: readonly string[]): Promise<void>;
  /** Поддержка TypeScript. Наружу — ради тестов композиции и диагностики. */
  readonly typescript: TypeScriptSupport;
}

export function createPluginModules(): PluginModules {
  const modules = createModuleLoader({
    builtins: [
      ['@builder/sdk', sdk],
      ['react', react],
      ['react/jsx-runtime', jsxRuntime],
    ],
  });
  const typescript = createTypeScriptSupport(modules.transpilers);

  return {
    modules,
    typescript,
    prepare: (fileNames) => typescript.ensure(fileNames),
    dispose() {
      typescript.dispose();
    },
  };
}
