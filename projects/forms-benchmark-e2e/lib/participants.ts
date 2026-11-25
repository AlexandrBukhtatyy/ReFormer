/**
 * Участники набора (lib/suite.ts), отфильтрованные по факту сборки: страница, которой нет в
 * сборке, в тестах не участвует. У набора библиотек участники — из манифеста приложения
 * (forms-benchmark/entries.json), сведения о сборке — dist/build-info.json; у набора стеков —
 * из его описания и dist/frameworks-info.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suite, type SuiteParticipant } from './suite';

export const APP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../forms-benchmark'
);

export type FormId = 'registration' | 'credit';
export type Role = 'subject' | 'competitor' | 'baseline' | 'control';

export interface Participant {
  id: string;
  impl: string;
  label: string;
  role: Role;
  /** Проход подсчёта рендеров (по умолчанию — да; счётчик есть только у React). */
  renders?: boolean;
  driver?: SuiteParticipant['driver'];
  markup?: SuiteParticipant['markup'];
}

interface BuildInfo {
  entries: Array<{ id: string; form: string | null }>;
  versions: Record<string, string>;
  git: { sha: string | null; dirty: boolean };
  reformerPackages: Record<string, { version: string; distHash: string }>;
}

const manifest = JSON.parse(readFileSync(path.join(APP_DIR, 'entries.json'), 'utf8')) as {
  entries: Participant[];
};

export function buildInfo(): BuildInfo | null {
  const p = path.join(APP_DIR, 'dist', suite.buildInfo);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as BuildInfo) : null;
}

/** Участники, у которых собрана страница формы `form`. Фильтр ролей и env BENCH_LIBS=id,id. */
export function participants(form: FormId, roles?: Role[]): Participant[] {
  const built = new Set(
    buildInfo()
      ?.entries.filter((e) => e.form === form)
      .map((e) => e.id)
  );
  const only = process.env.BENCH_LIBS?.split(',').filter(Boolean);
  return (suite.participants ?? manifest.entries).filter(
    (e) => built.has(e.id) && (!roles || roles.includes(e.role)) && (!only || only.includes(e.id))
  );
}

/** Реализации, обязанные проходить conformance: без baseline и A/A-копии. */
export const implementations = (form: FormId) => participants(form, ['subject', 'competitor']);
