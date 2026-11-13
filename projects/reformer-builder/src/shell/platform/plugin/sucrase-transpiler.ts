/**
 * Транспилятор sucrase — сменная замена `typescript` в реестре `host/modules` (эксперимент
 * ReFormer-ydh8).
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
 * ## Чем он слабее `typescript` — известные отличия
 *
 * sucrase разбирает ровно столько, сколько нужно для преобразования, и часть синтаксических
 * ошибок не замечает: незакрытая строка, повторное `let`, несовпадающий закрывающий тег JSX
 * (`<div></span>` молча становится `<div>`). Первые две доедут до исполнения как `SyntaxError`
 * фазы `evaluate` — без места в исходнике. Тексты ошибок беднее: «Unexpected token» вместо
 * «Expression expected». Проверки типов нет ни у одного из движков.
 *
 * @module shell/platform/plugin/sucrase-transpiler
 */

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
  'production=true;disableESTransforms=true';

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

/** Собирает транспилятор над готовым движком — настоящим или подставным. */
export function createSucraseTranspiler(engine: SucraseEngine): Transpiler {
  return {
    id: SUCRASE_TRANSPILER_ID,
    applies: isTypeScriptFile,
    transpile(code, fileName) {
      try {
        return { js: engine.transform(code, optionsFor(fileName)).code };
      } catch (error) {
        // Ошибка без места — не синтаксис, а сбой самого движка: пусть линковщик назовёт её
        // как есть, подделывать ей позицию незачем.
        const finding = toFinding(error);
        if (finding === undefined) throw error;
        throw new TranspileError([finding]);
      }
    },
  };
}
