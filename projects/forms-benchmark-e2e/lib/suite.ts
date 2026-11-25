/**
 * Набор участников замеров — для тестов. `libraries` (по умолчанию) — ReFormer против библиотек
 * форм, участники — страницы forms-benchmark/src/libs из `entries.json`; `frameworks` — ReFormer на
 * трёх стеках, страницы хостов кросс-e2e (forms-benchmark/scripts/build-frameworks.mjs). Выбор —
 * `BENCH_SUITE`, описание — `suites/<id>.json` (его же читают скрипты отчёта: scripts/suite.mjs).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Участник набора со своим описанием (у набора библиотек участники — из `entries.json`). */
export interface SuiteParticipant {
  id: string;
  impl: string;
  label: string;
  /** Стек участника для подписи: «React + @reformer/ui-kit». */
  stack?: string;
  role: 'subject' | 'competitor' | 'baseline' | 'control';
  /** Проход подсчёта рендеров: счётчик есть только у React (хук DevTools). */
  renders?: boolean;
  /** Драйвер списков: нативный `<select>` или всплывающая панель кита. */
  driver?: 'native' | 'ui-kit' | 'vuetify' | 'taiga';
  /** Разметка мастера и массивов: бенчмарка или китов. */
  markup?: 'bench' | 'kit';
}

export interface Suite {
  id: string;
  participants: SuiteParticipant[] | null;
  /** Сведения о сборке страниц в `forms-benchmark/dist`. */
  buildInfo: string;
  /** Подкаталог `results/` для прогонов набора; пусто — сам `results/`. */
  resultsSubdir: string;
}

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SUITE_ID = process.env.BENCH_SUITE?.trim() || 'libraries';

function loadSuite(id: string): Suite {
  try {
    return JSON.parse(readFileSync(path.join(e2eDir, 'suites', `${id}.json`), 'utf8')) as Suite;
  } catch (error) {
    throw new Error(`BENCH_SUITE=${id}: нет описания набора suites/${id}.json (${String(error)})`);
  }
}

export const suite: Suite = loadSuite(SUITE_ID);
