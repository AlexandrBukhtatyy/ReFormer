/**
 * Сводка фазы для тепловой карты: во сколько раз участник медленнее ReFormer core в среднем по
 * метрикам фазы и где разница доказана.
 *
 * G — среднее геометрическое отношений медиан (участник / core) по сравнимым строкам: у строки есть
 * лучший (`best !== null`, т. е. это не величина против нуля вроде удержания памяти) и обе медианы
 * больше нуля. Вес у метрик равный, единицы сокращаются, ×2 и ×0.5 симметричны. Шумные строки
 * (разброс > 15 % хотя бы у одного участника) остаются: значимость и так проверена Mann–Whitney с
 * поправкой Holm и фильтром A/A, а без них в некоторых фазах осталось бы по одной метрике; в
 * подсказке они помечены.
 */
import { CORE, type Row, type Section, type Significance, median } from './types';

export interface MetricRatio {
  row: Row;
  core: number;
  value: number;
  ratio: number;
  sig: Significance;
}

export interface PhaseScore {
  /** Среднее геометрическое отношений: > 1 — участник медленнее ReFormer core. */
  g: number;
  n: number;
  /** Строк, где участник значимо хуже ReFormer core (▲) и значимо лучше (▼). */
  up: number;
  down: number;
  metrics: MetricRatio[];
}

export function phaseScore(section: Section, lib: string): PhaseScore | null {
  const metrics: MetricRatio[] = [];
  for (const row of section.rows) {
    if (row.best === null) continue;
    const core = median(row.cells[CORE]);
    const value = median(row.cells[lib]);
    if (core === null || value === null || !(core > 0) || !(value > 0)) continue;
    metrics.push({ row, core, value, ratio: value / core, sig: row.cells[lib][4] });
  }
  if (!metrics.length) return null;
  const g = Math.exp(metrics.reduce((s, m) => s + Math.log(m.ratio), 0) / metrics.length);
  return {
    g,
    n: metrics.length,
    up: metrics.filter((m) => m.sig === 1).length,
    down: metrics.filter((m) => m.sig === -1).length,
    metrics,
  };
}

/** Границы корзин цвета (×, в обе стороны зеркально): 1.05, 1.25, 1.6. */
export const BIN_EDGES = [1.05, 1.25, 1.6] as const;

export type Tone = { dir: 'pos' | 'neg'; level: 1 | 2 | 3 } | { dir: 'mid' };

/**
 * Цвет ячейки — только когда направление подтверждено значимостью: участник в среднем медленнее и
 * хотя бы в одной метрике значимо хуже (зелёное плечо: ReFormer core быстрее) — или быстрее и
 * хотя бы в одной значимо лучше (фиолетовое). Разница меньше 5 % или без значимых строк — серый.
 * baseline значимостью не проверяется — у него всегда серый.
 */
export function toneOf(score: PhaseScore, tested = true): Tone {
  const r = score.g >= 1 ? score.g : 1 / score.g;
  const backed = (score.g > 1 && score.up > 0) || (score.g < 1 && score.down > 0);
  if (!tested || !backed || r < BIN_EDGES[0]) return { dir: 'mid' };
  return {
    dir: score.g > 1 ? 'pos' : 'neg',
    level: r < BIN_EDGES[1] ? 1 : r < BIN_EDGES[2] ? 2 : 3,
  };
}
