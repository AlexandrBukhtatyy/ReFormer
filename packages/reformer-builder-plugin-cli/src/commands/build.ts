/**
 * `reformer-plugin build`: исходники плагина → каталог, который оболочка грузит как есть.
 *
 * ## Что получается
 *
 * `manifest.json` (тот же, с `main: "main.js"` и `styles.file: "styles.css"`), `main.js`,
 * `styles.css`, если стили объявлены, словари по тем же путям, что в исходниках, и отложенные
 * модули в `chunks/` — если код импортирует что-то через `import()`.
 *
 * - **Код — CommonJS.** Линковщик оболочки исполняет модули как CommonJS, и готовый JS
 *   идёт у него без транспиляции (`shell/platform/modules/loader`): собери мы ESM, оболочке
 *   пришлось бы будить транспилятор ради уже собранного файла.
 * - **Отложенный импорт кода — отдельный файл.** `await import('./engine')` — так автор говорит
 *   «это нужно не сразу»: модуль и всё, что нужно только ему, уезжают в `chunks/`, а оболочка
 *   исполняет их при первом обращении. Тяжёлый движок (редактор кода — мегабайты) перестаёт
 *   разбираться при каждом запуске ради вкладки, которую могут и не открыть. Делит код сам
 *   esbuild: модуль, нужный и `main.js`, и отложенному файлу, попадает в ОБЩИЙ чанк и существует
 *   в одном экземпляре — вложенный дважды, он раздвоил бы своё состояние (настройку загрузчика,
 *   реестр). Деление есть только у ESM, а оболочке нужен CommonJS, поэтому сборка идёт в два
 *   шага: ESM с делением, затем каждый файл переводится в CommonJS.
 * - **`import()` — вызов хост-функции.** Между шагами каждый отложенный импорт переписывается
 *   в `__reformerImport("./chunks/…")` (имя — `PLUGIN_LAZY_IMPORT` контракта). Функцию даёт
 *   оболочка: она ЧИТАЕТ файл и всё, что ему нужно, только сейчас, и исполняет в том же графе
 *   модулей. Останься импорт отложенным `require`, откладывался бы один разбор: `require`
 *   синхронен, и читать каталог плагина оболочке приходилось бы целиком при каждом запуске.
 *   Оболочке, которая функцию не даёт, хватает пролога в начале файла — запасной реализации
 *   через тот же `require`: собранный каталог остаётся самодостаточным графом CommonJS.
 * - **Граф файлов — в манифесте.** Секция `build` называет каждый файл кода и то, что ему
 *   нужно сразу: свои файлы (`imports`) и модули оболочки (`runtime`). По ней оболочка читает
 *   при включении точку входа с её статическим замыканием, а не каталог. Отложенных рёбер
 *   в секции нет — их называет сам код в момент импорта.
 * - **Модули рантайма — внешние, ровно по списку** `PLUGIN_RUNTIME_MODULES`. Вложенная копия
 *   React или ядра форм — второй экземпляр и тихая поломка. Импорт `@reformer/*` или
 *   `@builder/*`, которого в списке нет, — ОТКАЗ сборки: вложить его нельзя (тот же второй
 *   экземпляр), а оставить внешним — значит плагин, падающий на спецификаторе при загрузке.
 * - **Помощники печати — вкладываются** (`PLUGIN_BUNDLED_PACKAGES`, это `@reformer/builder-toolkit`):
 *   чистые функции без синглтонов, которых оболочка не подставляет. Код домена (ядро ReFormer)
 *   пакетом больше не бывает и не вкладывается: чужой домен расширяют возможностями.
 * - **CSS из кода — отказ, пока не разрешён явно.** Стили плагина объявляются в манифесте
 *   (`styles`), и только тогда оболочка их изолирует. Импорт `.css` из кода дал бы таблицу,
 *   о которой манифест молчит. С `bundleCss` (`--bundle-css`) такой CSS — свой и зависимостей —
 *   собирается и дописывается в объявленную таблицу: так плагин везёт стороннюю библиотеку,
 *   чьи модули сами импортируют свои стили. Таблица при этом обязана быть объявлена.
 * - **Шрифты и картинки — внутри.** Файл, на который ссылается CSS (`url(./icons.ttf)`),
 *   вкладывается data-URL: сборка плагина — набор текстовых файлов, и отдельно лежащий шрифт
 *   оболочка не прочла бы.
 * - **`?worker` — воркер отдельной сборкой**, как у Vite: `import Worker from './x.worker?worker'`
 *   даёт конструктор. Код воркера собирается самостоятельным файлом (в воркере нет линковщика
 *   оболочки, поэтому вложено всё), кладётся в сборку текстом и запускается из Blob-URL.
 * - **Сжатие — по требованию.** `minify` (`--minify`) сжимает код, воркеры и стили: сборке
 *   в поставку это вдвое меньше байт, сборке на месте — нечитаемый стек, поэтому не умолчание.
 * - **`?raw` — текст файла строкой**, как у Vite: `import tpl from './form.eta?raw'`. Так плагин
 *   держит шаблоны кодогенерации файлами, а не строками в коде; в `main.js` текст вложен.
 * - **Отложенный импорт JSON — отдельный файл.** `await import('./corpus.json')` — так автор
 *   говорит «эти данные нужны не сразу». Вложенные в `main.js`, они разбирались бы движком при
 *   каждой загрузке плагина, даже когда до них дело не дойдёт: мегабайты данных — мегабайты
 *   разбора. Поэтому такой JSON уезжает модулем в `chunks/<имя>.js`, а в `main.js` остаётся
 *   вызов хост-функции — оболочка прочтёт и исполнит модуль при первом обращении. Статический
 *   `import data from './a.json'` вкладывается, как и раньше. Имя такого файла — по имени
 *   исходника, без хэша: данные меняются чаще кода, и стабильное имя не плодит файлов.
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
 * этого же плагина (тот же `id` и `main: "main.js"`), и отложенные модули в `chunks/`,
 * помеченные её первой строкой. Каталог целиком она не стирает никогда — в нём может лежать больше, чем
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
import { basename, dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';

import {
  isBundledPluginModule,
  isPluginCodeFile,
  parsePluginManifest,
  PLUGIN_BUILD_FORMAT,
  PLUGIN_FILE_LIMIT,
  PLUGIN_LAZY_IMPORT,
  PLUGIN_MANIFEST_FILE,
  PLUGIN_RUNTIME_MODULES,
  type PluginBuildFile,
  type PluginSourceManifest,
} from '@reformer/builder-plugin-api/tooling';
import { init as initLexer, parse as parseModule } from 'es-module-lexer';
import * as esbuild from 'esbuild';

import { dryActivate } from './dry-run.js';
import type { Finding } from './findings.js';
import { validatePlugin } from './validate.js';

export interface BuildOptions {
  /** Каталог исходников плагина (с `manifest.json`). */
  readonly dir: string;
  /** Куда класть сборку; умолчание — `dist` в каталоге исходников. */
  readonly outDir?: string;
  /** Сжать код, воркеры и стили. Для сборки в поставку; по умолчанию выключено. */
  readonly minify?: boolean;
  /**
   * Собрать CSS, который импортирует код (свой и зависимостей), в объявленную таблицу стилей.
   * Без этого импорт CSS из кода — отказ.
   */
  readonly bundleCss?: boolean;
}

export type BuildResult =
  | {
      readonly ok: true;
      readonly manifest: PluginSourceManifest;
      readonly outDir: string;
      readonly files: readonly string[];
      /**
       * Сколько кода оболочка прочтёт при включении плагина и сколько — когда до него дойдёт
       * дело; байты. «Сразу» — точка входа и её статическое замыкание.
       */
      readonly code: {
        readonly eager: number;
        readonly deferred: number;
        readonly deferredFiles: number;
      };
      /** Проверки, которые не удалось довести до конца вне оболочки. Не отказы. */
      readonly notices: readonly string[];
    }
  | { readonly ok: false; readonly findings: readonly Finding[] };

/** Имена, под которыми сборка кладёт код и стили. */
const BUILT_MAIN = 'main.js';
const BUILT_STYLES = 'styles.css';

/** Каталог отложенных модулей — кода и JSON, которые код импортирует через `import()`. */
const BUILT_CHUNKS_DIR = 'chunks';

/**
 * Первая строка отложенного модуля. По ней сборка узнаёт СВОИ файлы в `chunks/`: манифест их
 * не называет, а удалять по одному имени каталога значило бы стереть чужой файл.
 */
const chunkMarker = (id: string): string => `/* @reformer-plugin-chunk ${id} */`;

/** Пометка прежних сборок: ею были помечены модули данных. Нужна, чтобы убрать их за собой. */
const legacyChunkMarker = (id: string): string => `/* @reformer-plugin-data ${id} */`;

/**
 * Файлы, на которые ссылается CSS, — вкладываются data-URL: сборка плагина состоит из текста,
 * и отдельно лежащий шрифт оболочка не прочла бы.
 */
const ASSET_LOADERS: Readonly<Record<string, esbuild.Loader>> = {
  '.ttf': 'dataurl',
  '.otf': 'dataurl',
  '.woff': 'dataurl',
  '.woff2': 'dataurl',
  '.svg': 'dataurl',
  '.png': 'dataurl',
  '.gif': 'dataurl',
  '.jpg': 'dataurl',
  '.jpeg': 'dataurl',
  '.webp': 'dataurl',
};

const fail = (...findings: Finding[]): BuildResult => ({ ok: false, findings });

/** Спецификатор пакета — не путь: ни относительный, ни абсолютный (в том числе `D:\`). */
function isBareSpecifier(path: string): boolean {
  return !path.startsWith('.') && !path.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(path);
}

/**
 * Модули рантайма — внешние; вкладываемые пакеты — вкладываются; прочее `@reformer/*` — отказ
 * с объяснением.
 */
/**
 * @param requiredByCall сюда записываются модули рантайма, названные вызовом `require()` —
 *   из вложенной CommonJS-зависимости. См. {@link warmHints}.
 */
const runtimeModules = (requiredByCall: Set<string>): esbuild.Plugin => ({
  name: 'reformer-runtime-modules',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point' || !isBareSpecifier(args.path)) return undefined;
      if (PLUGIN_RUNTIME_MODULES.includes(args.path)) {
        if (args.kind === 'require-call') requiredByCall.add(args.path);
        return { path: args.path, external: true };
      }
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
});

/**
 * Подсказки прогрева: модули рантайма, которые в собранном коде названы не словом `require`.
 *
 * Оболочка, читающая каталог плагина целиком (плагин проекта; любая оболочка старше секции
 * `build`), узнаёт, какие модули плагину подставить, по тексту его файлов — ищет
 * `require("…")`. Двух видов обращений она так не видит: вложенная CommonJS-зависимость,
 * зовущая `require('react')`, в ESM-сборке получает этот вызов через помощника esbuild под
 * другим именем, а отложенный импорт пакета стал вызовом хост-функции. Модуль остался бы
 * непрогретым, и плагин упал бы на первом же обращении. Строка ниже называет такой модуль
 * оболочке и ничего не исполняет.
 *
 * Оболочке, читающей по секции `build`, подсказки не нужны и ею не читаются: что греть сразу,
 * говорят списки `runtime`, а отложенный пакет она греет в момент импорта.
 */
function warmHints(specifiers: ReadonlySet<string>): string {
  return [...specifiers]
    .sort()
    .map((specifier) => `void 0 && require(${JSON.stringify(specifier)});\n`)
    .join('');
}

/** Отложенные импорты файла, переписанные в вызовы хост-функции. */
interface DeferredImports {
  readonly code: string;
  /** Цели в порядке появления: путь от корня плагина с `./` либо имя пакета. */
  readonly targets: readonly string[];
}

/**
 * Переписывает `import("…")` файла сборки в вызов хост-функции оболочки.
 *
 * По диапазонам лексера, а не поиском подстроки: строка, похожая на импорт, внутри данных
 * (текст справки, шаблон кода) у лексера остаётся строкой. Цель называется путём ОТ КОРНЯ
 * плагина: хост-функция одна на весь граф и не знает, из какого файла её позвали.
 *
 * Не трогаются вычисляемый спецификатор — читать заранее по нему нечего — и импорт со вторым
 * аргументом. Первый esbuild в граф не вносит. Второго в его выводе не бывает: атрибуты импорта
 * он под целевую версию снимает сам (`with { type: 'json' }`) либо отвергает; уцелей такой
 * импорт, сборка отказала бы на сверке с графом, а не отложила бы его молча наполовину.
 *
 * @param path путь файла от корня плагина
 * @param isDataModule спецификатор назван сборкой и уже считается от корня (см. {@link lazyData})
 */
function deferImports(
  code: string,
  path: string,
  isDataModule: (specifier: string) => boolean
): DeferredImports {
  const [imports] = parseModule(code, path);
  const targets: string[] = [];
  let out = '';
  let at = 0;
  for (const item of imports) {
    // `d` — позиция скобки у `import()`; у статического импорта и `import.meta` она меньше нуля.
    if (item.d < 0 || item.n === undefined || item.a > -1) continue;
    const target =
      isBareSpecifier(item.n) || isDataModule(item.n)
        ? item.n
        : `./${posix.join(posix.dirname(path), item.n)}`;
    targets.push(target);
    // Выражение заменяется целиком, вместе со скобками: комментарий внутри `import()` esbuild
    // сохраняет, и вызов остался бы разорванным на строки.
    out += `${code.slice(at, item.ss)}${PLUGIN_LAZY_IMPORT}(${JSON.stringify(target)})`;
    at = item.se;
  }
  return { code: out + code.slice(at), targets };
}

/** Вызов хост-функции с этой целью в тексте есть — в любых кавычках, какие выбрал сжиматель. */
function hasLazyCall(code: string, target: string): boolean {
  return ['"', "'", '`'].some((quote) =>
    code.includes(`${PLUGIN_LAZY_IMPORT}(${quote}${target}${quote})`)
  );
}

/**
 * Пролог файла с отложенными импортами: хост-функция оболочки, а без неё — запасная.
 *
 * Оболочка подставляет функцию параметром модуля (лексически, как `require`), и `var` с тем же
 * именем параметр не затирает. Нет параметра — оболочка старше секции `build` или это пробный
 * запуск сборщика: каталог плагина прочитан целиком, и отложенный импорт исполняется тем же
 * `require`, что и раньше. Цель названа от корня плагина, `require` считает путь от своего
 * файла — отсюда поправка на глубину.
 *
 * Обёртка экспортов — дословно `__toESM` esbuild: модуль с `__esModule` отдаёт свои экспорты,
 * любой другой (данные, CommonJS) ещё и `default`. Ровно это получал код, пока импорт был
 * отложенным `require`, и ровно это же делает хост-функция оболочки.
 */
function lazyImportProlog(path: string): string {
  const depth = path.split('/').length - 1;
  const up = depth === 0 ? './' : '../'.repeat(depth);
  const name = PLUGIN_LAZY_IMPORT;
  return (
    `var ${name} = typeof ${name} === "function" ? ${name} : function (path) { ` +
    'return Promise.resolve().then(function () { ' +
    `var mod = require(path.charAt(0) === "." ? ${JSON.stringify(up)} + path.slice(2) : path); ` +
    'var target = mod != null ? Object.create(Object.getPrototypeOf(mod)) : {}; ' +
    'if (!mod || !mod.__esModule) ' +
    'Object.defineProperty(target, "default", { value: mod, enumerable: true }); ' +
    'if (mod && typeof mod === "object" || typeof mod === "function") ' +
    'Object.getOwnPropertyNames(mod).forEach(function (key) { ' +
    'if (Object.prototype.hasOwnProperty.call(target, key)) return; ' +
    'var desc = Object.getOwnPropertyDescriptor(mod, key); ' +
    'Object.defineProperty(target, key, { get: function () { return mod[key]; }, ' +
    'enumerable: !desc || desc.enumerable }); ' +
    '}); return target; }); };\n'
  );
}

/** Файлы, которые нужны файлу сразу, — он сам и всё, что он требует статически. */
function eagerClosure(
  entry: string,
  graph: Readonly<Record<string, PluginBuildFile>>
): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue = [entry];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (seen.has(path) || graph[path] === undefined) continue;
    seen.add(path);
    queue.push(...(graph[path].imports ?? []));
  }
  return seen;
}

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

/** Отложенные модули прошлой сборки: файлы `chunks/`, начинающиеся с её пометки. */
async function previousChunks(outDir: string, id: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(join(outDir, BUILT_CHUNKS_DIR));
  } catch {
    return [];
  }
  const markers = [chunkMarker(id), legacyChunkMarker(id)];
  const ours: string[] = [];
  for (const name of names) {
    const path = `${BUILT_CHUNKS_DIR}/${name}`;
    try {
      const head = await readFile(join(outDir, path), 'utf8');
      if (markers.some((marker) => head.startsWith(marker))) ours.push(path);
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
 * Спецификатор подменяется путём будущего файла в `chunks/` — ОТ КОРНЯ плагина, из какого бы
 * файла ни шёл импорт, — и объявляется внешним: {@link deferImports} превращает такой импорт
 * в вызов хост-функции с этим же путём. Сами файлы пишет {@link buildPlugin} — здесь только
 * учёт: исходник → имя.
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

/** Суффикс импорта «воркер конструктором» — тот же, что у Vite. */
const WORKER_SUFFIX = '?worker';

/** Ошибки вложенной сборки — в том виде, в каком их ждёт esbuild от плагина. */
function nestedErrors(error: unknown): esbuild.PartialMessage[] {
  const messages = (error as { errors?: esbuild.Message[] }).errors;
  if (messages === undefined || messages.length === 0) {
    return [{ text: error instanceof Error ? error.message : String(error) }];
  }
  return messages.map((message) => ({ text: message.text, location: message.location }));
}

/**
 * `import Worker from './x.worker?worker'` — конструктор воркера.
 *
 * Воркер собирается отдельной самостоятельной сборкой: в его потоке нет линковщика оболочки,
 * поэтому вкладывается всё, и модули рантайма тоже — у воркера своя область, и «второй
 * экземпляр» там единственный. Текст кладётся строкой в тот модуль, который воркер импортировал
 * (при отложенном импорте — в его чанк), и запускается из Blob-URL: отдельного адреса у файла
 * плагина нет — оболочка читает сборку текстом, откуда бы та ни пришла.
 *
 * Адрес заводится один на вид воркера и живёт до конца страницы: воркеров создают по нескольку,
 * а отзывать адрес сразу после `new Worker` нельзя — скрипт по нему ещё не загружен.
 */
function workers(options: { readonly minify: boolean }): esbuild.Plugin {
  return {
    name: 'reformer-workers',
    setup(build) {
      build.onResolve({ filter: /\?worker$/ }, async (args) => {
        const resolved = await build.resolve(args.path.slice(0, -WORKER_SUFFIX.length), {
          kind: 'import-statement',
          resolveDir: args.resolveDir,
          importer: args.importer,
        });
        if (resolved.errors.length > 0) return { errors: resolved.errors };
        if (resolved.external) {
          return {
            errors: [
              {
                text: `воркер «${args.path}» — модуль рантайма оболочки: отдельным файлом его не собрать`,
              },
            ],
          };
        }
        return { path: resolved.path, namespace: 'reformer-worker' };
      });
      build.onLoad({ filter: /.*/, namespace: 'reformer-worker' }, async (args) => {
        let source: string;
        try {
          const built = await esbuild.build({
            entryPoints: [args.path],
            bundle: true,
            write: false,
            format: 'iife',
            platform: 'browser',
            target: 'es2020',
            charset: 'utf8',
            minify: options.minify,
            logLevel: 'silent',
          });
          source = built.outputFiles[0]?.text ?? '';
        } catch (error) {
          return { errors: nestedErrors(error) };
        }
        return {
          contents: [
            `const source = ${JSON.stringify(source)};`,
            'let url;',
            'export default function PluginWorker(options) {',
            "  if (url === undefined) url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));",
            '  return new Worker(url, options);',
            '}',
          ].join('\n'),
          loader: 'js',
        };
      });
    },
  };
}

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

  const minify = options.minify === true;

  /** Модули данных: исходный JSON → имя файла в `chunks/`. Наполняет {@link lazyData}. */
  const chunks = new Map<string, string>();
  /** Модули рантайма, названные вызовом `require()` из вложенной зависимости. */
  const requiredByCall = new Set<string>();

  /** Собранный код: путь от каталога вывода → текст CommonJS. */
  const scripts = new Map<string, string>();
  /** Граф файлов кода — секция `build` манифеста: что каждому файлу нужно сразу. */
  const graph: Record<string, PluginBuildFile> = {};
  /** CSS, который импортирует код, — одной таблицей. */
  let codeStyles: string | undefined;
  try {
    // Шаг первый: ESM с делением. Отложенный `import()` своего модуля даёт файл в `chunks/`,
    // общий для двух файлов код — общий чанк (см. шапку модуля).
    const result = await esbuild.build({
      absWorkingDir: dir,
      entryPoints: [{ in: join(dir, manifest.main), out: 'main' }],
      outdir: outDir,
      bundle: true,
      splitting: true,
      write: false,
      metafile: true,
      format: 'esm',
      chunkNames: `${BUILT_CHUNKS_DIR}/[name]-[hash]`,
      platform: 'browser',
      target: 'es2020',
      // Без этого каждая буква вне ASCII — шесть символов экранирования вместо двух байт.
      charset: 'utf8',
      jsx: 'automatic',
      minify,
      loader: ASSET_LOADERS,
      logLevel: 'silent',
      plugins: [rawText, workers({ minify }), lazyData(chunks), runtimeModules(requiredByCall)],
    });

    const pathOf = (file: esbuild.OutputFile): string =>
      relative(outDir, file.path).split('\\').join('/');
    const sheets = result.outputFiles.filter((file) => file.path.endsWith('.css'));
    if (sheets.length > 0) {
      if (options.bundleCss !== true) {
        return fail({
          code: 'css-from-code',
          message:
            'код импортирует CSS. Стили плагина объявляются в манифесте полем «styles» — ' +
            'только такую таблицу оболочка изолирует. CSS сторонней библиотеки, чьи модули ' +
            'импортируют его сами, собирает в объявленную таблицу параметр --bundle-css',
        });
      }
      if (manifest.styles === undefined) {
        return fail({
          code: 'css-from-code',
          message:
            'код импортирует CSS, а манифест таблицу стилей не объявляет. С --bundle-css такой ' +
            'CSS дописывается в таблицу поля «styles» — без него оболочке нечего изолировать',
        });
      }
      // Таблица точки входа несёт CSS всего графа, включая отложенные модули; таблицы чанков —
      // её части. Сверяется по входам, а не принимается на веру: потерянное правило молчит.
      const inputsOf = (file: esbuild.OutputFile): string[] => {
        const entry = Object.entries(result.metafile.outputs).find(
          ([path]) => resolve(dir, path) === file.path
        );
        return Object.keys(entry?.[1].inputs ?? {});
      };
      const entrySheet = sheets.find((file) => pathOf(file) === 'main.css');
      const covered = new Set(entrySheet === undefined ? [] : inputsOf(entrySheet));
      const missed = sheets.flatMap(inputsOf).filter((input) => !covered.has(input));
      if (entrySheet === undefined || missed.length > 0) {
        return fail({
          code: 'build-failed',
          message:
            'CSS из кода не собрался одной таблицей: в таблице точки входа нет ' +
            (missed.length > 0 ? `«${missed[0]}»` : 'ничего'),
        });
      }
      codeStyles = entrySheet.text;
    }

    // Между шагами: отложенные импорты — в вызовы хост-функции, и заодно граф файлов. Граф
    // берётся из отчёта esbuild, а не из текста: что файлу нужно сразу, сборщик знает точно.
    await initLexer;
    const builtPath = (absolute: string): string =>
      relative(outDir, absolute).split('\\').join('/');
    const outputs = new Map(
      Object.entries(result.metafile.outputs).map(
        ([key, output]) => [builtPath(resolve(dir, key)), output] as const
      )
    );
    const dataSpecifiers = new Set(
      [...chunks.values()].map((name) => `./${BUILT_CHUNKS_DIR}/${name}`)
    );
    const rewritten: Array<{ path: string; deferred: DeferredImports }> = [];
    /** Пакеты, импортированные отложенно, — для подсказок прогрева. */
    const deferredPackages = new Set<string>();
    const attributed = new Set<string>();
    for (const file of result.outputFiles) {
      if (!file.path.endsWith('.js')) continue;
      const path = pathOf(file);
      const edges = outputs.get(path)?.imports ?? [];
      const deferred = deferImports(file.text, path, (specifier) => dataSpecifiers.has(specifier));

      // Сверка с отчётом сборщика: переписано ровно то, что он считает отложенным. Расхождение
      // значит импорт, который останется `require` на непрочитанный файл, — у человека это
      // выглядело бы как «файл не найден» при первом открытии, а не при сборке.
      const expected = edges
        .filter((edge) => edge.kind === 'dynamic-import')
        .map((edge) =>
          edge.external === true ? edge.path : `./${builtPath(resolve(dir, edge.path))}`
        );
      const stray = [
        ...expected.filter((target) => !deferred.targets.includes(target)),
        ...deferred.targets.filter((target) => !expected.includes(target)),
      ];
      if (stray.length > 0) {
        return fail({
          code: 'build-failed',
          file: path,
          message:
            `отложенный импорт «${stray[0]}» в «${path}» не сошёлся с отчётом сборщика: ` +
            'перевести его в вызов оболочки нельзя',
        });
      }

      const imports = edges
        .filter((edge) => edge.kind === 'import-statement' && edge.external !== true)
        .map((edge) => builtPath(resolve(dir, edge.path)));
      const runtime = edges
        .filter(
          (edge) =>
            edge.external === true &&
            (edge.kind === 'import-statement' || edge.kind === 'require-call') &&
            isBareSpecifier(edge.path)
        )
        .map((edge) => edge.path);
      for (const specifier of runtime) attributed.add(specifier);
      graph[path] = {
        ...(imports.length === 0 ? {} : { imports: [...new Set(imports)].sort() }),
        ...(runtime.length === 0 ? {} : { runtime: [...new Set(runtime)].sort() }),
      };
      for (const target of deferred.targets) {
        if (isBareSpecifier(target)) deferredPackages.add(target);
      }
      rewritten.push({ path, deferred });
    }
    // `require()` из вложенной зависимости, который отчёт не отнёс ни к одному файлу, нужен
    // неизвестно кому — значит, сразу.
    const orphans = [...requiredByCall].filter((specifier) => !attributed.has(specifier));
    if (orphans.length > 0 && graph[BUILT_MAIN] !== undefined) {
      graph[BUILT_MAIN] = {
        ...graph[BUILT_MAIN],
        runtime: [...new Set([...(graph[BUILT_MAIN].runtime ?? []), ...orphans])].sort(),
      };
    }

    // Шаг второй: каждый файл — в CommonJS. Нативный `import()` в собранном остаться не может:
    // `import('@reformer/…')` в браузере не разрешается ничем. Литеральные уже стали вызовами
    // хост-функции, вычисляемый здесь превращается в отложенный `require`.
    for (const { path, deferred } of rewritten) {
      const converted = await esbuild.transform(deferred.code, {
        loader: 'js',
        format: 'cjs',
        target: 'es2020',
        charset: 'utf8',
        supported: { 'dynamic-import': false },
        minify,
        logLevel: 'silent',
      });
      const lost = deferred.targets.find((target) => !hasLazyCall(converted.code, target));
      if (lost !== undefined) {
        return fail({
          code: 'build-failed',
          file: path,
          message: `вызов оболочки для отложенного импорта «${lost}» потерян при переводе в CommonJS`,
        });
      }
      // Пролог и подсказки дописываются ПОСЛЕ перевода: сжиматель их не трогает, а имя
      // хост-функции остаётся тем, которое знает оболочка. Директива строгого режима обязана
      // остаться первой — иначе модуль, написанный как ESM, исполнился бы нестрогим.
      const head =
        (deferred.targets.length > 0 ? lazyImportProlog(path) : '') +
        (path === BUILT_MAIN ? warmHints(new Set([...requiredByCall, ...deferredPackages])) : '');
      const code = head === '' ? converted.code : `"use strict";\n${head}${converted.code}`;
      scripts.set(path, path === BUILT_MAIN ? code : `${chunkMarker(manifest.id)}\n${code}`);
    }
  } catch (error) {
    return fail(...buildFailure(error));
  }
  const code = scripts.get(BUILT_MAIN) ?? '';

  let styles: string | undefined;
  if (manifest.styles !== undefined) {
    try {
      const result = await esbuild.build({
        absWorkingDir: dir,
        entryPoints: [join(dir, manifest.styles.file)],
        outfile: join(outDir, BUILT_STYLES),
        bundle: true,
        write: false,
        minify,
        loader: ASSET_LOADERS,
        logLevel: 'silent',
      });
      const declared = result.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '';
      // CSS из кода — первым: объявленная таблица написана автором плагина и вправе его
      // перекрывать на равной специфичности.
      styles = [codeStyles, declared]
        .filter((part) => part !== undefined && part !== '')
        .join('\n');
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
  // Модуль данных никого не требует, но в графе назван: оболочка читает только названное.
  for (const name of chunks.values()) graph[`${BUILT_CHUNKS_DIR}/${name}`] = {};
  const graphPaths = Object.keys(graph).sort(
    (a, b) => Number(b === BUILT_MAIN) - Number(a === BUILT_MAIN) || a.localeCompare(b, 'en')
  );
  raw.build = {
    format: PLUGIN_BUILD_FORMAT,
    files: Object.fromEntries(graphPaths.map((path) => [path, graph[path]])),
  };
  const manifestText = `${JSON.stringify(raw, null, 2)}\n`;

  const files = new Map<string, string>([[PLUGIN_MANIFEST_FILE, manifestText], ...scripts]);
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
  const dryRun = await dryActivate(code, manifest, files);
  if (dryRun.findings.length > 0) return fail(...dryRun.findings);

  const refused = await prepareOutDir(outDir, dir, manifest.id, [...files.keys()]);
  if (refused !== undefined) return fail(refused);
  for (const [path, content] of files) {
    const target = join(outDir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }

  const eager = eagerClosure(BUILT_MAIN, graph);
  const size = (paths: readonly string[]): number =>
    paths.reduce((sum, path) => sum + Buffer.byteLength(files.get(path) ?? '', 'utf8'), 0);
  const deferredPaths = graphPaths.filter((path) => !eager.has(path));
  return {
    ok: true,
    manifest,
    outDir,
    files: [...files.keys()],
    code: {
      eager: size([...eager]),
      deferred: size(deferredPaths),
      deferredFiles: deferredPaths.length,
    },
    notices: dryRun.notices,
  };
}
