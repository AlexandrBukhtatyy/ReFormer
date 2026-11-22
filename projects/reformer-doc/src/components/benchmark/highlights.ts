/**
 * Плитки бенчмарка на лендинге — считаются из данных отчёта (forms-benchmark-headline.json), а не
 * пишутся руками. Плитки — характеристики любой формы, а не отдельной фичи (массивы, визард):
 * скорость загрузки, бандл, рендеры при монтировании и память. Все — на форме регистрации.
 *
 * Правила честности:
 * - плитка загрузки называет только конкурентов, значимо уступающих ReFormer core (▲ в отчёте), и
 *   пропадает, если таких нет или кто-то значимо быстрее (▼);
 * - «во сколько раз» округляется вниз до десятых: 1.44 → 1.4, 2.97 → 2.9 — плитка не завышает;
 * - рядом с отношением — сами медианы, по которым оно посчитано;
 * - где конкурент значимо быстрее при перемонтировании готовой формы, плитка загрузки так и пишет;
 * - бандл, рендеры и память — абсолютные числа; «меньше всех» — только когда до каждого конкурента
 *   больше 10 %, иначе «на уровне» ближайшего (sizeClaim).
 */
import type { BarRow } from './BarChart';
import { CORE, type FormId, type HeadlineData, RIVALS, median } from './types';

export type TileId = 'ready' | 'bundle' | 'renders' | 'memory';

export interface Tile {
  id: TileId;
  form: FormId;
  /** Число плитки: отношение вниз до десятых или диапазон «1.1–1.4»; у размеров — само значение. */
  factor: string;
  unit: string;
  core: number;
  /** Названные конкуренты: значение и отношение к ReFormer core. */
  rivals: Array<{ lib: string; value: number; ratio: number }>;
  /** Мини-график: ReFormer core и конкуренты, по возрастанию. */
  bars: BarRow[];
  /** То же у страницы без библиотеки форм — для подписи плитки. */
  baseline?: number;
  /** Конкуренты, значимо быстрее ReFormer core при перемонтировании, — оговорка под плиткой. */
  caveat?: { unit: string; core: number; rivals: Array<{ lib: string; value: number }> };
}

/** Форма всех плиток: самая частая — её цена старта заметнее всего. */
const FORM: FormId = 'registration';

const floor1 = (v: number) => (Math.floor(v * 10 + 1e-9) / 10).toFixed(1);

/** «1.4» или «1.9–2.9»: диапазон отношений, каждое — вниз до десятых. */
export function factorRange(ratios: number[]): string {
  const lo = floor1(Math.min(...ratios));
  const hi = floor1(Math.max(...ratios));
  return lo === hi ? lo : `${lo}–${hi}`;
}

function headlineRow(data: HeadlineData, form: FormId, phase: string, metric: string) {
  return (
    data.forms.find((f) => f.id === form)?.rows.find((r) => r.phase === phase && r.id === metric) ??
    null
  );
}

/** Бары из значений: ReFormer core и конкуренты по возрастанию. */
function valueBars(values: Array<{ lib: string; value: number }>): BarRow[] {
  return [...values]
    .sort((a, b) => a.value - b.value)
    .map(({ lib, value }) => ({ lib, cell: [value, null, null, null, 0] }));
}

/** Конкуренты, значимо быстрее ReFormer core в строке (▼ в отчёте); нет таких — `null`. */
function fasterRivals(data: HeadlineData, form: FormId, phase: string, metric: string) {
  const row = headlineRow(data, form, phase, metric);
  const core = median(row?.cells[CORE]);
  if (!row || core === null) return null;
  const rivals = RIVALS.flatMap((lib) => {
    const cell = row.cells[lib];
    const value = median(cell);
    return cell && value !== null && cell[4] === -1 ? [{ lib, value }] : [];
  });
  return rivals.length ? { unit: row.unit, core, rivals } : null;
}

/** Холодная загрузка: время от начала навигации до готовой формы. */
function readyTile(data: HeadlineData, form: FormId): Tile | null {
  const row = headlineRow(data, form, 'load', 'ready');
  const core = median(row?.cells[CORE]);
  if (!row || core === null || core <= 0) return null;
  const rivals = [];
  for (const lib of RIVALS) {
    const cell = row.cells[lib];
    const value = median(cell);
    if (!cell || value === null) continue;
    // Кто-то значимо быстрее — утверждения «быстрее» нет.
    if (cell[4] === -1) return null;
    // Называем только доказанную разницу: ▲ — значимо медленнее ReFormer core.
    if (cell[4] === 1 && value > core) rivals.push({ lib, value, ratio: value / core });
  }
  if (!rivals.length) return null;
  // На графике — все конкуренты строки (не только названные): видно, кто ближе.
  const shown = [CORE, ...RIVALS].filter((l) => median(row.cells[l]) !== null);
  return {
    id: 'ready',
    form,
    factor: factorRange(rivals.map((r) => r.ratio)),
    unit: row.unit,
    core,
    rivals,
    bars: shown
      .map((lib) => ({ lib, cell: row.cells[lib] }))
      .sort((a, b) => (a.cell[0] ?? 0) - (b.cell[0] ?? 0)),
    caveat: fasterRivals(data, form, 'remount', 'mountSync') ?? undefined,
  };
}

/** Плитка абсолютного значения (бандл, рендеры, память): меньше — лучше. */
function sizeTile(
  id: TileId,
  form: FormId,
  unit: string,
  valueOf: (lib: string) => number | null,
  digits: number
): Tile | null {
  const core = valueOf(CORE);
  if (core === null || core <= 0) return null;
  const rivals = RIVALS.map((lib) => ({ lib, value: valueOf(lib) }))
    .filter((r): r is { lib: (typeof RIVALS)[number]; value: number } => r.value !== null)
    .map((r) => ({ ...r, ratio: r.value / core }));
  if (!rivals.length) return null;
  return {
    id,
    form,
    factor: core.toFixed(digits),
    unit,
    core,
    rivals,
    bars: valueBars([{ lib: CORE, value: core }, ...rivals]),
  };
}

/** Бандл: gzip сверх baseline (та же страница без библиотеки форм). */
function bundleTile(data: HeadlineData, form: FormId): Tile | null {
  const over = (lib: string) =>
    data.bundle.find((b) => b.form === form && b.lib === lib)?.overBaselineGzip ?? null;
  return sizeTile('bundle', form, 'КБ', over, 1);
}

/** Рендеры React-компонентов при первом показе формы (фаза загрузки). */
function rendersTile(data: HeadlineData, form: FormId): Tile | null {
  const cells = data.forms
    .find((f) => f.id === form)
    ?.renders.find((r) => r.phase === 'load')?.cells;
  const count = (lib: string) => cells?.[lib]?.[0] ?? null;
  const tile = sizeTile('renders', form, 'шт', count, 0);
  const baseline = count('baseline');
  return tile && baseline !== null ? { ...tile, baseline } : tile;
}

/** Память: JS heap после загрузки и сборки мусора сверх baseline. */
function memoryTile(data: HeadlineData, form: FormId): Tile | null {
  const row = headlineRow(data, form, 'load', 'heap');
  const base = median(row?.cells.baseline);
  const over = (lib: string) => {
    const value = median(row?.cells[lib]);
    return value === null || base === null ? null : value - base;
  };
  return row ? sizeTile('memory', form, row.unit, over, 0) : null;
}

/** Порог «на уровне»: значения отличаются не больше чем на 10 %. */
export const SAME_SIZE = 0.1;

export type SizeClaim = { kind: 'level'; lib: string } | { kind: 'smallest' } | { kind: 'plain' };

/**
 * Формулировка плитки размера по данным: «на уровне X» (ближайший конкурент в пределах 10 %),
 * «меньше всех конкурентов» или нейтрально.
 */
export function sizeClaim(tile: Tile): SizeClaim {
  const gap = (value: number) => Math.abs(tile.core / value - 1);
  const near = tile.rivals
    .filter((r) => gap(r.value) <= SAME_SIZE)
    .sort((a, b) => gap(a.value) - gap(b.value))[0];
  if (near) return { kind: 'level', lib: near.lib };
  if (tile.rivals.every((r) => r.value > tile.core)) return { kind: 'smallest' };
  return { kind: 'plain' };
}

export function computeTiles(data: HeadlineData): Tile[] {
  return [
    readyTile(data, FORM),
    bundleTile(data, FORM),
    rendersTile(data, FORM),
    memoryTile(data, FORM),
  ].filter((t): t is Tile => t !== null);
}
