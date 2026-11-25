/**
 * Формулы и форматы чисел замеров MCP без зависимостей: их берут инфографика отчёта
 * (McpBenchmark.tsx) и секция лендинга — числа там и тут совпадают. Модуль не тянет models.ts
 * с данными всех моделей.
 */

/** Кратность: до десяти — с десятыми, дальше — целым. */
export const fmtRatio = (value: number): string =>
  value >= 10 ? value.toFixed(0) : value.toFixed(1);

/** Доля пройденных прогонов, %. */
export const percent = (passes: number, runs: number): number => (runs ? (passes / runs) * 100 : 0);

/** Доля пройденных прогонов, целым процентом. */
export const passRate = (s: { passes: number; runs: number }): number =>
  Math.round(percent(s.passes, s.runs));

/** «×4.3» — во сколько раз `a` больше `b`; без данных — «—». */
export const timesLabel = (a: number | null, b: number | null): string =>
  a === null || b === null || b === 0 ? '—' : `×${fmtRatio(a / b)}`;

/**
 * Дробь в тексте: по-русски — с запятой («в 4,3 раза»). Крупные числа плиток («×4.3») остаются с
 * точкой, как в отчёте.
 */
export const proseNumber = (value: string | number, isEn: boolean): string =>
  isEn ? String(value) : String(value).replace('.', ',');

export const fmtUsd = (value: number | null): string =>
  value === null ? '—' : `$${value < 1 ? value.toFixed(3) : value.toFixed(2)}`;

export const fmtTokens = (value: number): string =>
  value >= 100_000 ? `${Math.round(value / 1000)}k` : `${(value / 1000).toFixed(1)}k`;
