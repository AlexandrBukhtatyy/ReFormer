/**
 * Плитки бенчмарка на лендинге — считаются из данных отчёта (forms-benchmark-headline.json), а не
 * пишутся руками. Каждая плитка — одно утверждение про конкретную форму, фазу и конкурентов.
 *
 * Правила честности:
 * - плитка показывается, только если ReFormer core в её строке значимо быстрее КАЖДОГО названного
 *   конкурента (▲ у конкурента в отчёте); после новой публикации, где это не так, плитка пропадает;
 * - «во сколько раз» округляется вниз до десятых: 1.44 → 1.4, 2.97 → 2.9 — плитка не завышает;
 * - рядом с отношением — сами медианы, по которым оно посчитано.
 */
import type { BarRow } from './BarChart';
import { CORE, type FormId, type HeadlineData, RIVALS, median } from './types';

export type TileId = 'ready' | 'arrayAdd' | 'wizardStep' | 'bundle';

export interface Tile {
  id: TileId;
  form: FormId;
  /** Отношение, округлённое вниз до десятых, или диапазон: «1.4», «1.9–2.9». */
  factor: string;
  unit: string;
  core: number;
  /** Названные конкуренты: медиана и отношение к ReFormer core. */
  rivals: Array<{ lib: string; value: number; ratio: number }>;
  /** Мини-график: ReFormer core и конкуренты, по возрастанию. */
  bars: BarRow[];
}

const floor1 = (v: number) => (Math.floor(v * 10 + 1e-9) / 10).toFixed(1);

/** «1.4» или «1.9–2.9»: диапазон отношений, каждое — вниз до десятых. */
export function factorRange(ratios: number[]): string {
  const lo = floor1(Math.min(...ratios));
  const hi = floor1(Math.max(...ratios));
  return lo === hi ? lo : `${lo}–${hi}`;
}

interface RatioSpec {
  id: Exclude<TileId, 'bundle'>;
  form: FormId;
  phase: string;
  metric: string;
  /** С кем сравнивается утверждение. */
  against: readonly string[];
}

const RATIO_TILES: RatioSpec[] = [
  // Холодная загрузка регистрации: самая частая форма — её цена старта заметнее всего.
  { id: 'ready', form: 'registration', phase: 'load', metric: 'ready', against: ['formik'] },
  // Динамический массив кредитной заявки: JS на добавление строк.
  { id: 'arrayAdd', form: 'credit', phase: 'array-add', metric: 'script', against: RIVALS },
  // Визард: «Далее» на шаг 2 — до затихания UI.
  { id: 'wizardStep', form: 'credit', phase: 'next-1', metric: 'settle', against: RIVALS },
];

function ratioTile(data: HeadlineData, spec: RatioSpec): Tile | null {
  const form = data.forms.find((f) => f.id === spec.form);
  const row = form?.rows.find((r) => r.phase === spec.phase && r.id === spec.metric);
  if (!row) return null;
  const core = median(row.cells[CORE]);
  if (core === null || core <= 0) return null;
  const rivals = [];
  for (const lib of spec.against) {
    const cell = row.cells[lib];
    const value = median(cell);
    // Только доказанная разница: ▲ у конкурента — значимо хуже ReFormer core.
    if (!cell || value === null || cell[4] !== 1 || value <= core) return null;
    rivals.push({ lib, value, ratio: value / core });
  }
  // На графике — все конкуренты строки (не только названные): видно, кто ближе.
  const shown = [CORE, ...RIVALS].filter((l) => row.cells[l] && median(row.cells[l]) !== null);
  return {
    id: spec.id,
    form: spec.form,
    factor: factorRange(rivals.map((r) => r.ratio)),
    unit: row.unit,
    core,
    rivals,
    bars: shown
      .map((lib) => ({ lib, cell: row.cells[lib] }))
      .sort((a, b) => (a.cell[0] ?? 0) - (b.cell[0] ?? 0)),
  };
}

/** Порог «на уровне»: размеры отличаются не больше чем на 10 %. */
export const SAME_SIZE = 0.1;

/** Бандл регистрации: gzip сверх baseline (та же страница без библиотеки форм). */
function bundleTile(data: HeadlineData, form: FormId = 'registration'): Tile | null {
  const over = (lib: string) =>
    data.bundle.find((b) => b.form === form && b.lib === lib)?.overBaselineGzip ?? null;
  const core = over(CORE);
  if (core === null) return null;
  const rivals = RIVALS.map((lib) => ({ lib, value: over(lib) }))
    .filter((r): r is { lib: (typeof RIVALS)[number]; value: number } => r.value !== null)
    .map((r) => ({ ...r, ratio: r.value / core }));
  if (!rivals.length) return null;
  return {
    id: 'bundle',
    form,
    factor: core.toFixed(1),
    unit: 'КБ',
    core,
    rivals,
    bars: [{ lib: CORE, value: core }, ...rivals]
      .sort((a, b) => a.value - b.value)
      .map(({ lib, value }) => ({ lib, cell: [value, null, null, null, 0] })),
  };
}

/** Формулировка плитки бандла по данным: «на уровне Formik», «меньше всех» или нейтрально. */
export function bundleClaim(tile: Tile): 'level' | 'smallest' | 'plain' {
  const formik = tile.rivals.find((r) => r.lib === 'formik');
  if (formik && Math.abs(tile.core / formik.value - 1) <= SAME_SIZE) return 'level';
  if (tile.rivals.every((r) => r.value > tile.core)) return 'smallest';
  return 'plain';
}

export function computeTiles(data: HeadlineData): Tile[] {
  return [...RATIO_TILES.map((spec) => ratioTile(data, spec)), bundleTile(data)].filter(
    (t): t is Tile => t !== null
  );
}
