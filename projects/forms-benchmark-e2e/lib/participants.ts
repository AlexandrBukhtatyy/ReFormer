/**
 * Участники из манифеста приложения (forms-benchmark/entries.json), отфильтрованные по факту
 * сборки (dist/build-info.json): страница, которой нет в сборке, в тестах не участвует.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const p = path.join(APP_DIR, 'dist/build-info.json');
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
  return manifest.entries.filter(
    (e) => built.has(e.id) && (!roles || roles.includes(e.role)) && (!only || only.includes(e.id))
  );
}

/** Реализации, обязанные проходить conformance: без baseline и A/A-копии. */
export const implementations = (form: FormId) => participants(form, ['subject', 'competitor']);
