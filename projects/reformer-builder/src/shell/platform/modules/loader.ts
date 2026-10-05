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
 * ## Отложенный импорт — дочитка того же графа
 *
 * Синхронный `require` означает, что всё, до чего он может дотянуться, обязано быть прочитано
 * заранее. Для собранного плагина это мегабайты кода, который могут и не открыть. Поэтому его
 * `import()` сборщик превращает в вызов хост-функции ({@link LazyLoad}): граница там асинхронна
 * уже в коде автора, и на ней можно сделать то, чего нельзя внутри `require`, — прочитать файл.
 * Дочитанное исполняется ТЕМ ЖЕ линковщиком: общий чанк, уже исполненный ради точки входа,
 * отдаётся из кэша графа, а не исполняется второй раз.
 *
 * @module shell/platform/modules/loader
 */

import { toEsmNamespace } from './esm-interop';
import { createLinker, normalizeFiles, ModuleLinkError, type LinkPhase } from './linker';
import { normalizeModulePath, PLUGIN_LAZY_IMPORT } from '@reformer/builder-plugin-api/internal';
import {
  createModuleRegistry,
  isRelativeSpecifier,
  type HostModuleRegistry,
  type ModuleRegistry,
} from './registry';
import {
  createTranspilerRegistry,
  TranspileError,
  type TranspileFinding,
  type TranspilerRegistry,
} from './transpilers';

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
  /**
   * Место в исходнике файла, если фаза его знает.
   *
   * Знает только транспиляция: движок читает исходник и отдаёт смещение. Фаза исполнения
   * места не знает честно — стек называет строки уже собранного JS, а не файла перед человеком,
   * и приписать их исходнику значило бы подчеркнуть не то.
   */
  readonly range?: TranspileFinding['range'];
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
  /**
   * Что пришлось транспилировать на самом деле: путь → полученный JS.
   *
   * Отдаётся наружу ради кэша, и только он этим пользуется. Считать это можно было бы и снаружи —
   * повторив транспиляцию, — но платить вторым проходом за то, что уже вычислено, незачем.
   * Файлы, взятые из {@link LoadOptions.ready}, сюда не попадают: они и так в кэше.
   */
  readonly compiled: ReadonlyMap<string, string>;
  /**
   * Выгружает граф: отложенный импорт после этого отказывает, а тексты файлов отпускаются.
   *
   * Есть только у загрузки с {@link LoadOptions.lazy} — у прочих граф закончен в момент
   * возврата, и выгружать нечего. Зовёт владелец кода, когда тот перестал быть нужен: плагин
   * выключили, а его чтение ещё в пути — исполнять дочитанное уже некому.
   */
  readonly dispose?: () => void;
  /**
   * Дочитывает файлы в граф, НЕ исполняя их: отложенный импорт после этого не ждёт чтения.
   *
   * Это ускорение, а не обязанность, поэтому отказ чтения здесь молчит: файл просто останется
   * непрочитанным, и импорт прочтёт его сам — тогда и скажет, если не выйдет. Есть только
   * у загрузки с {@link LoadOptions.lazy}.
   */
  readonly preload?: (paths: readonly string[]) => Promise<void>;
}

/**
 * Дочитка графа по отложенному импорту.
 *
 * Все три члена необязательны, и пустой объект осмыслен: он значит «граф — то, что прочитано
 * заранее, но `import()` в нём идёт через хост-функцию». Так грузится плагин проекта: его
 * каталог читается целиком, а собран он тем же сборщиком, что и плагин приложения.
 */
export interface LazyLoad {
  /**
   * Что нужно файлу СРАЗУ: он сам и всё, что он требует статически, — пути от корня набора.
   * Без неё замыкание — сам файл.
   */
  readonly closure?: (path: string) => readonly string[];
  /** Читает файл, которого в наборе ещё нет. Без неё дочитывать неоткуда. */
  readonly read?: (path: string) => Promise<string>;
  /**
   * Последний асинхронный шаг перед исполнением дочитанного — прогрев модулей оболочки,
   * которые эти файлы требуют. После него линковка синхронна, как и всегда.
   */
  readonly prepare?: (paths: readonly string[]) => Promise<void>;
  /**
   * Отложенный импорт не удался: файл не прочитан, пакет недоступен или код упал.
   *
   * Тот же отказ получает и вызвавший код — отклонённым промисом. Сюда он приходит затем,
   * чтобы о нём узнал человек: код плагина вправе отказ проглотить. Импорт из выгруженного
   * графа сюда не сообщает — это не сбой, а выключенный плагин.
   */
  readonly onError?: (error: unknown) => void;
}

/** Чем можно снабдить одну загрузку. */
export interface LoadOptions {
  /**
   * Готовый JS для части файлов: путь → код. Транспилятор для них не зовётся вовсе.
   *
   * Это единственный способ, которым кэш сборки касается загрузки, и он намеренно узкий:
   * линковщик получает всё тот же `compile`, а не второй источник модулей, — то есть остаётся
   * неизменным, как и обещано его контрактом.
   */
  readonly ready?: ReadonlyMap<string, string>;
  /**
   * Подстановки импортов на время этой загрузки: спецификатор → готовые экспорты.
   *
   * Ими фикстура формы закрывает то, чего в оболочке нет (`@/shared/dict`) и что не должно
   * исполняться по-настоящему (`./api`). Подробности и границы — в {@link LinkerOptions.overrides}.
   */
  readonly overrides?: ReadonlyMap<string, unknown>;
  /**
   * Окружение, подставляемое каждому модулю набора лексически: `fetch`, `Date`, `Math`.
   *
   * Пусто по умолчанию — тогда исполнение ничем не отличается от прежнего.
   */
  readonly ambient?: Readonly<Record<string, unknown>>;
  /**
   * Отложенный импорт собранного кода: каждый модуль набора получает хост-функцию
   * (`PLUGIN_LAZY_IMPORT`), которая дочитывает файл и исполняет его в этом же графе.
   *
   * Не часть контракта плагинов (`ModuleLoaderService`): читать файлы умеет тот, кто знает,
   * откуда они, — загрузчик плагинов, — и плагину эту дверь открывать незачем.
   */
  readonly lazy?: LazyLoad;
}

/**
 * Служба Host. Регистрируется под токеном `host.moduleLoader`, когда появится
 * `host/primitives/service.ts` (Э1):
 *
 * ```ts
 * export const ModuleLoaderToken = defineService<ModuleLoader>('reformer.modules');
 * ```
 */
export interface ModuleLoader {
  /** Куда оболочка сажает свои модули и куда плагин может добавить (но не подменить) свои. */
  readonly registry: ModuleRegistry;
  /** Сменные движки транспиляции. Сверх контракта — иначе некуда зарегистрировать TS. */
  readonly transpilers: TranspilerRegistry;
  /** Загружает набор файлов как связный граф модулей. */
  load(
    files: ReadonlyMap<string, string>,
    entry: string,
    options?: LoadOptions
  ): Promise<LoadResult>;
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

/**
 * Место первой находки движка, если сбой — отказ транспиляции.
 *
 * Первой, а не всех: у сбоя одно место в плоской структуре, а первая находка — та, с которой
 * человек начнёт чинить; остальные обычно её следствие.
 */
function rangeOf(error: ModuleLinkError): TranspileFinding['range'] | undefined {
  const cause = error.cause;
  if (!(cause instanceof TranspileError)) return undefined;
  return cause.findings.find((finding) => finding.range !== undefined)?.range;
}

/** Приводит любое исключение к плоскому {@link ModuleLoadError}. */
function toLoadError(error: unknown, fallbackFile: string): ModuleLoadError {
  if (error instanceof ModuleLinkError) {
    const range = rangeOf(error);
    return {
      file: error.file,
      phase: error.phase,
      message: error.message,
      ...(range === undefined ? {} : { range }),
      cause: error,
    };
  }
  return { file: fallbackFile, phase: 'evaluate', message: describe(error), cause: error };
}

/** Модуль из JSON-файла: `module.exports` — разобранное значение (как у Node и бандлеров). */
function jsonModule(code: string): string {
  return `module.exports = ${code.trim() === '' ? 'null' : code};`;
}

/** Создаёт службу загрузки модулей. */
export function createModuleLoader(options: ModuleLoaderOptions = {}): ModuleLoader {
  const registry = options.registry ?? createModuleRegistry(options.builtins);
  const transpilers = options.transpilers ?? createTranspilerRegistry();

  return {
    registry,
    transpilers,

    load(files, entry, loadOptions) {
      // Свой изменяемый набор: линковщик держит на него ссылку, и дочитанный по отложенному
      // импорту файл становится виден ему без пересоздания графа.
      const normalized = new Map(normalizeFiles(files));
      const ready = loadOptions?.ready;
      const lazy = loadOptions?.lazy;

      let disposed = false;
      /** Идущие чтения — по файлам: два импорта, которым нужен один чанк, читают его раз. */
      const reading = new Map<string, Promise<void>>();
      /** Пространства имён, уже отданные коду: повторный `import()` получает тот же объект. */
      const namespaces = new Map<string, unknown>();
      const packages = new Map<string, unknown>();

      /**
       * Файл есть в наборе — или читается сейчас. Отказ НЕ запоминается: сетевая икота
       * не должна до перезагрузки страницы лишать человека редактора.
       */
      const ensureFile = (path: string): Promise<void> => {
        if (normalized.has(path)) return Promise.resolve();
        const started = reading.get(path);
        if (started !== undefined) return started;
        const read = lazy?.read;
        if (read === undefined) {
          return Promise.reject(
            new ModuleLinkError(
              'resolve',
              path,
              `файла нет среди прочитанных (есть: ${[...normalized.keys()].join(', ') || '—'})`,
              []
            )
          );
        }
        const pending = read(path)
          .then(
            (code) => {
              // Выгруженному графу текст уже не нужен: исполнять его некому.
              if (!disposed) normalized.set(path, code);
            },
            (error: unknown) => {
              throw new ModuleLinkError(
                'resolve',
                path,
                `файл не прочитан: ${describe(error)}`,
                [],
                error
              );
            }
          )
          .finally(() => reading.delete(path));
        reading.set(path, pending);
        return pending;
      };

      const assertLive = (target: string): void => {
        if (!disposed) return;
        throw new ModuleLinkError(
          'resolve',
          target,
          'граф модулей выгружен: код, которому нужен этот импорт, уже выключен',
          []
        );
      };
      /** Что прошло через движок. Наполняется по ходу линковки — граф зовёт только нужное. */
      const compiled = new Map<string, string>();

      /**
       * Файл без подходящего движка идёт как есть.
       *
       * Это не послабление, а нужное поведение: собранный `main.js` плагина — уже JS, и требовать
       * для него транспилятор значило бы заводить пустышку ради формальности.
       *
       * Готовый код из кэша проверяется ПЕРВЫМ и по тому же ключу, что и файл в наборе, — иначе
       * попадание пришлось бы искать после того, как движок уже разбудили.
       */
      const compile = (code: string, fileName: string): string => {
        const cached = ready?.get(fileName);
        if (cached !== undefined) return cached;
        const transpiler = transpilers.find(fileName);
        // JSON — данные, а не код: `import x from './a.json'` получает разобранное значение.
        // Корректный JSON — корректное выражение JS, поэтому обёртки достаточно.
        if (transpiler === undefined) return fileName.endsWith('.json') ? jsonModule(code) : code;
        const js = transpiler.transpile(code, fileName).js;
        compiled.set(fileName, js);
        return js;
      };

      /**
       * Хост-функция отложенного импорта — то, во что сборщик превращает `import()`.
       *
       * Граница ВСЕГДА асинхронная, даже когда файл уже прочитан: `import()` на верхнем уровне
       * модуля зовёт её, пока линковщик этот модуль ещё исполняет, и синхронная загрузка
       * отсюда приняла бы обратную ссылку на него за циклический импорт. К моменту микрозадачи
       * стек линковщика пуст — он синхронен.
       */
      const importLazy = (target: unknown): Promise<unknown> =>
        Promise.resolve()
          .then(() => resolveLazy(target))
          .catch((error: unknown) => {
            if (!disposed) lazy?.onError?.(error);
            throw error;
          });

      /**
       * Текст исполненного файла отпускается: его модуль линковщик отдаёт из кэша графа,
       * и держать мегабайты исходника до выключения плагина незачем. Ключ остаётся — по нему
       * разрешаются импорты и по нему же видно, что файл читать не надо.
       */
      const releaseExecuted = (): void => {
        if (lazy === undefined) return;
        for (const path of linker.modules.keys()) {
          if (normalized.get(path) !== '') normalized.set(path, '');
        }
      };

      const resolveLazy = async (target: unknown): Promise<unknown> => {
        if (typeof target !== 'string' || target === '') {
          throw new ModuleLinkError('resolve', entry, 'отложенный импорт без имени модуля', []);
        }
        assertLive(target);

        // Имя пакета — только реестр, как и у `require`: догрузка извне дала бы второй
        // экземпляр. Отложенный пакет греется здесь, а не при запуске, — ради этого импорт
        // и объявлен отложенным.
        if (!isRelativeSpecifier(target) && !target.startsWith('/')) {
          if (packages.has(target)) return packages.get(target);
          await registry.warm([target]);
          const found = registry.resolve(target, entry);
          if (found === undefined) {
            throw new ModuleLinkError(
              'resolve',
              entry,
              `модуль «${target}» недоступен: он не зарегистрирован в оболочке, ` +
                'а догружать модули извне запрещено — второй экземпляр пакета ломает идентичность',
              []
            );
          }
          const namespace = toEsmNamespace(found);
          packages.set(target, namespace);
          return namespace;
        }

        // Путь — от корня набора: хост-функция одна на граф и не знает, кто её позвал.
        const path = normalizeModulePath(target.startsWith('/') ? target.slice(1) : target);
        if (path === undefined || path === '') {
          throw new ModuleLinkError(
            'resolve',
            target,
            'отложенный импорт выходит за пределы набора файлов',
            []
          );
        }
        if (namespaces.has(path)) return namespaces.get(path);

        const needed = lazy?.closure?.(path) ?? [path];
        await Promise.all(needed.map(ensureFile));
        await lazy?.prepare?.(needed);
        // Пока файлы читались, владельца могли выключить: исполнять дочитанное уже незачем.
        assertLive(target);

        const file = linker.resolveFile(`/${path}`, '');
        if (file === undefined) {
          throw new ModuleLinkError('resolve', path, 'файла нет среди прочитанных', []);
        }
        // Импорт того же файла мог завершиться, пока этот ждал чтения.
        if (namespaces.has(file)) return namespaces.get(file);
        let exports: unknown;
        try {
          exports = linker.load(file);
        } finally {
          releaseExecuted();
        }
        const namespace = toEsmNamespace(exports);
        namespaces.set(file, namespace);
        namespaces.set(path, namespace);
        return namespace;
      };

      const linker = createLinker({
        files: normalized,
        registry,
        compile,
        knownSpecifiers: () => registry.specifiers(),
        overrides: loadOptions?.overrides,
        ambient:
          lazy === undefined
            ? loadOptions?.ambient
            : { ...loadOptions?.ambient, [PLUGIN_LAZY_IMPORT]: importLazy },
      });

      const dispose =
        lazy === undefined
          ? {}
          : {
              dispose: (): void => {
                disposed = true;
                reading.clear();
                normalized.clear();
              },
              preload: (paths: readonly string[]): Promise<void> =>
                disposed
                  ? Promise.resolve()
                  : Promise.all(paths.map((path) => ensureFile(path).catch(() => undefined))).then(
                      () => undefined
                    ),
            };

      const entryPath = normalizeModulePath(entry);
      const entryFile =
        entryPath === undefined || entryPath === ''
          ? undefined
          : linker.resolveFile(`/${entryPath}`, '');

      if (entryFile === undefined) {
        return Promise.resolve({
          entry: undefined,
          modules: linker.modules,
          compiled,
          ...dispose,
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
        releaseExecuted();
        return Promise.resolve({
          entry: value,
          modules: linker.modules,
          compiled,
          errors: [],
          ...dispose,
        });
      } catch (error) {
        // Модули, успевшие исполниться до сбоя, остаются доступны: у плагина это уже
        // подключённые вклады, которые владельцу придётся снять.
        return Promise.resolve({
          entry: undefined,
          modules: linker.modules,
          compiled,
          errors: [toLoadError(error, entryFile)],
          ...dispose,
        });
      }
    },
  };
}
