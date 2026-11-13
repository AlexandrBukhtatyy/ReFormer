/**
 * Движки транспиляции, из которых выбирает композиция: `typescript` (по умолчанию) и `sucrase`
 * (эксперимент ReFormer-ydh8).
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

export const SUCRASE_ENGINE: TranspilerEngine = {
  engineId: SUCRASE_TRANSPILER_ID,
  engineVersion: SUCRASE_ENGINE_VERSION,
  optionsVersion: SUCRASE_OPTIONS_SIGNATURE,
  load: async () => createSucraseTranspiler(await loadSucraseEngine()),
};

/** Описатель по имени. Без имени — `typescript`: эксперимент включают явно. */
export function transpilerEngine(choice: TranspilerChoice = 'typescript'): TranspilerEngine {
  return choice === 'sucrase' ? SUCRASE_ENGINE : TYPESCRIPT_ENGINE;
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
