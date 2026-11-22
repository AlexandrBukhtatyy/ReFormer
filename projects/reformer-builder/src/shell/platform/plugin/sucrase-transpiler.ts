/**
 * Транспилятор sucrase — движок по умолчанию в реестре `host/modules` (ReFormer-ydh8,
 * гибрид — ReFormer-t3xy).
 *
 * ## Зачем
 *
 * `typescript` — ленивый чанк ≈3.5 МБ, и платит за него каждый, кто открыл форму без тёплого
 * кэша или поправил файл в новой сессии. Компилятор при этом используется на сотую долю:
 * `transpileModule` только снимает типы и переводит модуль в CommonJS. sucrase делает ровно это,
 * весит на порядок меньше и работает в разы быстрее — и так же синхронно, что обязательно:
 * `transpile` зовётся изнутри `require` (см. `modules/transpilers`).
 *
 * ## Что подобрано так, чтобы вывод совпадал с `typescript`
 *
 * - `imports` — CommonJS с теми же правилами interop, что `esModuleInterop` у TS: модуль без
 *   `__esModule` получает `default`, равный самому модулю.
 * - `jsx` — ТОЛЬКО для `.tsx`, как у TS: в `.ts` угловые скобки — это приведение типа `<T>x`,
 *   и разбор их как JSX сломал бы файл.
 * - `jsxRuntime: 'automatic'` + `production: true` — `react/jsx-runtime` и `jsx`/`jsxs`. Без
 *   `production` sucrase зовёт `react/jsx-dev-runtime`, а такого модуля в реестре оболочки нет.
 * - `disableESTransforms` — современный синтаксис (`?.`, `??`, поля классов, `#private`) остаётся
 *   как есть, как у TS с `target=es2022`. Без флага sucrase переписывает их своими помощниками.
 *
 * ## Чем он слабее `typescript` — и как это закрыто
 *
 * sucrase разбирает ровно столько, сколько нужно для преобразования. Тексты его ошибок беднее
 * («Unexpected token» вместо «Expression expected»), а часть ошибок он не замечает вовсе:
 * незакрытая строка, повторное `let`, `08` проходят насквозь и дали бы `SyntaxError` уже при
 * исполнении — без места в исходнике.
 *
 * Поэтому `transpile` обещает больше, чем «вызвал sucrase»: вывод ещё и РАЗБИРАЕТСЯ (без
 * исполнения) — тем же конвертом, что у линковщика. Не разобрался — это отказ транспиляции,
 * а не исполнения. Любой отказ загрузчик отдаёт запасному движку (`fallback`, в композиции —
 * `typescript`, лениво): собрал — модуль работает, не собрал — находка уже его, с местом.
 *
 * Разбирает вывод acorn ({@link parseWithAcorn}), когда композиция его дала, иначе — `Function`.
 * acorn называет место, и sucrase сохраняет строки исходника, — поэтому место ошибки разбора
 * переносится в файл человека. Повторное объявление имени (`let a` дважды) acorn ловит, а
 * `typescript`, переводящий файл в одиночку, — нет: он переведёт, и сбой всплывёт при исполнении
 * без места. Такая находка окончательная (`TranspileError.definitive`) и запасному не отдаётся.
 *
 * Чего гибрид не закрывает: несовпадающий закрывающий тег JSX (`<div></span>`) sucrase молча
 * собирает в `<div>`, отказа нет — и до запасного дело не доходит. Проверки типов нет ни у одного
 * из движков.
 *
 * @module shell/platform/plugin/sucrase-transpiler
 */

import type * as Acorn from 'acorn';
import { version as sucraseVersion } from 'sucrase/package.json';

import {
  TranspileError,
  type TranspileFinding,
  type Transpiler,
} from '@/shell/platform/modules/transpilers';
import { isTypeScriptFile } from './typescript-transpiler';

/** Идентификатор в реестре транспиляторов и в ключе кэша. */
export const SUCRASE_TRANSPILER_ID = 'sucrase';

/** Версия движка — часть ключа кэша; из `package.json`, чтобы знать её до загрузки движка. */
export const SUCRASE_ENGINE_VERSION: string = sucraseVersion;

/**
 * Подпись опций — часть ключа кэша. Меняется вместе с {@link optionsFor}; расхождение ловит тест,
 * как и у `typescript`.
 */
export const SUCRASE_OPTIONS_SIGNATURE =
  'transforms=typescript,imports(+jsx for .tsx);jsxRuntime=automatic;jsxImportSource=react;' +
  'production=true;disableESTransforms=true;verify=parse';

/** Опции sucrase, которыми мы пользуемся. */
export interface SucraseOptions {
  readonly transforms: ('typescript' | 'jsx' | 'imports')[];
  readonly jsxRuntime: 'automatic';
  readonly jsxImportSource: string;
  readonly production: boolean;
  readonly disableESTransforms: boolean;
}

/**
 * Та часть sucrase, которой мы пользуемся. Структурно — по той же причине, что у `typescript`:
 * подставить движок в тесте значит написать одну функцию.
 */
export interface SucraseEngine {
  transform(code: string, options: SucraseOptions): { readonly code: string };
}

/** Опции для файла: JSX — только у `.tsx`. */
function optionsFor(fileName: string): SucraseOptions {
  const jsx = fileName.toLowerCase().endsWith('.tsx');
  return {
    transforms: jsx ? ['typescript', 'jsx', 'imports'] : ['typescript', 'imports'],
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    production: true,
    disableESTransforms: true,
  };
}

/** Ленивая загрузка настоящего движка — отдельным чанком, как и `typescript`. */
export async function loadSucraseEngine(): Promise<SucraseEngine> {
  const module: unknown = await import('sucrase');
  const candidate = (module as { default?: unknown }).default ?? module;
  const engine = candidate as SucraseEngine;
  if (typeof engine.transform !== 'function') {
    throw new Error('пакет «sucrase» загрузился, но в нём нет transform');
  }
  return engine;
}

/**
 * Синтаксическая ошибка sucrase в находку реестра.
 *
 * Парсер sucrase бросает `SyntaxError` с полем `pos` — смещением в исходнике (кодовые единицы
 * UTF-16, как у редактора) — и дописывает к тексту `(строка:колонка)`. Место едет полем
 * `range`, поэтому из текста оно снимается: иначе панель показала бы его дважды.
 */
function toFinding(error: unknown): TranspileFinding | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { pos, message } = error as { pos?: unknown; message?: unknown };
  if (typeof pos !== 'number' || typeof message !== 'string') return undefined;
  const text = message.replace(/\s*\(\d+:\d+\)\s*$/, '');
  return pos < 0 ? { message: text } : { message: text, range: { start: pos, end: pos + 1 } };
}

/**
 * Разбирает вывод, не исполняя: тот же конверт CommonJS, что у линковщика.
 *
 * `Function` компилирует тело и ничего не вызывает. Отказ здесь — тот самый `SyntaxError`, который
 * линковщик получил бы при исполнении, только узнанный на фазе транспиляции, где у отказа есть
 * запасной движок. Лишних отказов проверка не даёт: что не разобралось здесь, не исполнилось бы
 * и там.
 */
function parseCommonJs(js: string): void {
  new Function('exports', 'require', 'module', '__filename', js);
}

/** Та часть acorn, которой разбирается вывод. */
export type AcornParser = Pick<typeof Acorn, 'parse'>;

/**
 * Разбор вывода acorn — с местом ошибки. Настройки — как у конверта линковщика: скрипт, тело
 * функции (`return` на верхнем уровне законен).
 */
export function parseWithAcorn(acorn: AcornParser): (js: string) => void {
  return (js) => {
    acorn.parse(js, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      allowHashBang: true,
    });
  };
}

/** Ошибка, которую {@link parseWithAcorn} не уточнит запасным движком: связывание имён. */
const DEFINITIVE = /has already been declared/;

/**
 * Место ошибки разбора вывода — в исходнике. Строка та же (sucrase их сохраняет), колонка
 * та же, если до неё на строке не было снятых типов; за концом строки — её конец.
 */
function sourceRange(
  code: string,
  error: unknown
): { readonly start: number; readonly end: number } | undefined {
  const loc = (error as { loc?: { line?: unknown; column?: unknown } } | null)?.loc;
  if (typeof loc?.line !== 'number' || typeof loc.column !== 'number') return undefined;
  let start = 0;
  for (let line = 1; line < loc.line; line += 1) {
    const next = code.indexOf('\n', start);
    if (next < 0) return undefined;
    start = next + 1;
  }
  const lineEnd = code.indexOf('\n', start);
  const at = Math.min(start + loc.column, lineEnd < 0 ? code.length : lineEnd);
  return { start: at, end: at + 1 };
}

/** Настройки транспилятора. */
export interface SucraseTranspilerOptions {
  /** Запасной движок для отвергнутых файлов — см. `Transpiler.fallback`. */
  readonly fallback?: () => Promise<Transpiler>;
  /** Проверка вывода; по умолчанию — разбор конвертом линковщика. Бросает — значит отказ. */
  readonly verify?: (js: string) => void;
}

/** Собирает транспилятор над готовым движком — настоящим или подставным. */
export function createSucraseTranspiler(
  engine: SucraseEngine,
  options: SucraseTranspilerOptions = {}
): Transpiler {
  const verify = options.verify ?? parseCommonJs;
  return {
    id: SUCRASE_TRANSPILER_ID,
    applies: isTypeScriptFile,
    ...(options.fallback === undefined ? {} : { fallback: options.fallback }),
    transpile(code, fileName) {
      let js: string;
      try {
        js = engine.transform(code, optionsFor(fileName)).code;
      } catch (error) {
        // Ошибка без места — не синтаксис, а сбой самого движка: пусть линковщик назовёт её
        // как есть, подделывать ей позицию незачем.
        const finding = toFinding(error);
        if (finding === undefined) throw error;
        throw new TranspileError([finding]);
      }
      try {
        verify(js);
      } catch (error) {
        const reason = (error instanceof Error ? error.message : String(error)).replace(
          /\s*\(\d+:\d+\)\s*$/,
          ''
        );
        const range = sourceRange(code, error);
        if (DEFINITIVE.test(reason)) {
          throw new TranspileError(
            [{ message: reason, ...(range === undefined ? {} : { range }) }],
            {
              definitive: true,
            }
          );
        }
        // Место разбора у `Function` — в ВЫВОДЕ, а не в исходнике; у acorn оно перенесено. Так или
        // иначе файл уйдёт запасному движку, и уточнит находку он.
        throw new TranspileError([
          {
            message: `вывод sucrase не разбирается: ${reason}`,
            ...(range === undefined ? {} : { range }),
          },
        ]);
      }
      return { js };
    },
  };
}
