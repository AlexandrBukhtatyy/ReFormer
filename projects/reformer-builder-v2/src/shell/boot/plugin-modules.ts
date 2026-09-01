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
 * ## Почему `@reformer/*` здесь всё-таки появился
 *
 * Список — цена платформы, и раньше здесь стояло «добавлять по требованию первого плагина,
 * которому они действительно нужны». Требование пришло не от плагина, а от компилирующей
 * поверхности превью: сайдкары формы импортируют `@reformer/core/validation`,
 * `@reformer/core/behaviors` и `@reformer/renderer-json` ВСЕГДА — это не выбор автора формы,
 * а способ, которым форма вообще пишется. Без них `validation.ts` любой настоящей формы падал
 * на фазе `resolve`, то есть исполняющая поверхность не собирала ни одной формы из проекта.
 *
 * Цена нулевая: `grep` по `src/` показывает, что всё из первой группы уже статически в графе
 * билдера (renderer-json — 116 импортов, core — 7, плюс подпути). Регистрация отдаёт коду формы
 * ТОТ ЖЕ объект модуля, который держит оболочка, — ради этого весь механизм и существует.
 *
 * ## Что ленивое и почему именно оно
 *
 * `@reformer/ui-kit` вынесен в собственный чанк (708 кБ) осознанно, `@reformer/cdk` в графе
 * билдера отсутствует вовсе. Обоим — {@link lazyBuiltin}: обещание вместо значения, разрешаемое
 * в фазе прогрева, до линковки.
 *
 * ## Подпутей `@reformer/ui-kit/*` здесь нет, и это решение, а не пропуск
 *
 * Соблазн велик: объявить корень «плоским» и отдавать бочку на любой подпуть. Так делал v1.
 * Здесь это неверно и ломается ТИХО — бочка `@reformer/ui-kit` собрана из `export *` по 61 модулю
 * из 78, и семнадцати в ней нет (`combobox`, `date-picker`, `table`, `command`, `sonner`, …).
 * Подпуть вернул бы бочку, `import { DatePicker }` дал бы `undefined`, а рендерер нарисовал бы
 * пустоту вместо компонента — то есть ровно тот класс дефектов, ради которого реестр и заводился.
 *
 * У `@reformer/cdk` та же ловушка с другой стороны: подпуть БОГАЧЕ корня (`Step`, `Slot`,
 * `FormWizardPrev` есть в `./form-wizard`, но не в бочке), поэтому его подпути перечислены
 * поимённо — их шесть, и они закрыты полностью.
 *
 * Пока подпуть кита не зарегистрирован, отказ виден словами («модуль недоступен, доступны: …»),
 * а форма всё равно рисуется: реестр компонентов превью строится из каталога кита, и `registry.ts`
 * формы для этого не нужен.
 *
 * Обход сайдкаров всех примеров `react-playground` (23 каталога) показывает, чего это стоит
 * сегодня: не покрыты `@reformer/ui-kit/form-wizard` (6 упоминаний), `/form-array` (3)
 * и `/combobox` (1) — против 64 у `@reformer/core` и 41 у корня кита. Задача на подпути кита
 * заведена отдельно; `axios` и `lucide-react` в том же обходе покрывать не надо вовсе —
 * это зависимости приложения, и отказ по ним честный.
 *
 * @module app/plugin-modules
 */

import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as signalsCore from '@preact/signals-core';
import * as reformerCore from '@reformer/core';
import * as reformerBehaviors from '@reformer/core/behaviors';
import * as reformerModel from '@reformer/core/model';
import * as reformerSignals from '@reformer/core/signals';
import * as reformerValidation from '@reformer/core/validation';
import * as reformerValidators from '@reformer/core/validators';
import * as rendererJson from '@reformer/renderer-json';
import * as rendererReact from '@reformer/renderer-react';

import type { CompileCache, PrimedCompile } from '@/shell/platform/modules/compile-cache';
import { createModuleLoader, type ModuleLoader } from '@/shell/platform/modules/loader';
import { createModuleRegistry, lazyBuiltin } from '@/shell/platform/modules/registry';
import {
  createTypeScriptSupport,
  isTypeScriptFile,
  type TypeScriptSupport,
} from '@/shell/platform/plugin/typescript-transpiler';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import * as sdk from '@/sdk';

/**
 * Модули оболочки, отдаваемые исполняемому коду.
 *
 * Порядок групп — по цене, а не по алфавиту: сперва то, что уже в графе, потом то, за что платят
 * отдельным чанком. Подпути перечислены поимённо, потому что реестр резолвит точным совпадением
 * (см. шапку модуля о том, почему «плоский пакет» здесь был бы тихой поломкой).
 */
const BUILTINS: readonly (readonly [string, unknown])[] = [
  // Оболочка и React — без них не соберётся ни плагин, ни `.tsx` формы.
  ['@builder/sdk', sdk],
  ['react', react],
  ['react/jsx-runtime', jsxRuntime],

  // Уже в графе билдера: регистрация бесплатна по чанкам.
  ['@preact/signals-core', signalsCore],
  ['@reformer/core', reformerCore],
  ['@reformer/core/behaviors', reformerBehaviors],
  ['@reformer/core/model', reformerModel],
  ['@reformer/core/signals', reformerSignals],
  ['@reformer/core/validation', reformerValidation],
  ['@reformer/core/validators', reformerValidators],
  ['@reformer/renderer-json', rendererJson],
  ['@reformer/renderer-react', rendererReact],

  // Отдельные чанки: платим только когда исполняется код, который их просит.
  ['@reformer/form-registry', lazyBuiltin(() => import('@reformer/form-registry'))],
  ['@reformer/form-registry/react', lazyBuiltin(() => import('@reformer/form-registry/react'))],
  ['@reformer/form-registry/storage', lazyBuiltin(() => import('@reformer/form-registry/storage'))],
  ['@reformer/ui-kit', lazyBuiltin(() => import('@reformer/ui-kit'))],
  ['@reformer/cdk', lazyBuiltin(() => import('@reformer/cdk'))],
  ['@reformer/cdk/async-boundary', lazyBuiltin(() => import('@reformer/cdk/async-boundary'))],
  ['@reformer/cdk/file-upload', lazyBuiltin(() => import('@reformer/cdk/file-upload'))],
  ['@reformer/cdk/form-array', lazyBuiltin(() => import('@reformer/cdk/form-array'))],
  ['@reformer/cdk/form-field', lazyBuiltin(() => import('@reformer/cdk/form-field'))],
  ['@reformer/cdk/form-wizard', lazyBuiltin(() => import('@reformer/cdk/form-wizard'))],
  ['@reformer/cdk/list', lazyBuiltin(() => import('@reformer/cdk/list'))],
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
   */
  warm(): Promise<void>;
  /** Поддержка TypeScript. Наружу — ради тестов композиции и диагностики. */
  readonly typescript: TypeScriptSupport;
}

/** Настройки композиции модулей. Единственная — где кэшировать транспиляцию. */
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
}

export function createPluginModules(options: PluginModulesOptions = {}): PluginModules {
  // Реестр создаётся здесь, а не внутри загрузчика: прогрев ленивых — операция реестра,
  // а `ModuleLoader.registry` сужен до контракта и её не отдаёт.
  const registry = createModuleRegistry(BUILTINS);
  const modules = createModuleLoader({ registry });
  const typescript = createTypeScriptSupport(modules.transpilers);
  const cacheOf = options.cache;

  return {
    modules,
    typescript,
    prepare: (fileNames) => typescript.ensure(fileNames),
    warm: () => registry.warm(),

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
