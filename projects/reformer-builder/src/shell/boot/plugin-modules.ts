/**
 * Реестр модулей для плагинов каталога: что оболочка даёт плагину под именем пакета.
 *
 * Место этого файла в композиции неслучайно. Занять защищённый слот реестра может **только
 * тот, кто реестр создаёт** (`createModuleRegistry(builtins)`), а публичный `register`
 * не может к ним прикоснуться уже никогда. Значит настоящий `@builder/sdk`, настоящий React
 * и настоящий `react/jsx-runtime` сажает сюда композиция — единственный слой, которому
 * можно всё, — и ровно поэтому подмена этих имён плагином невыразима, а не запрещена.
 *
 * ## Почему именно эти
 *
 * `@builder/sdk` — то, ради чего `sdk/` существует: буквально тот объект, который загрузчик
 * подставляет плагину. Второй экземпляр означал бы плагин, регистрирующий вклады в чужой
 * пустой реестр. React и его `jsx-runtime` — потому что панель плагина обязана строиться тем же
 * React, что и оболочка: два React дают два дерева хуков, а транспилированный `.tsx` требует
 * `react/jsx-runtime` по имени.
 *
 * `react-dom` добавлен последним и по необходимости: вклад плагина рисуется деревом оболочки
 * не всегда. Поверхность превью монтируют СВОИМ корнем (`createRoot` из `react-dom/client`,
 * см. `plugins/reformer/render/surface/mount`), а портал зовёт `createPortal` из корня пакета. Пока
 * этих имён в реестре не было, внешнему плагину было нечем нарисовать форму вовсе: React он
 * получал, а смонтировать его не мог. Цена нулевая — пакет и так в графе оболочки.
 *
 * ## Модулей стека здесь нет
 *
 * `@reformer/core`, рендереры, кит и их подпути исполняемому коду тоже отдаются — но какие
 * именно, решает не оболочка. Что импортирует код формы — знание о стеке: списки лежат
 * у плагинов, состав приложения собирает их обходом папок (`ApplicationComposition.modules`),
 * а сюда они приходят параметром ({@link PluginModulesOptions.modules}). Привилегия при этом
 * не размывается: модули состава садятся в реестр ЗДЕСЬ же, при его создании, вместе
 * с модулями оболочки, и публичный `register` не дотягивается ни до тех, ни до других.
 *
 * @module shell/boot/plugin-modules
 */

import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';
import * as reactDomClient from 'react-dom/client';

import type { CompileCache, PrimedCompile } from '@/shell/platform/modules/compile-cache';
import { createModuleLoader, type ModuleLoader } from '@/shell/platform/modules/loader';
import { createModuleRegistry } from '@/shell/platform/modules/registry';
import { collectBareSpecifiers } from '@/shell/platform/modules/specifiers';
import {
  createTypeScriptSupport,
  isTypeScriptFile,
  type TypeScriptSupport,
} from '@/shell/platform/plugin/typescript-transpiler';
import type { ComposedModule } from './composition';
import type { Disposable } from '@reformer/builder-plugin-api/internal';
import * as sdk from '@reformer/builder-plugin-api';
import * as sdkTooling from '@reformer/builder-plugin-api/tooling';

/**
 * Собственные модули оболочки: то, без чего не соберётся ни плагин, ни `.tsx` формы.
 *
 * ОДИН объект под двумя именами, и это переходный период, а не два слота. Имя `@builder/sdk`
 * останется, пока по нему написаны плагины; новое — то, под которым контракт опубликован в npm
 * и против которого плагин каталога компилируется у себя. Второй ЭКЗЕМПЛЯР здесь был бы
 * плагином, регистрирующим вклады в чужой пустой реестр.
 */
const HOST_MODULES: readonly ComposedModule[] = [
  ['@builder/sdk', sdk],
  ['@reformer/builder-plugin-api', sdk],
  // Вход инструментов контракта — разбор манифеста, проверка каталога кита. Отдаётся тем же
  // пакетом, что и сам контракт: плагин, вложивший свою копию, проверял бы каталог чужой схемой.
  // Тяжёлое в нём (ajv) грузится по требованию внутри самого входа.
  ['@reformer/builder-plugin-api/tooling', sdkTooling],
  ['react', react],
  ['react/jsx-runtime', jsxRuntime],
  ['react-dom', reactDom],
  ['react-dom/client', reactDomClient],
];

/** Загрузка кода плагинов: реестр модулей плюс прогретые по требованию транспиляторы. */
export interface PluginModules extends Disposable {
  readonly modules: ModuleLoader;
  /**
   * Прогрев движка транспиляции перед линковкой. Отдельная фаза, потому что асинхронного шага
   * внутри линковки быть не может: `require` внутри модуля синхронен.
   */
  prepare(fileNames: readonly string[]): Promise<void>;
  /**
   * Прогрев с кэшем: читает готовый JS для набора и грузит движок ТОЛЬКО при промахе.
   *
   * Принимает файлы, а не имена, и это вся разница с {@link PluginModules.prepare}: ответить
   * «движок не нужен» можно, лишь зная содержимое, — ключ кэша считается от исходника.
   * Ради этого ответа кэш и заводился: попадание экономит не миллисекунды транспиляции,
   * а чанк `typescript` на 3.5 МБ.
   *
   * Без кэша (нет OPFS, нет `crypto.subtle`) ведёт себя ровно как `prepare`: пустой прогретый
   * набор и загруженный движок.
   */
  prepareCached(files: ReadonlyMap<string, string>): Promise<PrimedCompile>;
  /**
   * Прогрев ленивых модулей оболочки — ОТДЕЛЬНО от {@link PluginModules.prepare} и не «на всякий
   * случай».
   *
   * Зовёт его тот, кто исполняет код ФОРМЫ: ей кит нужен почти всегда, и превью грузит его
   * и без того — своим `KitNamespaceLoader`. Плагин каталога — другой случай: кит ему обычно
   * не нужен вовсе, а прогрев стоит настоящей загрузки чанка (измерено: +2 с на прогон одного
   * теста композиции в node). Разделение здесь и есть та точность, ради которой ленивость
   * заводилась: платит тот, кому нужно.
   *
   * Той же точности ради прогрев берёт ФАЙЛЫ: греются модули, которые они импортируют, а не
   * все ленивые разом. С подпутями кита разница перестала быть косметической — за пятнадцатью
   * из них стоят `recharts`, `cmdk`, `embla-carousel-react`, и форма с одним текстовым полем
   * тянула бы их все. Без аргумента греет всё: так зовут тесты композиции, которым нужен
   * заполненный реестр, а не экономия.
   */
  warm(files?: ReadonlyMap<string, string>): Promise<void>;
  /** Поддержка TypeScript. Наружу — ради тестов композиции и диагностики. */
  readonly typescript: TypeScriptSupport;
  /**
   * Спецификаторы реестра — для сверки с обещанием пакета контракта (`PLUGIN_RUNTIME_MODULES`).
   *
   * Отдельным полем, потому что реестр загрузчика сужен до контракта и перечислить себя
   * не умеет. Совпадение проверяет тест сборки: сборщик плагина выносит из сборки ровно список
   * пакета, и модуль, которого здесь нет, стал бы падением собранного «правильно» плагина.
   */
  readonly specifiers: readonly string[];
}

/** Настройки композиции модулей: модули состава и где кэшировать транспиляцию. */
export interface PluginModulesOptions {
  /**
   * Куда складывать результат транспиляции — ФУНКЦИЯ, а не значение.
   *
   * Кэш принадлежит рабочей области, а модули поднимаются раньше неё и переживают смену проекта.
   * Захваченный в замыкание кэш означал бы, что после смены проекта транспиляция пишется
   * в каталог прежнего, — то есть ровно ту потерю идентичности, от которой кэш и защищают
   * ключом. `null` — проекта сейчас нет, кэшировать некуда.
   */
  readonly cache?: () => CompileCache | null;
  /**
   * Модули состава приложения — садятся в реестр наравне с модулями оболочки.
   *
   * Спецификатор, совпавший с модулем оболочки, — отказ на старте, а не подмена: реестр
   * не принимает один слот дважды, и состав не может переопределить React или SDK.
   */
  readonly modules?: readonly ComposedModule[];
}

export function createPluginModules(options: PluginModulesOptions = {}): PluginModules {
  // Реестр создаётся здесь, а не внутри загрузчика: прогрев ленивых — операция реестра,
  // а `ModuleLoader.registry` сужен до контракта и её не отдаёт.
  const registry = createModuleRegistry([...HOST_MODULES, ...(options.modules ?? [])]);
  const modules = createModuleLoader({ registry });
  const typescript = createTypeScriptSupport(modules.transpilers);
  const cacheOf = options.cache;

  return {
    modules,
    typescript,
    specifiers: registry.specifiers(),
    prepare: (fileNames) => typescript.ensure(fileNames),
    // Файлы, а не список имён: у вызывающего они уже есть, а спецификаторы из них читаются
    // одним проходом. Без файлов — прогрев всего: так зовут тесты композиции.
    warm: (files) => registry.warm(files === undefined ? undefined : collectBareSpecifiers(files)),

    async prepareCached(files) {
      // Кэшируются только те файлы, которым нужен движок: для собранного `main.js` ключ
      // и значение совпали бы, то есть запись стоила бы места и не экономила ничего.
      const forEngine = new Map([...files].filter(([fileName]) => isTypeScriptFile(fileName)));
      const primed = (await cacheOf?.()?.prime(forEngine)) ?? INERT_PRIME;
      // Промах — единственная причина будить движок. Полное попадание означает, что
      // `import('typescript')` не случится вовсе.
      if (!primed.complete) await typescript.ensure(files.keys());
      return primed;
    },

    dispose() {
      typescript.dispose();
    },
  };
}

/** Прогрев без кэша: движок понадобится, писать некуда. */
const INERT_PRIME: PrimedCompile = Object.freeze({
  ready: new Map<string, string>(),
  complete: false,
  commit: () => Promise.resolve(),
});
