/**
 * `reformer-plugin build`: исходники плагина → каталог, который оболочка грузит как есть.
 *
 * ## Что получается
 *
 * `manifest.json` (тот же, с `main: "main.js"` и `styles.file: "styles.css"`), один `main.js`,
 * `styles.css`, если стили объявлены, словари по тем же путям, что в исходниках, и модули
 * данных в `chunks/` — если код импортирует JSON отложенно.
 *
 * - **`main.js` — CommonJS.** Линковщик оболочки исполняет модули как CommonJS, и готовый JS
 *   идёт у него без транспиляции (`shell/platform/modules/loader`): собери мы ESM, оболочке
 *   пришлось бы будить транспилятор ради уже собранного файла.
 * - **Модули рантайма — внешние, ровно по списку** `PLUGIN_RUNTIME_MODULES`. Вложенная копия
 *   React или ядра форм — второй экземпляр и тихая поломка. Импорт `@reformer/*` или
 *   `@builder/*`, которого в списке нет, — ОТКАЗ сборки: вложить его нельзя (тот же второй
 *   экземпляр), а оставить внешним — значит плагин, падающий на спецификаторе при загрузке.
 * - **Помощники печати — вкладываются** (`PLUGIN_BUNDLED_PACKAGES`, это `@reformer/builder-toolkit`):
 *   чистые функции без синглтонов, которых оболочка не подставляет. Код домена (ядро ReFormer)
 *   пакетом больше не бывает и не вкладывается: чужой домен расширяют возможностями.
 * - **CSS из кода — отказ.** Стили плагина объявляются в манифесте (`styles`), и только тогда
 *   оболочка их изолирует. Импорт `.css` из кода дал бы таблицу, о которой манифест молчит.
 * - **`?raw` — текст файла строкой**, как у Vite: `import tpl from './form.eta?raw'`. Так плагин
 *   держит шаблоны кодогенерации файлами, а не строками в коде; в `main.js` текст вложен.
 * - **Отложенный импорт JSON — отдельный файл.** `await import('./corpus.json')` — так автор
 *   говорит «эти данные нужны не сразу». Вложенные в `main.js`, они разбирались бы движком при
 *   каждой загрузке плагина, даже когда до них дело не дойдёт: мегабайты данных — мегабайты
 *   разбора. Поэтому такой JSON уезжает модулем в `chunks/<имя>.js`, а в `main.js` остаётся
 *   `require` — линковщик оболочки исполнит модуль при первом обращении. Статический
 *   `import data from './a.json'` вкладывается, как и раньше. Код так не делится: общий для
 *   двух файлов модуль пришлось бы вкладывать дважды, а у данных общего нет.
 * - **Текст в UTF-8.** По умолчанию esbuild экранирует всё вне ASCII, и кириллица в строках
 *   занимает втрое больше места. Оболочка читает файлы плагина как UTF-8.
 *
 * ## Что проверяется на выходе
 *
 * Собранный каталог проходит то, что пройдёт у оболочки: разбор манифеста поставки `project`
 * (с каталогом, названным по `id`), потолок числа файлов кода и «сухую» активацию
 * (`./dry-run`) — узнавание плагина в экспортах, `id` кода и `provides`.
 *
 * ## Каталог вывода не чужой
 *
 * Сборка удаляет только то, что писала сама: файлы, которые называет манифест ПРОШЛОЙ сборки
 * этого же плагина (тот же `id` и `main: "main.js"`), и модули данных в `chunks/`, помеченные
 * её первой строкой. Каталог целиком она не стирает никогда — в нём может лежать больше, чем
 * сборка.
 *
 * Так устроен пакет плагина, который собирается на месте: исходники в `src/`, а сборка —
 * `build src --out .` — рядом, в корне каталога, откуда оболочка её и грузит. Каталог вывода,
 * внутри которого лежат исходники, поэтому не чужой, даже когда он не пуст; файл, которого
 * прошлая сборка не писала, в нём не перезаписывается.
 *
 * Отказов два. Непустой каталог без нашей сборки и без наших исходников — `output-not-ours`:
 * `--out ~/project` не должен сорить в проекте. Сам каталог исходников — `output-is-source`:
 * манифест и точка входа сборки легли бы поверх исходных.
 *
 * @module @reformer/builder-plugin-cli/commands/build
 */

import { mkdir, readdir, readFile, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  isBundledPluginModule,
  isPluginCodeFile,
  parsePluginManifest,
  PLUGIN_FILE_LIMIT,
  PLUGIN_MANIFEST_FILE,
  PLUGIN_RUNTIME_MODULES,
  type PluginSourceManifest,
} from '@reformer/builder-plugin-api/tooling';
import * as esbuild from 'esbuild';

import { dryActivate } from './dry-run.js';
import type { Finding } from './findings.js';
import { validatePlugin } from './validate.js';

export interface BuildOptions {
  /** Каталог исходников плагина (с `manifest.json`). */
  readonly dir: string;
  /** Куда класть сборку; умолчание — `dist` в каталоге исходников. */
  readonly outDir?: string;
}

export type BuildResult =
  | {
      readonly ok: true;
      readonly manifest: PluginSourceManifest;
      readonly outDir: string;
      readonly files: readonly string[];
      /** Проверки, которые не удалось довести до конца вне оболочки. Не отказы. */
      readonly notices: readonly string[];
    }
  | { readonly ok: false; readonly findings: readonly Finding[] };

/** Имена, под которыми сборка кладёт код и стили. */
const BUILT_MAIN = 'main.js';
const BUILT_STYLES = 'styles.css';

/** Каталог модулей данных — JSON, который код импортирует отложенно. */
const BUILT_CHUNKS_DIR = 'chunks';

/**
 * Первая строка модуля данных. По ней сборка узнаёт СВОИ файлы в `chunks/`: манифест их
 * не называет, а удалять по одному имени каталога значило бы стереть чужой файл.
 */
const chunkMarker = (id: string): string => `/* @reformer-plugin-data ${id} */`;

const fail = (...findings: Finding[]): BuildResult => ({ ok: false, findings });

/** Спецификатор пакета — не путь: ни относительный, ни абсолютный (в том числе `D:\`). */
function isBareSpecifier(path: string): boolean {
  return !path.startsWith('.') && !path.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(path);
}

/**
 * Модули рантайма — внешние; вкладываемые пакеты — вкладываются; прочее `@reformer/*` — отказ
 * с объяснением.
 */
const runtimeModules: esbuild.Plugin = {
  name: 'reformer-runtime-modules',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point' || !isBareSpecifier(args.path)) return undefined;
      if (PLUGIN_RUNTIME_MODULES.includes(args.path)) return { path: args.path, external: true };
      if (isBundledPluginModule(args.path)) return undefined;
      if (args.path.startsWith('@reformer/') || args.path.startsWith('@builder/')) {
        return {
          errors: [
            {
              text:
                `модуль «${args.path}» оболочка не подставляет, а вкладывать его в сборку нельзя — ` +
                'это был бы второй экземпляр пакета',
              detail: 'module-unavailable',
            },
          ],
        };
      }
      return undefined;
    });
  },
};

/** `path` лежит внутри `parent` — строго: сам `parent` не считается. */
function isInside(parent: string, path: string): boolean {
  const offset = relative(parent, path);
  return offset !== '' && !offset.startsWith('..') && !isAbsolute(offset);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Файлы прошлой сборки этого плагина в каталоге вывода — по её манифесту.
 *
 * `undefined` — сборки там нет: манифеста нет, он чужой или это манифест исходников. Собранный
 * манифест узнаётся по `main: "main.js"`: иначе манифест исходников с тем же `id` выдал бы
 * исходники за сборку — и они были бы удалены.
 */
async function previousBuildFiles(outDir: string, id: string): Promise<string[] | undefined> {
  let text: string;
  try {
    text = await readFile(join(outDir, PLUGIN_MANIFEST_FILE), 'utf8');
  } catch {
    return undefined;
  }
  const parsed = parsePluginManifest(text, { kind: 'project', dir: id });
  if (!parsed.ok || parsed.manifest.main !== BUILT_MAIN) return undefined;
  const { manifest } = parsed;
  return [
    PLUGIN_MANIFEST_FILE,
    BUILT_MAIN,
    ...(manifest.styles === undefined ? [] : [manifest.styles.file]),
    ...Object.values(manifest.contributes?.messages ?? {}),
    ...(await previousChunks(outDir, id)),
  ];
}

/** Модули данных прошлой сборки: файлы `chunks/`, начинающиеся с её пометки. */
async function previousChunks(outDir: string, id: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(join(outDir, BUILT_CHUNKS_DIR));
  } catch {
    return [];
  }
  const marker = chunkMarker(id);
  const ours: string[] = [];
  for (const name of names) {
    const path = `${BUILT_CHUNKS_DIR}/${name}`;
    try {
      if ((await readFile(join(outDir, path), 'utf8')).startsWith(marker)) ours.push(path);
    } catch {
      // Каталог или нечитаемый файл — не наш: его не трогаем.
    }
  }
  return ours;
}

/** Имя файла модуля данных: по имени исходника, с номером при совпадении. */
function chunkName(source: string, taken: ReadonlySet<string>): string {
  const stem = basename(source, '.json').replace(/[^A-Za-z0-9._-]/g, '_') || 'data';
  let name = `${stem}.js`;
  for (let at = 2; taken.has(name); at += 1) name = `${stem}-${String(at)}.js`;
  return name;
}

/**
 * `await import('./data.json')` — модуль данных отдельным файлом, а не вложенный в `main.js`.
 *
 * Спецификатор подменяется путём будущего файла в `chunks/` и объявляется внешним: вместе
 * с `supported: { 'dynamic-import': false }` это даёт `require('./chunks/…')`, который
 * разрешает линковщик оболочки по набору файлов плагина. Сами файлы пишет {@link buildPlugin} —
 * здесь только учёт: исходник → имя.
 */
function lazyData(chunks: Map<string, string>): esbuild.Plugin {
  return {
    name: 'reformer-lazy-data',
    setup(build) {
      build.onResolve({ filter: /\.json$/ }, (args) => {
        if (args.kind !== 'dynamic-import' || isBareSpecifier(args.path)) return undefined;
        const source = resolve(args.resolveDir, args.path);
        let name = chunks.get(source);
        if (name === undefined) {
          name = chunkName(source, new Set(chunks.values()));
          chunks.set(source, name);
        }
        return { path: `./${BUILT_CHUNKS_DIR}/${name}`, external: true };
      });
    },
  };
}

/**
 * Освобождает в каталоге вывода место под сборку — или отказывает, ничего не тронув.
 *
 * @param dir каталог исходников
 * @param files что сборка собирается записать — пути от каталога вывода
 */
/** Суффикс импорта «текст файла строкой» — тот же, что у Vite. */
const RAW_SUFFIX = '?raw';

/**
 * `import text from './file.eta?raw'` — содержимое файла строкой.
 *
 * Только относительные пути: текст берётся из исходников самого плагина. Пакетный спецификатор
 * с `?raw` остаётся неразрешённым импортом — и сборка говорит об этом обычной ошибкой.
 */
const rawText: esbuild.Plugin = {
  name: 'reformer-raw-text',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => {
      if (isBareSpecifier(args.path)) return undefined;
      return {
        path: resolve(args.resolveDir, args.path.slice(0, -RAW_SUFFIX.length)),
        namespace: 'reformer-raw',
      };
    });
    build.onLoad({ filter: /.*/, namespace: 'reformer-raw' }, async (args) => ({
      contents: await readFile(args.path, 'utf8'),
      loader: 'text',
    }));
  },
};

async function prepareOutDir(
  outDir: string,
  dir: string,
  id: string,
  files: readonly string[]
): Promise<Finding | undefined> {
  if (relative(outDir, dir) === '') {
    return {
      code: 'output-is-source',
      message:
        `каталог вывода «${outDir}» — сам каталог исходников: манифест и точка входа сборки ` +
        'легли бы поверх исходных',
    };
  }

  let entries: string[];
  try {
    entries = await readdir(outDir);
  } catch {
    return undefined;
  }
  if (entries.length === 0) return undefined;

  const previous = await previousBuildFiles(outDir, id);
  if (previous === undefined && !isInside(outDir, dir)) {
    return {
      code: 'output-not-ours',
      message:
        `каталог вывода «${outDir}» не пуст и не содержит сборку «${id}»: ` +
        'писать в чужой каталог сборка не станет',
    };
  }

  // Рядом со сборкой может лежать что угодно — исходники, package.json пакета. Своим сборка
  // считает только то, что писала в прошлый раз.
  const ours = new Set(previous ?? []);
  for (const file of files) {
    if (ours.has(file) || !(await exists(join(outDir, file)))) continue;
    return {
      code: 'output-not-ours',
      file,
      message: `в каталоге вывода «${outDir}» уже есть «${file}», и писала его не сборка «${id}»`,
    };
  }

  const emptied = new Set<string>();
  for (const file of ours) {
    const target = resolve(outDir, file);
    if (!isInside(outDir, target)) continue;
    await rm(target, { force: true });
    for (let parent = dirname(target); isInside(outDir, parent); parent = dirname(parent)) {
      emptied.add(parent);
    }
  }
  // Опустевший каталог словарей — тоже след прошлой сборки. Непустой `rmdir` не удалит.
  for (const parent of [...emptied].sort((a, b) => b.length - a.length)) {
    await rmdir(parent).catch(() => undefined);
  }
  return undefined;
}

function buildFailure(error: unknown): Finding[] {
  const messages = (error as { errors?: esbuild.Message[] }).errors;
  if (messages === undefined || messages.length === 0) {
    return [
      { code: 'build-failed', message: error instanceof Error ? error.message : String(error) },
    ];
  }
  return messages.map((message) => ({
    code: message.detail === 'module-unavailable' ? 'module-unavailable' : 'build-failed',
    message: message.text,
    ...(message.location === null ? {} : { file: message.location.file }),
  }));
}

export async function buildPlugin(options: BuildOptions): Promise<BuildResult> {
  const dir = resolve(options.dir);
  const outDir = resolve(dir, options.outDir ?? 'dist');

  const validated = await validatePlugin(dir);
  if (!validated.ok) return fail(...validated.findings);
  const { manifest } = validated;

  /** Модули данных: исходный JSON → имя файла в `chunks/`. Наполняет {@link lazyData}. */
  const chunks = new Map<string, string>();

  let code: string;
  try {
    const result = await esbuild.build({
      absWorkingDir: dir,
      entryPoints: [join(dir, manifest.main)],
      outfile: join(outDir, BUILT_MAIN),
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'browser',
      target: 'es2020',
      // `import()` модуля рантайма обязан стать `require`: спецификатор разрешает линковщик
      // оболочки, а нативный `import('@reformer/…')` в браузере не разрешается ничем. Свои
      // модули плагина esbuild и так вкладывает — им это безразлично; отложенный JSON уезжает
      // в `chunks/` и приходит тем же `require`.
      supported: { 'dynamic-import': false },
      // Без этого каждая буква вне ASCII — шесть символов экранирования вместо двух байт.
      charset: 'utf8',
      jsx: 'automatic',
      logLevel: 'silent',
      plugins: [rawText, lazyData(chunks), runtimeModules],
    });
    const css = result.outputFiles.find((file) => file.path.endsWith('.css'));
    if (css !== undefined) {
      return fail({
        code: 'css-from-code',
        message:
          'код импортирует CSS. Стили плагина объявляются в манифесте полем «styles» — ' +
          'только такую таблицу оболочка изолирует',
      });
    }
    const js = result.outputFiles.find((file) => file.path.endsWith('.js'));
    code = js?.text ?? '';
  } catch (error) {
    return fail(...buildFailure(error));
  }

  let styles: string | undefined;
  if (manifest.styles !== undefined) {
    try {
      const result = await esbuild.build({
        absWorkingDir: dir,
        entryPoints: [join(dir, manifest.styles.file)],
        outfile: join(outDir, BUILT_STYLES),
        bundle: true,
        write: false,
        logLevel: 'silent',
      });
      styles = result.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '';
    } catch (error) {
      return fail(...buildFailure(error));
    }
  }

  // Манифест вывода — ИСХОДНЫЙ JSON с двумя заменами, а не сериализация разобранного:
  // разбор нормализует и подставляет умолчания, и автор увидел бы в сборке не свой файл.
  const raw = JSON.parse(await readFile(join(dir, PLUGIN_MANIFEST_FILE), 'utf8')) as Record<
    string,
    unknown
  >;
  raw.main = BUILT_MAIN;
  if (manifest.styles !== undefined) {
    raw.styles = { ...(raw.styles as object), file: BUILT_STYLES };
  }
  const manifestText = `${JSON.stringify(raw, null, 2)}\n`;

  const files = new Map<string, string>([
    [PLUGIN_MANIFEST_FILE, manifestText],
    [BUILT_MAIN, code],
  ]);
  if (styles !== undefined) files.set(BUILT_STYLES, styles);
  const messages: Readonly<Record<string, string>> = manifest.contributes?.messages ?? {};
  for (const file of Object.values(messages)) {
    files.set(file, await readFile(join(dir, file), 'utf8'));
  }
  for (const [source, name] of chunks) {
    let value: unknown;
    try {
      value = JSON.parse(await readFile(source, 'utf8')) as unknown;
    } catch (error) {
      return fail({
        code: 'build-failed',
        file: relative(dir, source),
        message: `модуль данных не читается как JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    // Корректный JSON — корректное выражение JS: обёртки достаточно. Первая строка — пометка
    // сборки, по ней следующая сборка узнает файл своим.
    files.set(
      `${BUILT_CHUNKS_DIR}/${name}`,
      `${chunkMarker(manifest.id)}\nmodule.exports = ${JSON.stringify(value)};\n`
    );
  }

  // Проверки выхода — ДО записи: не прошедшая их сборка не должна затирать прошлую рабочую.
  const shipped = parsePluginManifest(manifestText, { kind: 'project', dir: manifest.id });
  if (!shipped.ok) return fail(shipped.problem);
  const codeFiles = [...files.keys()].filter(isPluginCodeFile).length;
  if (codeFiles > PLUGIN_FILE_LIMIT) {
    return fail({
      code: 'too-many-files',
      message: `в сборке ${String(codeFiles)} файлов кода, оболочка читает не больше ${String(PLUGIN_FILE_LIMIT)}`,
    });
  }
  const dryRun = await dryActivate(code, manifest);
  if (dryRun.findings.length > 0) return fail(...dryRun.findings);

  const refused = await prepareOutDir(outDir, dir, manifest.id, [...files.keys()]);
  if (refused !== undefined) return fail(refused);
  for (const [path, content] of files) {
    const target = join(outDir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }

  return { ok: true, manifest, outDir, files: [...files.keys()], notices: dryRun.notices };
}
