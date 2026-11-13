/**
 * Движки транспиляции, из которых выбирает композиция: `sucrase` (по умолчанию, с `typescript`
 * в запасе — ReFormer-t3xy) и `typescript` целиком (откат: `?rb-transpiler=typescript`).
 *
 * ## Гибрид
 *
 * sucrase переводит всё, а `typescript` грузится только тогда, когда sucrase файл отверг: ради
 * точной находки с местом либо ради синтаксиса, которого sucrase не знает. Форма без ошибок
 * `typescript` не грузит вовсе — в этом весь выигрыш: чанк 207 КБ вместо 3.5 МБ.
 *
 * Описатель движка — две вещи, которые обязаны ходить вместе: как его загрузить и чем он
 * подписывает кэш транспиляции. Разведи их — и после смены движка кэш отдавал бы код, собранный
 * прежним, как свой: ключ совпал бы, а вывод нет.
 *
 * Оба загрузчика — динамические `import()`, поэтому каждый движок остаётся своим ленивым чанком
 * и приезжает, только если выбран и понадобился.
 *
 * @module shell/platform/plugin/transpiler-engines
 */

import type { CompileCacheIdentity } from '@/shell/platform/modules/compile-cache';
import type { Transpiler } from '@/shell/platform/modules/transpilers';
import {
  createSucraseTranspiler,
  loadSucraseEngine,
  parseWithAcorn,
  SUCRASE_ENGINE_VERSION,
  SUCRASE_OPTIONS_SIGNATURE,
  SUCRASE_TRANSPILER_ID,
} from './sucrase-transpiler';
import {
  createTypeScriptTranspiler,
  loadTypeScript,
  TYPESCRIPT_ENGINE_VERSION,
  TYPESCRIPT_OPTIONS_SIGNATURE,
  TYPESCRIPT_TRANSPILER_ID,
} from './typescript-transpiler';

/** Имя движка, как его называет настройка. */
export type TranspilerChoice = 'typescript' | 'sucrase';

/** Все имена — для разбора настройки и для сообщения о неизвестном имени. */
export const TRANSPILER_CHOICES: readonly TranspilerChoice[] = ['typescript', 'sucrase'];

/** Движок: подпись кэша плюс ленивая загрузка готового транспилятора. */
export interface TranspilerEngine extends CompileCacheIdentity {
  /** Грузит движок и собирает над ним транспилятор. Зовётся один раз — при первом `.ts`. */
  load(): Promise<Transpiler>;
}

export const TYPESCRIPT_ENGINE: TranspilerEngine = {
  engineId: TYPESCRIPT_TRANSPILER_ID,
  engineVersion: TYPESCRIPT_ENGINE_VERSION,
  optionsVersion: TYPESCRIPT_OPTIONS_SIGNATURE,
  load: async () => createTypeScriptTranspiler(await loadTypeScript()),
};

/**
 * Гибрид над заданным запасным движком. Отдельной функцией ради тестов: им нужно видеть,
 * КОГДА запасной грузится, а настоящий `typescript` этого не покажет.
 *
 * Запасной грузится один раз на описатель; неудачная загрузка не запоминается — сетевая икота
 * не должна до перезагрузки страницы лишать человека точных находок.
 */
export function createHybridEngine(fallback: () => Promise<Transpiler>): TranspilerEngine {
  let loading: Promise<Transpiler> | undefined;
  const loadFallback = (): Promise<Transpiler> =>
    (loading ??= fallback().catch((error: unknown) => {
      loading = undefined;
      throw error;
    }));
  return {
    engineId: SUCRASE_TRANSPILER_ID,
    engineVersion: SUCRASE_ENGINE_VERSION,
    optionsVersion: SUCRASE_OPTIONS_SIGNATURE,
    load: async () => {
      // acorn — для места ошибки разбора; не приехал — разбирает `Function`, без места.
      const [engine, acorn] = await Promise.all([
        loadSucraseEngine(),
        import('acorn').catch(() => null),
      ]);
      return createSucraseTranspiler(engine, {
        fallback: loadFallback,
        ...(acorn === null ? {} : { verify: parseWithAcorn(acorn) }),
      });
    },
  };
}

/** sucrase с `typescript` в запасе — движок по умолчанию. */
export const SUCRASE_ENGINE: TranspilerEngine = createHybridEngine(() => TYPESCRIPT_ENGINE.load());

/** Описатель по имени. Без имени — гибрид sucrase: `typescript` целиком включают явно. */
export function transpilerEngine(choice: TranspilerChoice = 'sucrase'): TranspilerEngine {
  return choice === 'typescript' ? TYPESCRIPT_ENGINE : SUCRASE_ENGINE;
}

/**
 * Имя движка из строки настройки (параметр адреса `rb-transpiler`). Пусто или незнакомо —
 * `undefined`, то есть движок по умолчанию: опечатка в адресе не должна стоить человеку превью.
 */
export function parseTranspilerChoice(
  value: string | null | undefined
): TranspilerChoice | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  return TRANSPILER_CHOICES.find((choice) => choice === normalized);
}
