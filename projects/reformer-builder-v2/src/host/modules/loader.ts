/**
 * Служба загрузки кода: транспилировать при необходимости и слинковать с реестром модулей.
 *
 * Потребителей два — компилятор формы и загрузчик плагинов, — и делают они буквально одно и то же.
 * Разные у них только входные данные: у плагина это его каталог, у формы — её файлы из Workspace.
 * Поэтому механизм один, живёт в Host и принимает набор «путь → исходник»: откуда файлы взялись,
 * загрузчику всё равно, и это то, ради чего вообще существует рабочая копия.
 *
 * Граф на каждую загрузку свежий. Кэшировать исполнение между вызовами нельзя: правка исходника
 * обязана привести к повторному исполнению, иначе превью будет показывать прошлый код.
 *
 * Асинхронность — в контракте, потому что движок транспиляции может приезжать ленивым чанком
 * (в v1 так грузится `typescript`). Сама линковка внутри — синхронная и обязана такой остаться:
 * `require` в CommonJS-модуле синхронен.
 *
 * @module host/modules/loader
 */

import {
  createLinker,
  normalizeFiles,
  normalizePath,
  ModuleLinkError,
  type LinkPhase,
} from './linker';
import { createModuleRegistry, type HostModuleRegistry, type ModuleRegistry } from './registry';
import { createTranspilerRegistry, type TranspilerRegistry } from './transpilers';

/**
 * Сбой загрузки одного файла — данные, а не исключение.
 *
 * Панель сборки и загрузчик плагинов показывают это пользователю, поэтому здесь плоская структура
 * с именем файла и фазой: «на чём споткнулись» и «где чинить» — два разных вопроса.
 */
export interface ModuleLoadError {
  /** Файл, к которому отнесён сбой. */
  readonly file: string;
  readonly phase: LinkPhase;
  readonly message: string;
  /** Исходное исключение — для консоли и стека, не для показа. */
  readonly cause?: unknown;
}

/** Результат загрузки графа. */
export interface LoadResult {
  /** Экспорты точки входа; `undefined`, если загрузка не удалась. */
  readonly entry: unknown;
  /** Всё, что успело исполниться, — включая случай частичного отказа. */
  readonly modules: ReadonlyMap<string, unknown>;
  /** Пусто ⇔ загрузка удалась. */
  readonly errors: readonly ModuleLoadError[];
}

/**
 * Служба Host. Регистрируется под токеном `host.moduleLoader`, когда появится
 * `host/primitives/service.ts` (Э1):
 *
 * ```ts
 * export const ModuleLoaderToken = defineService<ModuleLoader>('host.moduleLoader');
 * ```
 */
export interface ModuleLoader {
  /** Куда оболочка сажает свои модули и куда плагин может добавить (но не подменить) свои. */
  readonly registry: ModuleRegistry;
  /** Сменные движки транспиляции. Сверх контракта — иначе некуда зарегистрировать TS. */
  readonly transpilers: TranspilerRegistry;
  /** Загружает набор файлов как связный граф модулей. */
  load(files: ReadonlyMap<string, string>, entry: string): Promise<LoadResult>;
}

/** Настройки загрузчика. Всё необязательно: по умолчанию реестры пустые и свои. */
export interface ModuleLoaderOptions {
  /** Готовый реестр — например, общий на всё приложение. */
  readonly registry?: HostModuleRegistry;
  /** Модули оболочки, если реестр создаётся здесь. Единственный путь занять защищённый слот. */
  readonly builtins?: Iterable<readonly [string, unknown]>;
  readonly transpilers?: TranspilerRegistry;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Приводит любое исключение к плоскому {@link ModuleLoadError}. */
function toLoadError(error: unknown, fallbackFile: string): ModuleLoadError {
  if (error instanceof ModuleLinkError) {
    return { file: error.file, phase: error.phase, message: error.message, cause: error };
  }
  return { file: fallbackFile, phase: 'evaluate', message: describe(error), cause: error };
}

/** Создаёт службу загрузки модулей. */
export function createModuleLoader(options: ModuleLoaderOptions = {}): ModuleLoader {
  const registry = options.registry ?? createModuleRegistry(options.builtins);
  const transpilers = options.transpilers ?? createTranspilerRegistry();

  /**
   * Файл без подходящего движка идёт как есть.
   *
   * Это не послабление, а нужное поведение: собранный `main.js` плагина — уже JS, и требовать
   * для него транспилятор значило бы заводить пустышку ради формальности.
   */
  const compile = (code: string, fileName: string): string => {
    const transpiler = transpilers.find(fileName);
    return transpiler === undefined ? code : transpiler.transpile(code, fileName).js;
  };

  return {
    registry,
    transpilers,

    load(files, entry) {
      const normalized = normalizeFiles(files);
      const linker = createLinker({
        files: normalized,
        registry,
        compile,
        knownSpecifiers: () => registry.specifiers(),
      });

      const entryPath = normalizePath(entry);
      const entryFile =
        entryPath === undefined || entryPath === ''
          ? undefined
          : linker.resolveFile(`/${entryPath}`, '');

      if (entryFile === undefined) {
        return Promise.resolve({
          entry: undefined,
          modules: linker.modules,
          errors: [
            {
              file: entry,
              phase: 'resolve' as const,
              message:
                `точка входа «${entry}» не найдена среди файлов ` +
                `(есть: ${[...normalized.keys()].join(', ') || '—'})`,
            },
          ],
        });
      }

      try {
        const value = linker.load(entryFile);
        return Promise.resolve({ entry: value, modules: linker.modules, errors: [] });
      } catch (error) {
        // Модули, успевшие исполниться до сбоя, остаются доступны: у плагина это уже
        // подключённые вклады, которые владельцу придётся снять.
        return Promise.resolve({
          entry: undefined,
          modules: linker.modules,
          errors: [toLoadError(error, entryFile)],
        });
      }
    },
  };
}
