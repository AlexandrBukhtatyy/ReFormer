/**
 * Загрузчик плагинов из каталога проекта: найти в `.ui_builder/plugins/`, прочитать, слинковать.
 *
 * ## Почему через источник, а не «из файловой системы»
 *
 * Каталог плагинов лежит В ОТКРЫТОМ ПРОЕКТЕ, значит читается тем же способом, что и всё
 * остальное в нём, — через {@link Source}. Прямое обращение к File System Access отсюда
 * означало бы вторую дорогу к файлам проекта: с собственной нормализацией путей, собственными
 * отказами и собственным поведением в тестах. Отсюда же следует место в последовательности
 * запуска: **восьмой шаг, после восстановления источника** — до него плагины физически неоткуда
 * прочитать (plugin-and-shell.md, «Последовательность запуска»).
 *
 * ## Почему тот же механизм, что у компилятора формы
 *
 * Загрузка кода целиком отдана `host/modules`: транспиляция при необходимости плюс линковка
 * CommonJS-графа с реестром модулей оболочки. Ничего своего здесь нет, и это существенно —
 * `@builder/sdk` обязан быть ОДНИМ объектом для оболочки и для плагина. Второй экземпляр
 * (а именно им заканчивается любая догрузка по bare-спецификатору) дал бы плагин, который
 * регистрирует вклады в чужой пустой реестр и молча ничего не делает.
 *
 * Отсюда разделение обязанностей с композицией: реестр модулей с настоящим `@builder/sdk`
 * собирает `app/`, а загрузчик получает готовый {@link ModuleLoader}. Занять защищённый слот
 * может только тот, кто создаёт реестр, — плагину этот путь закрыт устройством реестра,
 * а не проверкой в загрузчике.
 *
 * ## Прогрев транспиляторов — до линковки, отдельной фазой
 *
 * `main.ts` компилируется на лету, а движок TypeScript приезжает лениво. Асинхронный шаг
 * нельзя вставить внутрь `require`, поэтому прогрев ({@link PluginLoaderDeps.prepare}) стоит
 * перед `modules.load` и получает список файлов: набор без единого `.ts` не грузит движок
 * вовсе. Подробности — в `./typescript-transpiler`.
 *
 * ## Отказы — данные
 *
 * Ни один метод не бросает из-за плагина: испорченный манифест, отсутствующая точка входа
 * и падение при исполнении — обычные состояния каталога, который человек правит руками.
 * Все они возвращаются как {@link PluginProblem} и доходят до списка плагинов. Бросить может
 * только источник, и только на том, что к конкретному плагину не относится (каталог не читается
 * целиком) — это уже отказ проекта, а не плагина.
 *
 * @module host/plugin/loader
 */

import type { ModuleLoader } from '../modules/loader';
import { joinPath } from '../primitives/resource';
import { isSourceError } from '../source/errors';
import type { Entry, Source } from '../source/types';
import {
  parsePluginManifest,
  PLUGIN_MANIFEST_FILE,
  type PluginManifest,
  type PluginProblem,
  type PluginProblemCode,
} from './manifest';
import type { Plugin } from './types';

/** Где в проекте лежат плагины. Путь из контракта; по образцу Obsidian. */
export const PLUGIN_CATALOG_DIR = '.ui_builder/plugins';

/**
 * Потолок числа файлов одного плагина.
 *
 * Загрузка читает каталог плагина ЦЕЛИКОМ (линковщик резолвит импорты по набору файлов,
 * а `require` синхронен — дочитать по требованию нельзя). Значит нужен предел: каталог
 * на тысячи файлов — это не плагин, а чужое дерево, случайно оказавшееся под этим именем,
 * и вычитывать его по сети или через File System Access мы не будем. Отказ, а не усечение:
 * молча недочитанный плагин ломался бы «необъяснимо» на первом же импорте.
 */
export const PLUGIN_FILE_LIMIT = 200;

/** Что вообще может быть модулем. Остальное в набор не попадает — читать его незачем. */
export const PLUGIN_CODE_EXTENSIONS: readonly string[] = [
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
];

/** Каталоги, в которые загрузчик не заходит. */
const SKIPPED_DIRS: readonly string[] = ['node_modules'];

/**
 * Найденный в каталоге плагин.
 *
 * `manifest` и `problem` взаимоисключающи, но оба необязательны в типе намеренно: список
 * плагинов показывает и то и другое одинаковой строкой, и разбор объединения ради этого
 * ничего бы не дал.
 */
export interface DiscoveredPlugin {
  /** Имя каталога. Оно же идентификатор — совпадение проверено при разборе манифеста. */
  readonly id: string;
  /** Путь каталога плагина внутри источника. */
  readonly dir: string;
  readonly manifest?: PluginManifest;
  readonly problem?: PluginProblem;
}

/** Плагин, готовый к регистрации: объект из его точки входа плюс манифест. */
export interface LoadedPlugin {
  readonly manifest: PluginManifest;
  readonly plugin: Plugin;
  /** Файлы, из которых он собран, — путями внутри каталога плагина. Для диагностики. */
  readonly files: readonly string[];
  /**
   * Текст объявленной таблицы стилей, если она объявлена. Уже прочитан, но ещё НЕ установлен:
   * ставить его в документ — дело активации, а загрузка активацией не является (см. `load`).
   * Установка — `installPluginStyles` из `./styles`.
   */
  readonly styles?: { readonly css: string; readonly isolation: 'scoped' };
}

export type PluginLoadResult =
  | { readonly ok: true; readonly loaded: LoadedPlugin }
  | { readonly ok: false; readonly problem: PluginProblem };

export interface PluginLoaderDeps {
  /**
   * Источник открытого проекта. Функция, а не объект: проект открывают, закрывают и меняют,
   * а загрузчик живёт дольше любого из них. `null` — проекта нет, и находить нечего.
   */
  readonly source: () => Source | null;
  /**
   * Загрузка кода. Реестр модулей внутри уже содержит `@builder/sdk` — заполняет его тот,
   * кто создаёт реестр (см. `app/plugin-modules`).
   */
  readonly modules: ModuleLoader;
  /**
   * Прогрев транспиляторов перед линковкой. Получает имена файлов плагина, чтобы решить,
   * нужен ли движок вообще.
   */
  readonly prepare?: (fileNames: readonly string[]) => Promise<void>;
  /** Каталог плагинов. Параметр ради тестов. */
  readonly dir?: string;
  readonly fileLimit?: number;
}

export interface PluginLoader {
  /** Каталог плагинов, в который смотрит загрузчик. */
  readonly dir: string;
  /**
   * Перечисляет плагины каталога и разбирает их манифесты. Код не исполняется.
   *
   * Нет каталога или нет проекта — пустой список: отсутствие плагинов не событие.
   * Отказ источника по другой причине пробрасывается: это отказ проекта, а не плагина.
   */
  discover(): Promise<readonly DiscoveredPlugin[]>;
  /**
   * Читает файлы плагина и исполняет его точку входа.
   *
   * Возвращает объект плагина — но НЕ активирует его: жизненный цикл принадлежит
   * `PluginRegistry`, и смешивать загрузку с активацией значило бы иметь два места,
   * где плагин может «включиться».
   */
  load(found: DiscoveredPlugin): Promise<PluginLoadResult>;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const fail = (
  code: PluginProblemCode,
  message: string,
  extra?: { file?: string; cause?: unknown }
): { ok: false; problem: PluginProblem } => ({
  ok: false,
  problem: { code, message, file: extra?.file, cause: extra?.cause },
});

/** Похоже ли значение на плагин. Больше рантайму знать о нём нечего. */
function asPlugin(value: unknown): Plugin | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as { id?: unknown; activate?: unknown };
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') return undefined;
  if (typeof candidate.activate !== 'function') return undefined;
  return value as Plugin;
}

/**
 * Достаёт плагин из экспортов точки входа.
 *
 * Две формы, потому что их две в жизни: `module.exports = definePlugin(...)` у собранного
 * `main.js` и `export default definePlugin(...)` у `main.ts`, который транспилируется
 * в `exports.default`. Требовать одну из них значило бы отвергать половину рабочих плагинов
 * ради формальности.
 */
function pluginFromExports(exports: unknown): Plugin | undefined {
  const direct = asPlugin(exports);
  if (direct !== undefined) return direct;
  if (typeof exports === 'object' && exports !== null) {
    return asPlugin((exports as { default?: unknown }).default);
  }
  return undefined;
}

function hasCodeExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return PLUGIN_CODE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Точка входа среди файлов плагина.
 *
 * Точное совпадение — основной случай. Замена расширения нужна для того, что контракт называет
 * разработкой в каталоге: плагин распространяется с `"main": "main.js"`, а рядом лежит `main.ts`,
 * который автор правит. Без подстановки такой плагин отвечал бы «нет точки входа», хотя код
 * на месте, — и разработка в каталоге требовала бы править манифест туда-обратно.
 */
function resolveEntry(files: ReadonlyMap<string, string>, main: string): string | undefined {
  if (files.has(main)) return main;
  const dot = main.lastIndexOf('.');
  const base = dot > 0 ? main.slice(0, dot) : main;
  for (const ext of PLUGIN_CODE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (files.has(candidate)) return candidate;
  }
  return undefined;
}

/** Читаемые записи одного уровня. Отсутствие каталога — пустой уровень, а не отказ. */
async function listOrEmpty(source: Source, dir: string): Promise<readonly Entry[]> {
  try {
    return await source.list(dir);
  } catch (error) {
    if (isSourceError(error, 'not-found')) return [];
    throw error;
  }
}

export function createPluginLoader(deps: PluginLoaderDeps): PluginLoader {
  const dir = deps.dir ?? PLUGIN_CATALOG_DIR;
  const fileLimit = deps.fileLimit ?? PLUGIN_FILE_LIMIT;

  /**
   * Собирает файлы плагина: путь ВНУТРИ каталога плагина → исходник.
   *
   * Обход в ширину, потому что предел проверяется до чтения: сначала выясняем, сколько файлов,
   * и только потом их читаем. Иначе каталог на тысячу файлов был бы прочитан целиком и лишь
   * затем отвергнут.
   */
  const collectFiles = async (
    source: Source,
    pluginDir: string
  ): Promise<
    { ok: true; files: ReadonlyMap<string, string> } | { ok: false; problem: PluginProblem }
  > => {
    const paths: string[] = [];
    const queue: string[] = [''];

    while (queue.length > 0) {
      const relative = queue.shift() as string;
      const entries = await listOrEmpty(source, joinPath(pluginDir, relative));
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.kind === 'directory') {
          if (SKIPPED_DIRS.includes(entry.name)) continue;
          queue.push(relative === '' ? entry.name : `${relative}/${entry.name}`);
          continue;
        }
        if (!hasCodeExtension(entry.name)) continue;
        paths.push(relative === '' ? entry.name : `${relative}/${entry.name}`);
        if (paths.length > fileLimit) {
          return fail(
            'too-many-files',
            `в каталоге плагина больше ${fileLimit} файлов кода: это не плагин, ` +
              'а чужое дерево — загрузчик читает каталог целиком и такого не потянет'
          );
        }
      }
    }

    const files = new Map<string, string>();
    const texts = await Promise.all(
      paths.map(async (path) => (await source.read(joinPath(pluginDir, path))).text)
    );
    paths.forEach((path, at) => files.set(path, texts[at]));
    return { ok: true, files };
  };

  return {
    dir,

    async discover(): Promise<readonly DiscoveredPlugin[]> {
      const source = deps.source();
      if (source === null) return [];

      const entries = await listOrEmpty(source, dir);
      const found: DiscoveredPlugin[] = [];

      for (const entry of entries) {
        // Плагин — это каталог. Файл рядом с плагинами (README, архив) молча пропускаем:
        // ошибкой это назвать не за что.
        if (entry.kind !== 'directory' || entry.name.startsWith('.')) continue;
        const pluginDir = joinPath(dir, entry.name);
        const manifestPath = joinPath(pluginDir, PLUGIN_MANIFEST_FILE);

        let text: string;
        try {
          text = (await source.read(manifestPath)).text;
        } catch (error) {
          const missing = isSourceError(error, 'not-found');
          found.push({
            id: entry.name,
            dir: pluginDir,
            problem: {
              code: missing ? 'manifest-missing' : 'manifest-unreadable',
              message: missing
                ? `в каталоге «${entry.name}» нет ${PLUGIN_MANIFEST_FILE}`
                : `${PLUGIN_MANIFEST_FILE} не читается: ${describe(error)}`,
              file: PLUGIN_MANIFEST_FILE,
              cause: error,
            },
          });
          continue;
        }

        const parsed = parsePluginManifest(text, entry.name);
        found.push(
          parsed.ok
            ? { id: entry.name, dir: pluginDir, manifest: parsed.manifest }
            : { id: entry.name, dir: pluginDir, problem: parsed.problem }
        );
      }

      return found;
    },

    async load(found: DiscoveredPlugin): Promise<PluginLoadResult> {
      if (found.manifest === undefined) {
        return found.problem === undefined
          ? fail('manifest-missing', `у плагина «${found.id}» нет разобранного манифеста`)
          : { ok: false, problem: found.problem };
      }
      const manifest = found.manifest;

      const source = deps.source();
      if (source === null) {
        return fail('code-failed', 'проект закрыт: читать плагин неоткуда');
      }
      if (!source.capabilities.executesCode) {
        // Та же граница, что у сайдкаров формы: код, пришедший не с диска пользователя,
        // не исполняется. Включение плагина — согласие человека, но оно не отменяет
        // запрета исполнения по источнику.
        return fail(
          'source-forbids-code',
          `источник «${source.id}» не разрешает исполнять свой код, ` +
            'поэтому плагины из него не загружаются'
        );
      }

      let collected;
      try {
        collected = await collectFiles(source, found.dir);
      } catch (error) {
        return fail('code-failed', `файлы плагина не читаются: ${describe(error)}`, {
          cause: error,
        });
      }
      if (!collected.ok) return collected;
      const files = collected.files;

      const entry = resolveEntry(files, manifest.main);
      if (entry === undefined) {
        return fail(
          'entry-missing',
          `точки входа «${manifest.main}» нет среди файлов плагина ` +
            `(есть: ${[...files.keys()].join(', ') || '—'})`,
          { file: manifest.main }
        );
      }

      try {
        // Прогрев ДО линковки: внутри `require` асинхронного шага быть не может.
        await deps.prepare?.([...files.keys()]);
      } catch (error) {
        return fail('code-failed', `движок транспиляции не готов: ${describe(error)}`, {
          file: entry,
          cause: error,
        });
      }

      const result = await deps.modules.load(files, entry);
      if (result.errors.length > 0) {
        const first = result.errors[0];
        return fail('code-failed', `${first.file}: ${first.message}`, {
          file: first.file,
          cause: first.cause,
        });
      }

      const plugin = pluginFromExports(result.entry);
      if (plugin === undefined) {
        return fail(
          'not-a-plugin',
          `«${entry}» не экспортировал плагин: ожидается объект с «id» и «activate» ` +
            'в module.exports или в экспорте по умолчанию',
          { file: entry }
        );
      }
      if (plugin.id !== manifest.id) {
        return fail(
          'id-mismatch',
          `код объявляет плагин «${plugin.id}», а манифест — «${manifest.id}». ` +
            'Идентификатор — ключ во всех реестрах, и расхождение означало бы вклады, ' +
            'найденные по одному имени и снимаемые по другому',
          { file: entry }
        );
      }

      // Стили читаются ПОСЛЕ кода, отдельным чтением: `collectFiles` берёт только файлы кода,
      // и класть в тот же набор `.css` значило бы отдать его линковщику как модуль.
      let styles: LoadedPlugin['styles'];
      if (manifest.styles !== undefined) {
        try {
          const css = (await source.read(joinPath(found.dir, manifest.styles.file))).text;
          styles = { css, isolation: manifest.styles.isolation };
        } catch (error) {
          return fail(
            'styles-invalid',
            `объявленная таблица стилей «${manifest.styles.file}» не читается: ${describe(error)}`,
            { file: manifest.styles.file, cause: error }
          );
        }
      }

      return {
        ok: true,
        loaded: {
          manifest,
          plugin,
          files: [...files.keys()],
          ...(styles === undefined ? {} : { styles }),
        },
      };
    },
  };
}
