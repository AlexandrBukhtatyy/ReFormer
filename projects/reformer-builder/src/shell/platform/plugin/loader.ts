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
 * ## Собранный плагин читается по графу, а не каталогом
 *
 * `require` синхронен, и всё, до чего он дотянется, обязано быть прочитано до линковки. Долго
 * это значило «каталог плагина целиком»: редактор кода — четыре мегабайта, которые читались
 * при каждом запуске ради вкладки, которую могут и не открыть. Сборщик пишет в манифест секцию
 * `build` — граф файлов, — и по ней читается точка входа с её статическим замыканием. Остальное
 * дочитывает хост-функция отложенного импорта, когда код до него дойдёт
 * (`platform/modules/loader`, `LazyLoad`).
 *
 * Так читается только слой, которому это разрешено ({@link PluginLoaderDeps.onDemand}), —
 * плагины приложения: их файлы лежат рядом с приложением и никуда не денутся. Каталог проекта
 * читается целиком, как и раньше: проект закрывают и меняют, плагин в нём правят на ходу,
 * и дочитать через минуту можно было бы уже другой файл. Хост-функцию при этом получают оба:
 * собраны они одним сборщиком.
 *
 * ## Отказы — данные
 *
 * Ни один метод не бросает из-за плагина: испорченный манифест, отсутствующая точка входа
 * и падение при исполнении — обычные состояния каталога, который человек правит руками.
 * Все они возвращаются как {@link PluginProblem} и доходят до списка плагинов. Бросить может
 * только источник, и только на том, что к конкретному плагину не относится (каталог не читается
 * целиком) — это уже отказ проекта, а не плагина.
 *
 * @module shell/platform/plugin/loader
 */

import type { LazyLoad, ModuleLoader } from '@/shell/platform/modules/loader';
import { joinPath } from '@reformer/builder-plugin-api/internal';
import { traced, traceSpan } from '@/shell/platform/primitives/trace';
import { isSourceError } from '@/shell/platform/source/errors';
import type { Entry } from '@/shell/platform/source/types';
import {
  isPluginCodeFile,
  parseMessagesBundle,
  parsePluginManifest,
  pluginFromExports,
  PLUGIN_CATALOG_DIR,
  PLUGIN_CODE_EXTENSIONS,
  PLUGIN_FILE_LIMIT,
  PLUGIN_SKIPPED_DIRS,
} from '@reformer/builder-plugin-api/internal';
import {
  PLUGIN_MANIFEST_FILE,
  type PluginBuildInfo,
  type PluginProblem,
  type PluginProblemCode,
  type ProjectPluginManifest,
} from '@reformer/builder-plugin-api/internal';
import type { Plugin } from '@reformer/builder-plugin-api/internal';
import { BUILDER_VERSION } from '@/shell/platform/version';

/**
 * Найденный в каталоге плагин.
 *
 * `manifest` и `problem` взаимоисключающи, но оба необязательны в типе намеренно: список
 * плагинов показывает и то и другое одинаковой строкой, и разбор объединения ради этого
 * ничего бы не дал.
 */
export interface DiscoveredPlugin {
  /**
   * Идентификатор. У плагина верхнего уровня он же имя каталога — совпадение проверено при
   * разборе манифеста; у плагина из каталога домена — объявленный манифестом. У битого, чей
   * манифест не прочитан, — путь каталога от каталога плагинов (`<домен>/<плагин>`).
   */
  readonly id: string;
  /** Путь каталога плагина внутри источника. */
  readonly dir: string;
  readonly manifest?: ProjectPluginManifest;
  readonly problem?: PluginProblem;
}

/** Плагин, готовый к регистрации: объект из его точки входа плюс манифест. */
export interface LoadedPlugin {
  readonly manifest: ProjectPluginManifest;
  readonly plugin: Plugin;
  /**
   * Файлы, прочитанные при загрузке, — путями внутри каталога плагина. Для диагностики.
   * У плагина, читаемого по графу сборки, это точка входа и её замыкание, а не весь каталог.
   */
  readonly files: readonly string[];
  /**
   * Выгружает граф модулей плагина: отложенный импорт после этого отказывает.
   *
   * Зовёт каталог, когда плагин выключен или заменён перезагрузкой. Без этого чтение, начатое
   * до выключения, закончилось бы исполнением кода плагина, которого уже нет.
   */
  readonly dispose?: () => void;
  /**
   * Дочитывает отложенный код плагина, не исполняя его. Есть только у плагина, читаемого
   * по графу сборки: у остальных каталог уже прочитан целиком.
   *
   * Зовёт каталог в простое после запуска — чтобы первый открытый файл не ждал чтения движка
   * редактора, а остановленный сервер не ломал уже открытое приложение.
   */
  readonly preload?: () => Promise<void>;
  /**
   * Текст объявленной таблицы стилей, если она объявлена. Уже прочитан, но ещё НЕ установлен:
   * ставить его в документ — дело активации, а загрузка активацией не является (см. `load`).
   * Установка — `installPluginStyles` из `./styles`.
   */
  readonly styles?: { readonly css: string; readonly isolation: 'scoped' };
  /**
   * Прочитанные словари: локаль → «ключ → сообщение». Как и стили, уже прочитаны, но ещё
   * никуда не внесены — вносит их каталог после успешной активации (`./catalog`).
   */
  readonly messages?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export type PluginLoadResult =
  | { readonly ok: true; readonly loaded: LoadedPlugin }
  | { readonly ok: false; readonly problem: PluginProblem };

/**
 * Откуда загрузчик берёт файлы плагинов — РОВНО то, чем он пользуется у источника.
 *
 * Порт, а не `Source`, потому что источников таких два: каталог открытого проекта и слой
 * установленных из npm (`./installed`). Второй — не транспорт до чужой папки: у него нет
 * ни дескриптора, ни записи, ни ревизий, и требовать от него весь `Source` значило бы
 * заставить его врать о десятке членов ради четырёх используемых. Настоящий `Source`
 * этот порт удовлетворяет структурно, поэтому каталог проекта передаётся как был.
 */
export interface PluginFilesSource {
  /** Имя в сообщениях об отказе: человек должен понимать, о каком слое речь. */
  readonly id: string;
  readonly capabilities: { readonly executesCode: boolean };
  read(path: string): Promise<{ readonly text: string }>;
  list(dir: string): Promise<readonly Entry[]>;
}

export interface PluginLoaderDeps {
  /**
   * Откуда читать плагины. Функция, а не объект: проект открывают, закрывают и меняют,
   * а загрузчик живёт дольше любого из них. `null` — читать нечего.
   */
  readonly source: () => PluginFilesSource | null;
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
  /**
   * Прогрев ЛЕНИВЫХ модулей оболочки, которые импортируют файлы плагина (`@reformer/cdk/*`,
   * `@reformer/ui-kit`…). Реестр отдаёт такой модуль синхронно только после прогрева, а `require`
   * исполняется синхронно: без этого шага верхнеуровневый импорт в коде плагина падал бы отказом
   * `cold`, хотя модуль оболочке известен. Кит-плагин упирается в это первым — его обёртка поля
   * стоит на `@reformer/cdk/form-field`.
   */
  readonly warm?: (files: ReadonlyMap<string, string>) => Promise<void>;
  /**
   * Тот же прогрев по ИМЕНАМ модулей — для плагина, читаемого по графу сборки: что ему нужно,
   * называет манифест (`build.files[…].runtime`), и искать импорты в тексте незачем. Заодно
   * отложенно импортированный пакет перестаёт греться при запуске: в списках его нет.
   */
  readonly warmNamed?: (specifiers: readonly string[]) => Promise<void>;
  /**
   * Читать собранный плагин по графу из манифеста: при загрузке — точку входа и то, что она
   * требует статически, остальное — по отложенному импорту.
   *
   * Включается только для слоя, чьи файлы не меняются под работающим плагином (см. шапку
   * модуля). Плагин без секции `build` читается целиком при любом значении.
   */
  readonly onDemand?: boolean;
  /**
   * Отложенный импорт плагина не удался — после всех повторов чтения. Плагин при этом работает
   * дальше; человеку об этом скажет каталог.
   */
  readonly onLazyError?: (pluginId: string, error: unknown) => void;
  /**
   * Паузы между попытками дочитать файл по отложенному импорту, мс; попыток на одну больше.
   * Параметр ради тестов.
   */
  readonly lazyRetryDelays?: readonly number[];
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
  /**
   * Начинает читать файлы плагина заранее — код, стили, словари — и ничего не исполняет.
   *
   * Каталог включает плагины по одному: требования, права, линковка и активация идут строго
   * по порядку. Но ЧТЕНИЕ порядка не требует, и ждать его по очереди значит платить за каждый
   * файл отдельным кругом сети. Вызванная для всех включённых перед циклом, предзагрузка
   * превращает тринадцать очередей в одну.
   *
   * Прочитанное достаётся следующему {@link load} того же найденного плагина и только ему:
   * повторное включение читает заново — файл на диске мог измениться.
   */
  prefetch?(found: DiscoveredPlugin): void;
}

/** Исход чтения, который не отклоняется: отказ — значение, и разбирает его тот, кто ждёт. */
type Settled<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown };

function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  );
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

/**
 * Паузы между попытками отложенного чтения. Две короткие: сетевая икота проходит за секунду,
 * а человек, открывший файл, дольше ждать пустую вкладку не станет — ему честнее отказ.
 */
const LAZY_RETRY_DELAYS: readonly number[] = [300, 1200];

/** Файл назван секцией сборки. Сверка по собственным ключам: путь приходит из кода плагина. */
const namedIn = (build: PluginBuildInfo, path: string): boolean =>
  Object.prototype.hasOwnProperty.call(build.files, path);

/** Файлы и всё, что они требуют статически, — по секции сборки. */
function buildClosure(build: PluginBuildInfo, roots: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (namedIn(build, path)) queue.push(...(build.files[path].imports ?? []));
  }
  return [...seen];
}

/** Модули оболочки, которые нужны этим файлам при исполнении. */
function runtimeOf(build: PluginBuildInfo, paths: readonly string[]): readonly string[] {
  const names = new Set<string>();
  for (const path of paths) {
    if (!namedIn(build, path)) continue;
    for (const name of build.files[path].runtime ?? []) names.add(name);
  }
  return [...names];
}

const isManifestFile = (entry: Entry): boolean =>
  entry.kind === 'file' && entry.name === PLUGIN_MANIFEST_FILE;

/**
 * Каталог исходников пакета плагина, собираемого на месте: `<плагин>/src/manifest.json` — манифест
 * для сборки, а собранный лежит в корне каталога плагина (см. `reformer-plugin build src --out .`).
 */
const PLUGIN_SOURCES_DIR = 'src';

/** `package.json` в каталоге без манифеста: пакет плагина, который не собрали, а не каталог домена. */
const PACKAGE_FILE = 'package.json';

/** Манифест каталога: текст — или почему его нет. */
type ManifestRead =
  | { readonly text: string }
  | { readonly text?: undefined; readonly missing: boolean; readonly error: unknown };

async function readManifest(source: PluginFilesSource, pluginDir: string): Promise<ManifestRead> {
  try {
    return { text: (await source.read(joinPath(pluginDir, PLUGIN_MANIFEST_FILE))).text };
  } catch (error) {
    return { missing: isSourceError(error, 'not-found'), error };
  }
}

/** Отказ «манифеста нет / он не читается» — `label` называет каталог так, как его видит человек. */
function manifestProblem(
  label: string,
  read: Extract<ManifestRead, { missing: boolean }>
): PluginProblem {
  return {
    code: read.missing ? 'manifest-missing' : 'manifest-unreadable',
    message: read.missing
      ? `в каталоге «${label}» нет ${PLUGIN_MANIFEST_FILE}`
      : `${PLUGIN_MANIFEST_FILE} не читается: ${describe(read.error)}`,
    file: PLUGIN_MANIFEST_FILE,
    cause: read.error,
  };
}

/** `id` из текста манифеста, если он там есть и это строка. Разбор целиком здесь не нужен. */
function declaredId(text: string): string | undefined {
  try {
    const id = (JSON.parse(text) as { id?: unknown }).id;
    return typeof id === 'string' && id !== '' ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Читаемые записи одного уровня. Отсутствие каталога — пустой уровень, а не отказ. */
async function listOrEmpty(source: PluginFilesSource, dir: string): Promise<readonly Entry[]> {
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
   * Начатые заранее чтения. Ключ — сам найденный плагин: новый обход каталога их не видит.
   * Объявлено здесь, а не рядом с `prefetchFound`: ниже `return` исполняются только объявления
   * функций, а `const` остался бы неинициализированным.
   */
  const prefetched = new WeakMap<DiscoveredPlugin, PluginRead>();

  /**
   * Собирает файлы плагина: путь ВНУТРИ каталога плагина → исходник.
   *
   * Обход в ширину, потому что предел проверяется до чтения: сначала выясняем, сколько файлов,
   * и только потом их читаем. Иначе каталог на тысячу файлов был бы прочитан целиком и лишь
   * затем отвергнут.
   */
  const collectFiles = async (
    source: PluginFilesSource,
    pluginDir: string
  ): Promise<
    { ok: true; files: ReadonlyMap<string, string> } | { ok: false; problem: PluginProblem }
  > => {
    const paths: string[] = [];
    const queue: string[] = [''];

    while (queue.length > 0) {
      const relative = queue.shift() as string;
      const entries = await listOrEmpty(source, joinPath(pluginDir, relative));
      // Подкаталог со своим манифестом — другое дерево: исходники пакета (`src/`) или его сборка
      // для поставки (`dist/`). Плагину, собранному в корень каталога, оно не нужно, а прочитанное
      // целиком шло бы в счёт предела файлов — у большого плагина это сотни исходников.
      if (relative !== '' && entries.some(isManifestFile)) continue;
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.kind === 'directory') {
          if (PLUGIN_SKIPPED_DIRS.includes(entry.name)) continue;
          queue.push(relative === '' ? entry.name : `${relative}/${entry.name}`);
          continue;
        }
        if (!isPluginCodeFile(entry.name)) continue;
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

  /**
   * Граф, по которому плагин читается, — либо `undefined`: читать каталог целиком.
   *
   * Точка входа обязана быть в графе названа: манифест с `main`, которого сборщик не знает, —
   * не его сборка, и верить секции тогда нечему.
   */
  const graphOf = (manifest: ProjectPluginManifest): PluginBuildInfo | undefined =>
    deps.onDemand === true && manifest.build !== undefined && namedIn(manifest.build, manifest.main)
      ? manifest.build
      : undefined;

  /**
   * Читает точку входа и её статическое замыкание — ровно то, что нужно для линковки.
   *
   * Обхода каталога нет: имена называет манифест. Отсюда и предел — он проверяется по числу
   * файлов сборки, известному до первого чтения.
   */
  const readClosure = async (
    source: PluginFilesSource,
    pluginDir: string,
    build: PluginBuildInfo,
    entry: string
  ): Promise<
    { ok: true; files: ReadonlyMap<string, string> } | { ok: false; problem: PluginProblem }
  > => {
    if (Object.keys(build.files).length > fileLimit) {
      return fail(
        'too-many-files',
        `в сборке плагина больше ${fileLimit} файлов кода: это не плагин, а чужое дерево`
      );
    }
    const paths = buildClosure(build, [entry]);
    const texts = await Promise.all(
      paths.map(async (path) => (await source.read(joinPath(pluginDir, path))).text)
    );
    const files = new Map<string, string>();
    paths.forEach((path, at) => files.set(path, texts[at]));
    return { ok: true, files };
  };

  /**
   * Чем загрузка снабжает хост-функцию отложенного импорта.
   *
   * Без графа — пусто: каталог прочитан целиком, дочитывать нечего, и импорт разрешается
   * среди прочитанного. С графом — чтение названных им файлов с того же источника.
   */
  const lazyFor = (
    source: PluginFilesSource,
    pluginDir: string,
    pluginId: string,
    build: PluginBuildInfo | undefined
  ): LazyLoad => {
    const onError = (error: unknown): void => deps.onLazyError?.(pluginId, error);
    if (build === undefined) return { onError };
    return {
      closure: (path) => buildClosure(build, [path]),
      read: (path) =>
        namedIn(build, path)
          ? traced(`plugin.lazy:${pluginId}`, () =>
              readWithRetry(source, joinPath(pluginDir, path))
            )
          : Promise.reject(new Error('секция сборки манифеста такого файла не называет')),
      prepare: (paths) => deps.warmNamed?.(runtimeOf(build, paths)) ?? Promise.resolve(),
      onError,
    };
  };

  const retryDelays = deps.lazyRetryDelays ?? LAZY_RETRY_DELAYS;

  /**
   * Чтение с повтором — только для отложенного импорта.
   *
   * При загрузке плагина отказ чтения — отказ включения: человек видит его в списке плагинов
   * и включает снова. У отложенного импорта такой кнопки нет: отказ получает компонент,
   * который обычно запоминает его навсегда. «Файла нет» не повторяется — это не сбой сети,
   * а расхождение сборки с каталогом, и вторая попытка ответит тем же.
   */
  const readWithRetry = async (source: PluginFilesSource, path: string): Promise<string> => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return (await source.read(path)).text;
      } catch (error) {
        if (isSourceError(error, 'not-found') || attempt >= retryDelays.length) throw error;
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  };

  /**
   * Плагины каталога ДОМЕНА — `<домен>/<плагин>/manifest.json`, уровнем ниже обычного.
   *
   * Домен держит рядом несколько плагинов и их общее ядро (`rjsf/core`, `rjsf/editor`,
   * `rjsf/render`). Каталог плагина назван там ролью, поэтому идентификатор берётся из манифеста,
   * а не из имени каталога.
   *
   * Домен узнаётся по тому, чего в нём НЕТ: ни манифеста, ни `package.json`. Каталог
   * с `package.json` без манифеста — пакет плагина, который не собрали: о нём сообщает вызывающий,
   * а заглядывать в его `src/` значило бы молча поднять плагин из исходников.
   *
   * Внутри домена плагин — подкаталог с манифестом. Подкаталог, где манифест есть только
   * в `src/`, — плагин домена, который не собрали: он виден строкой с причиной. Всё остальное
   * (ядро домена) плагином не является и пропускается.
   *
   * @returns `undefined` — каталог не домен: плагинов в нём нет.
   */
  const discoverDomain = async (
    source: PluginFilesSource,
    domain: string
  ): Promise<readonly DiscoveredPlugin[] | undefined> => {
    const domainDir = joinPath(dir, domain);
    const entries = await listOrEmpty(source, domainDir);
    if (entries.some((entry) => entry.kind === 'file' && entry.name === PACKAGE_FILE)) {
      return undefined;
    }

    const memberOf = async (entry: Entry): Promise<DiscoveredPlugin | undefined> => {
      if (entry.kind !== 'directory' || entry.name.startsWith('.')) return undefined;
      if (PLUGIN_SKIPPED_DIRS.includes(entry.name)) return undefined;
      const pluginDir = joinPath(domainDir, entry.name);
      const label = `${domain}/${entry.name}`;

      const read = await readManifest(source, pluginDir);
      if (read.text !== undefined) {
        const parsed = parsePluginManifest(
          read.text,
          { kind: 'project', dir: entry.name, group: domain },
          { builder: BUILDER_VERSION }
        );
        return parsed.ok
          ? { id: parsed.manifest.id, dir: pluginDir, manifest: parsed.manifest }
          : { id: declaredId(read.text) ?? label, dir: pluginDir, problem: parsed.problem };
      }
      if (!read.missing) {
        return { id: label, dir: pluginDir, problem: manifestProblem(label, read) };
      }
      const sources = await readManifest(source, joinPath(pluginDir, PLUGIN_SOURCES_DIR));
      if (sources.text === undefined) return undefined;
      return {
        id: declaredId(sources.text) ?? label,
        dir: pluginDir,
        problem: manifestProblem(label, read),
      };
    };
    // Манифесты читаются разом, а порядок записей остаётся порядком каталога: на него
    // опирается разбор совпавших идентификаторов (`withoutDuplicates`).
    const members = (await Promise.all(entries.map(memberOf))).filter(
      (member): member is DiscoveredPlugin => member !== undefined
    );
    return members.length > 0 ? members : undefined;
  };

  /**
   * Один идентификатор — один плагин. В домене идентификатор объявляет манифест, и совпасть
   * с соседом ему ничто не мешает. Второй каталог с тем же идентификатором остаётся в списке
   * отказом — под ПУТЁМ каталога вместо идентификатора: под занятым именем он затёр бы
   * в каталоге плагинов запись рабочего.
   */
  const withoutDuplicates = (found: readonly DiscoveredPlugin[]): readonly DiscoveredPlugin[] => {
    // Плагин верхнего уровня владеет своим идентификатором без спора: у него это имя каталога.
    const owners = new Map<string, string>();
    for (const item of found) {
      if (item.dir === joinPath(dir, item.id)) owners.set(item.id, item.dir);
    }
    return found.map((item) => {
      const owner = owners.get(item.id);
      if (owner === undefined || owner === item.dir) {
        owners.set(item.id, item.dir);
        return item;
      }
      return {
        id: item.dir.slice(dir.length + 1),
        dir: item.dir,
        problem: {
          code: 'id-taken',
          message: `идентификатор «${item.id}» уже занят плагином из каталога «${owner}»`,
          file: PLUGIN_MANIFEST_FILE,
        },
      };
    });
  };

  return {
    dir,

    async discover(): Promise<readonly DiscoveredPlugin[]> {
      const source = deps.source();
      if (source === null) return [];
      const discovered = traceSpan(`plugins.discover:${source.id}`);
      try {
        return await discoverIn(source);
      } finally {
        discovered();
      }
    },

    async load(found: DiscoveredPlugin): Promise<PluginLoadResult> {
      return loadFound(found);
    },

    prefetch: prefetchFound,
  };

  async function discoverIn(source: PluginFilesSource): Promise<readonly DiscoveredPlugin[]> {
    const entries = await listOrEmpty(source, dir);

    const foundIn = async (entry: Entry): Promise<readonly DiscoveredPlugin[]> => {
      // Плагин — это каталог. Файл рядом с плагинами (README, архив) молча пропускаем:
      // ошибкой это назвать не за что.
      if (entry.kind !== 'directory' || entry.name.startsWith('.')) return [];
      const pluginDir = joinPath(dir, entry.name);

      const read = await readManifest(source, pluginDir);
      if (read.text === undefined) {
        const members = read.missing ? await discoverDomain(source, entry.name) : undefined;
        return (
          members ?? [
            { id: entry.name, dir: pluginDir, problem: manifestProblem(entry.name, read) },
          ]
        );
      }

      const parsed = parsePluginManifest(
        read.text,
        { kind: 'project', dir: entry.name },
        { builder: BUILDER_VERSION }
      );
      return [
        parsed.ok
          ? { id: entry.name, dir: pluginDir, manifest: parsed.manifest }
          : { id: entry.name, dir: pluginDir, problem: parsed.problem },
      ];
    };

    // Каталоги обходятся разом: тринадцать манифестов слоя приложения — один круг сети,
    // а не тринадцать. Порядок результата — порядок каталога, как и был.
    return withoutDuplicates((await Promise.all(entries.map(foundIn))).flat());
  }

  /**
   * Всё, что о плагине читается с источника, — без исполнения.
   *
   * Три чтения начинаются разом: код, таблица стилей, словари. Раньше стили и словари ждали,
   * пока код будет прочитан, слинкован и исполнен, хотя от него не зависят. Каждая часть —
   * исход, который не отклоняется: загрузка разбирает их по очереди и в прежнем порядке,
   * поэтому при двойной поломке плагин получает тот же код отказа, что и раньше.
   */
  interface PluginRead {
    /** Источник, с которого читали: прочитанное с другого источника этой загрузке не годится. */
    readonly source: PluginFilesSource;
    readonly code: Promise<Settled<Awaited<ReturnType<typeof collectFiles>>>>;
    readonly styles: Promise<Settled<string>> | undefined;
    readonly messages: ReadonlyArray<{
      readonly locale: string;
      readonly file: string;
      readonly text: Promise<Settled<string>>;
    }>;
  }

  function startRead(
    source: PluginFilesSource,
    found: DiscoveredPlugin,
    manifest: ProjectPluginManifest
  ): PluginRead {
    const text = (path: string): Promise<string> =>
      source.read(joinPath(found.dir, path)).then((file) => file.text);

    const build = graphOf(manifest);
    const code = settle(
      traced(`plugin.read:${manifest.id}`, () =>
        build === undefined
          ? collectFiles(source, found.dir)
          : readClosure(source, found.dir, build, manifest.main)
      )
    );
    const styles = manifest.styles === undefined ? undefined : settle(text(manifest.styles.file));
    const messages = Object.entries(manifest.contributes?.messages ?? {}).map(([locale, file]) => ({
      locale,
      file,
      text: settle(text(file)),
    }));
    void traced(`plugin.assets:${manifest.id}`, () =>
      Promise.all([styles, ...messages.map((item) => item.text)])
    );
    // Модули оболочки, нужные точке входа, манифест называет до чтения кода — их прогрев
    // начинается здесь же, а не в очереди включения. Иначе чанки оболочки шли бы по сети
    // по одному плагину за раз, каждый раз после его файлов. Отказ здесь молчит: прогрев
    // перед линковкой ждёт те же загрузки, повторит отказавшую и скажет о ней сам.
    if (build !== undefined) {
      void deps
        .warmNamed?.(runtimeOf(build, buildClosure(build, [manifest.main])))
        .catch(() => undefined);
    }
    return { source, code, styles, messages };
  }

  function prefetchFound(found: DiscoveredPlugin): void {
    if (found.manifest === undefined || prefetched.has(found)) return;
    const source = deps.source();
    if (source === null || !source.capabilities.executesCode) return;
    prefetched.set(found, startRead(source, found, found.manifest));
  }

  async function loadFound(found: DiscoveredPlugin): Promise<PluginLoadResult> {
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

    // Предзагрузка одноразовая и привязана к источнику: проект могли сменить, и прочитанное
    // с прежнего каталога этой загрузке не годится — тогда читаем заново, как без неё.
    // Сверяется имя источника, а не объект: источник установленных плагинов создаётся на
    // каждый вызов заново, и сравнение по ссылке выбрасывало бы прочитанное всегда.
    const early = prefetched.get(found);
    prefetched.delete(found);
    const read =
      early !== undefined && early.source.id === source.id
        ? early
        : startRead(source, found, manifest);

    const code = await read.code;
    if (!code.ok) {
      return fail('code-failed', `файлы плагина не читаются: ${describe(code.error)}`, {
        cause: code.error,
      });
    }
    const collected = code.value;
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

    // Прогрев ДО линковки: внутри `require` асинхронного шага быть не может. Движок и модули
    // оболочки греются параллельно — друг от друга они не зависят, а ждать приходится обоих.
    // У плагина, читаемого по графу, модули называет манифест: в тексте их искать незачем.
    const build = graphOf(manifest);
    const warmNamed = deps.warmNamed;
    const [engine, shared] = await traced(`plugin.warm:${manifest.id}`, () =>
      Promise.allSettled([
        deps.prepare?.([...files.keys()]),
        build !== undefined && warmNamed !== undefined
          ? warmNamed(runtimeOf(build, [...files.keys()]))
          : deps.warm?.(files),
      ])
    );
    if (engine.status === 'rejected') {
      return fail('code-failed', `движок транспиляции не готов: ${describe(engine.reason)}`, {
        file: entry,
        cause: engine.reason,
      });
    }
    if (shared.status === 'rejected') {
      return fail(
        'code-failed',
        `модули оболочки для плагина не прогреты: ${describe(shared.reason)}`,
        { file: entry, cause: shared.reason }
      );
    }

    const result = await traced(`plugin.link:${manifest.id}`, () =>
      deps.modules.load(files, entry, { lazy: lazyFor(source, found.dir, manifest.id, build) })
    );
    // Отказ после линковки выгружает граф: код уже мог начать отложенный импорт, а плагина,
    // которому он нужен, не будет.
    const refuse = (...args: Parameters<typeof fail>): { ok: false; problem: PluginProblem } => {
      result.dispose?.();
      return fail(...args);
    };
    if (result.errors.length > 0) {
      const first = result.errors[0];
      return refuse('code-failed', `${first.file}: ${first.message}`, {
        file: first.file,
        cause: first.cause,
      });
    }

    const plugin = pluginFromExports(result.entry);
    if (plugin === undefined) {
      return refuse(
        'not-a-plugin',
        `«${entry}» не экспортировал плагин: ожидается объект с «id» и «activate» ` +
          'в module.exports или в экспорте по умолчанию',
        { file: entry }
      );
    }
    if (plugin.id !== manifest.id) {
      return refuse(
        'id-mismatch',
        `код объявляет плагин «${plugin.id}», а манифест — «${manifest.id}». ` +
          'Идентификатор — ключ во всех реестрах, и расхождение означало бы вклады, ' +
          'найденные по одному имени и снимаемые по другому',
        { file: entry }
      );
    }

    // Стили и словари читались вместе с кодом (см. `startRead`), но разбираются ПОСЛЕ него
    // и в прежнем порядке: `.css` и `.json` — не файлы кода, в набор линковщика они
    // не попадают, и `PLUGIN_FILE_LIMIT` этими чтениями не двигается.
    let styles: LoadedPlugin['styles'];
    if (manifest.styles !== undefined && read.styles !== undefined) {
      const css = await read.styles;
      if (!css.ok) {
        return refuse(
          'styles-invalid',
          `объявленная таблица стилей «${manifest.styles.file}» не читается: ${describe(css.error)}`,
          { file: manifest.styles.file, cause: css.error }
        );
      }
      styles = { css: css.value, isolation: manifest.styles.isolation };
    }

    // Число чтений ограничено манифестом: ровно столько, сколько локалей в нём объявлено.
    let messages: LoadedPlugin['messages'];
    if (read.messages.length > 0) {
      const bundles: Record<string, Readonly<Record<string, string>>> = {};
      for (const { locale, file, text } of read.messages) {
        const raw = await text;
        if (!raw.ok) {
          return refuse(
            'messages-invalid',
            `словарь локали «${locale}»: «${file}» не читается: ${describe(raw.error)}`,
            { file, cause: raw.error }
          );
        }
        const bundle = parseMessagesBundle(raw.value);
        if (!bundle.ok) {
          return refuse(
            'messages-invalid',
            `словарь локали «${locale}»: «${file}» ${bundle.reason}`,
            {
              file,
              cause: bundle.cause,
            }
          );
        }
        bundles[locale] = bundle.bundle;
      }
      messages = bundles;
    }

    return {
      ok: true,
      loaded: {
        manifest,
        plugin,
        files: [...files.keys()],
        ...(styles === undefined ? {} : { styles }),
        ...(messages === undefined ? {} : { messages }),
        ...(result.dispose === undefined ? {} : { dispose: result.dispose }),
        ...(build === undefined || result.preload === undefined
          ? {}
          : { preload: () => result.preload?.(Object.keys(build.files)) ?? Promise.resolve() }),
      },
    };
  }
}
