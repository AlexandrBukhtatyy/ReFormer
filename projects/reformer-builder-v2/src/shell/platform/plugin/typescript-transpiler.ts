/**
 * Транспилятор TypeScript поверх реестра `host/modules`: `main.ts` плагина компилируется на лету.
 *
 * Модуль отвечает на два вопроса контракта Э8, оставленных открытыми, — и оба про **время**,
 * а не про синтаксис.
 *
 * ## Почему движок грузится лениво
 *
 * Пакет `typescript` весит около семи мегабайт. Статический импорт увёл бы его в основной чанк,
 * и цену заплатили бы все — включая тех, кто ни одного плагина не включал и `.ts` в глаза
 * не видел. Поэтому здесь `await import('typescript')`: сборщик оставляет движок отдельным
 * чанком, и он приезжает ровно тогда, когда появился файл, который без него не прочитать.
 *
 * ## Почему прогрев — отдельная фаза, а не часть `transpile`
 *
 * `Transpiler.transpile` объявлен СИНХРОННЫМ, и это не упущение: он вызывается изнутри
 * CommonJS-`require`, а `require` синхронен по устройству. Асинхронный шаг посреди линковки
 * означал бы модуль, который нельзя дописать до конца. Ленивая же загрузка асинхронна
 * по определению. Разрешается противоречие единственным способом: движок готовится ДО загрузки
 * ({@link TypeScriptSupport.ensure}), а к моменту `transpile` он уже здесь. Отсюда форма API —
 * не «транспилятор, который умеет ждать», а «подготовка, после которой транспилятор есть».
 *
 * ## Что этот модуль НЕ делает
 *
 * Не проверяет типы. `transpileModule` работает по одному файлу и знает только его синтаксис —
 * ровно как `isolatedModules`. Это осознанно: проверка типов требует всей программы и всех
 * `@types`, то есть в браузере — второй сборки проекта. Ошибка типов у плагина проявится
 * как ошибка времени исполнения, и это честная цена за то, что каталог вообще работает.
 *
 * Место у модуля временное: он общий для загрузчика плагинов и будущего компилятора формы,
 * поэтому переедет к `host/modules/`, как только у того появится второй потребитель.
 *
 * @module shell/platform/plugin/typescript-transpiler
 */

import { version as typescriptVersion } from 'typescript/package.json';

import type { Disposable } from '@/shell/platform/primitives/disposable';
import type { Transpiler, TranspilerRegistry } from '@/shell/platform/modules/transpilers';

/** Идентификатор в реестре транспиляторов. Свой движок регистрируется под другим id. */
export const TYPESCRIPT_TRANSPILER_ID = 'typescript';

/**
 * Версия движка — часть ключа кэша транспиляции.
 *
 * Берётся из `package.json`, а не у самого движка, и это принципиально: ответить «код уже собран,
 * движок не нужен» надо ДО того, как движок загрузят, иначе экономить нечего. Импорт безопасен —
 * это JSON, компилятор за собой он не тянет.
 */
export const TYPESCRIPT_ENGINE_VERSION: string = typescriptVersion;

/**
 * Подпись опций транспиляции — вторая часть ключа кэша.
 *
 * Сами опции собрать в строку нельзя: их значения (`ModuleKind.CommonJS`) живут в движке,
 * который к моменту вычисления ключа ещё не загружен. Поэтому подпись объявлена рядом с опциями
 * и обязана меняться вместе с ними — иначе кэш отдаст код, собранный по прежним правилам.
 *
 * Расхождение ловит тест: он сверяет, что каждый ключ, реально уходящий в `transpileModule`,
 * назван в подписи.
 */
export const TYPESCRIPT_OPTIONS_SIGNATURE =
  'module=commonjs;target=es2022;jsx=react-jsx;jsxImportSource=react;' +
  'esModuleInterop=true;isolatedModules=true;sourceMap=false';

/** Расширения, которые без движка не прочитать. */
export const TYPESCRIPT_EXTENSIONS: readonly string[] = ['.ts', '.tsx', '.mts', '.cts'];

/** Одна находка компилятора. Форма — та, что отдаёт `typescript`, но без его типов. */
interface TranspileDiagnostic {
  readonly messageText: unknown;
}

/**
 * Та часть `typescript`, которой мы пользуемся.
 *
 * Объявлена структурно, а не импортом типов из пакета, ровно по причине ленивости: импорт
 * типов из `typescript` затянул бы его в граф сборки — не значениями, так соблазном. Плюс
 * подставить движок в тесте становится вопросом четырёх полей, а не всего API компилятора.
 */
export interface TypeScriptEngine {
  transpileModule(
    input: string,
    options: {
      readonly fileName?: string;
      readonly reportDiagnostics?: boolean;
      readonly compilerOptions?: Record<string, unknown>;
    }
  ): { readonly outputText: string; readonly diagnostics?: readonly TranspileDiagnostic[] };
  readonly ModuleKind: { readonly CommonJS: number };
  readonly ScriptTarget: { readonly ES2022: number };
  readonly JsxEmit: { readonly ReactJSX: number };
  flattenDiagnosticMessageText?(messageText: unknown, newLine: string): string;
}

/** Как достать движок. Подменяется в тестах — иначе они тянули бы семь мегабайт на каждый прогон. */
export type TypeScriptEngineLoader = () => Promise<TypeScriptEngine>;

/** Нужен ли движок для этого файла. Решение по имени: содержимое ещё не читали. */
export function isTypeScriptFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return TYPESCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Ленивая загрузка настоящего движка.
 *
 * `import('typescript')` — единственное место, где пакет упоминается, и оно намеренно
 * динамическое: статическая ссылка отсюда вернула бы движок в основной чанк.
 */
const loadTypeScript: TypeScriptEngineLoader = async (): Promise<TypeScriptEngine> => {
  const module: unknown = await import('typescript');
  const candidate = (module as { default?: unknown }).default ?? module;
  const engine = candidate as TypeScriptEngine;
  if (typeof engine.transpileModule !== 'function') {
    throw new Error('пакет «typescript» загрузился, но в нём нет transpileModule');
  }
  return engine;
};

/** Текст находки компилятора: движок умеет разворачивать цепочку сообщений — пользуемся. */
function describeDiagnostic(engine: TypeScriptEngine, diagnostic: TranspileDiagnostic): string {
  if (typeof engine.flattenDiagnosticMessageText === 'function') {
    return engine.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  }
  return typeof diagnostic.messageText === 'string'
    ? diagnostic.messageText
    : String(diagnostic.messageText);
}

/**
 * Собирает транспилятор над готовым движком.
 *
 * Экспортируется отдельно от подготовки: так его можно завести над своим движком (sucrase,
 * esbuild-wasm) или над подставным — и это то самое свойство сменности, ради которого реестр
 * транспиляторов вообще существует.
 */
export function createTypeScriptTranspiler(engine: TypeScriptEngine): Transpiler {
  return {
    id: TYPESCRIPT_TRANSPILER_ID,
    applies: isTypeScriptFile,
    transpile(code, fileName) {
      const output = engine.transpileModule(code, {
        fileName,
        reportDiagnostics: true,
        compilerOptions: {
          // CommonJS — не вкус, а требование линковщика: он подставляет коду свои
          // `require`/`module`, и другой формат модуля до них просто не дойдёт.
          module: engine.ModuleKind.CommonJS,
          target: engine.ScriptTarget.ES2022,
          // Новый JSX: `react/jsx-runtime` — защищённый спецификатор реестра, то есть панель
          // плагина строится тем же React, что и оболочка.
          jsx: engine.JsxEmit.ReactJSX,
          jsxImportSource: 'react',
          esModuleInterop: true,
          // Пофайловая транспиляция — то же ограничение, что у `isolatedModules`. Объявляем
          // его явно, чтобы движок ругался на конструкции, которые без всей программы неверны.
          isolatedModules: true,
          sourceMap: false,
        },
      });

      const diagnostics = output.diagnostics ?? [];
      if (diagnostics.length > 0) {
        throw new Error(diagnostics.map((d) => describeDiagnostic(engine, d)).join('; '));
      }
      return { js: output.outputText };
    },
  };
}

/** Подготовка движка: отдельная фаза, которая обязана завершиться до линковки. */
export interface TypeScriptSupport extends Disposable {
  /** Есть ли среди файлов хоть один, которому нужен движок. */
  needed(fileNames: Iterable<string>): boolean;
  /**
   * Готовит движок, если он нужен этим файлам, и регистрирует транспилятор.
   *
   * Идемпотентна: движок грузится один раз за жизнь объекта, регистрация происходит один раз,
   * повторные вызовы отдают тот же промис. Отказ загрузки пробрасывается вызывающему —
   * загрузчик отнесёт его к плагину, из-за которого прогрев и понадобился.
   */
  ensure(fileNames: Iterable<string>): Promise<void>;
}

/** Настройки подготовки. Единственная — чем грузить движок. */
export interface TypeScriptSupportOptions {
  readonly load?: TypeScriptEngineLoader;
}

/**
 * Заводит ленивую поддержку TypeScript над реестром транспиляторов.
 *
 * Регистрация происходит внутри {@link TypeScriptSupport.ensure}, а не сразу: реестр,
 * в котором транспилятор объявлен, но движка за ним ещё нет, отдал бы линковщику объект,
 * падающий на первом же вызове.
 */
export function createTypeScriptSupport(
  registry: TranspilerRegistry,
  options: TypeScriptSupportOptions = {}
): TypeScriptSupport {
  const load = options.load ?? loadTypeScript;
  let preparing: Promise<void> | undefined;
  let registration: Disposable | undefined;

  const prepare = (): Promise<void> => {
    preparing ??= load().then((engine) => {
      registration = registry.register(createTypeScriptTranspiler(engine));
    });
    return preparing;
  };

  return {
    needed(fileNames) {
      for (const name of fileNames) if (isTypeScriptFile(name)) return true;
      return false;
    },

    ensure(fileNames) {
      // Ни одного `.ts` — не грузим ничего. Ровно ради этой ветки прогрев и принимает список
      // файлов: плагин, поставленный собранным `main.js`, движка не касается вовсе.
      for (const name of fileNames) if (isTypeScriptFile(name)) return prepare();
      return Promise.resolve();
    },

    dispose() {
      registration?.dispose();
      registration = undefined;
      // Промис не сбрасываем: движок уже в памяти, и повторная загрузка ничего бы не дала,
      // кроме второй копии компилятора.
    },
  };
}
