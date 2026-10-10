/**
 * Параметры property-тестов (fast-check).
 *
 * Число прогонов и seed берутся из окружения, чтобы упавший случай воспроизводился:
 * `FC_SEED=<seed из отчёта> FC_NUM_RUNS=1000 npx vitest run <файл>`.
 *
 * @module test-utils/property
 */

import type { Parameters } from 'fast-check';

const numberFromEnv = (name: string): number | undefined => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

/**
 * Параметры `fc.assert`: прогоны по умолчанию (`runs`), seed из `FC_SEED`, число прогонов из
 * `FC_NUM_RUNS` главнее умолчания.
 */
export function propertyParams<T>(runs = 100, over: Parameters<T> = {}): Parameters<T> {
  const seed = numberFromEnv('FC_SEED');
  return {
    numRuns: numberFromEnv('FC_NUM_RUNS') ?? runs,
    ...(seed !== undefined ? { seed } : {}),
    endOnFailure: true,
    ...over,
  };
}
