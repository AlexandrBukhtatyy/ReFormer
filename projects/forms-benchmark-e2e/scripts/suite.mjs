/**
 * Набор участников замеров — для скриптов отчёта. `libraries` (по умолчанию) — ReFormer против
 * библиотек форм, `frameworks` — ReFormer на трёх стеках. Выбор — `BENCH_SUITE`, описание —
 * `suites/<id>.json` (его же читают тесты: lib/suite.ts).
 *
 * Из набора скрипты берут порядок и подписи участников, опору сравнения и A/A-контроль, версии,
 * пути отчётов и данных сайта, а набор `frameworks` — ещё и свои тексты. Чего в наборе нет, скрипт
 * берёт из своих значений по умолчанию — это тексты и правила набора `libraries`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const e2eDir = path.resolve(here, '..');

export const SUITE_ID = process.env.BENCH_SUITE?.trim() || 'libraries';

/** Описание набора из `suites/<id>.json`. */
export function loadSuite(id = SUITE_ID) {
  try {
    return JSON.parse(readFileSync(path.join(e2eDir, 'suites', `${id}.json`), 'utf8'));
  } catch (error) {
    throw new Error(`BENCH_SUITE=${id}: нет описания набора suites/${id}.json (${error})`);
  }
}

export const suite = loadSuite();

/** Подпись участника для таблиц отчёта (report.md): своя у набора или общая подпись. */
export const reportLabels = (s = suite) => ({ ...s.labels, ...(s.reportLabels ?? {}) });

/** Ранжировать ли участников в строке: «лучший» и отношения к нему. У `frameworks` — нет. */
export const ranked = (s = suite) => s.ranking !== false;
