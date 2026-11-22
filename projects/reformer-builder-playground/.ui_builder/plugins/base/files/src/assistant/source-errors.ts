/**
 * Отказ службы источника — в ошибку для модели.
 *
 * Модель решает по коду, что делать дальше, поэтому каждому виду отказа — свой код и фраза,
 * которая говорит, что предпринять: дочитать частями, спросить человека, искать другой путь.
 *
 * @module plugins/base/files/assistant/source-errors
 */

import type {
  AssistantError,
  ResourceId,
  SourceReadError,
  WorkspaceFilesService,
  WorkspaceSourceService,
} from '@reformer/builder-plugin-api';
import { baseName, dirName } from './source-uri';

/** Что нужно плагину, чтобы читать источник: служба источника и адресация проекта. */
export interface SourceAccess {
  readonly source: WorkspaceSourceService;
  readonly files: Pick<WorkspaceFilesService, 'projectRoot' | 'resolve'>;
}

/** Адрес по пути от корня проекта; `null` — проекта нет. */
export function idOfPath(access: SourceAccess, path: string): ResourceId | null {
  const root = access.files.projectRoot();
  if (root === null) return null;
  return path === '' ? root : access.files.resolve(root, ...path.split('/'));
}

/** Ошибка «проекта нет» — одна на все входы. */
export const NO_PROJECT: AssistantError = {
  code: 'UNAVAILABLE',
  message: 'No project is open.',
};

/** Отказ службы — в ошибку для модели про путь `path`. */
export function assistantErrorOf(
  error: SourceReadError,
  path: string,
  suggestions?: readonly string[]
): AssistantError {
  const shown = path === '' ? 'the project root' : path;
  switch (error.kind) {
    case 'no-project':
      return NO_PROJECT;
    case 'not-found':
      return {
        code: 'NOT_FOUND',
        message: `${shown} does not exist in the project (as saved on disk).`,
        ...(suggestions?.length ? { suggestions } : {}),
      };
    case 'is-directory':
      return { code: 'UNSUPPORTED', message: `${shown} is a directory.` };
    case 'not-text':
      return { code: 'UNSUPPORTED', message: `${shown} is not a text file: ${error.message}` };
    case 'too-large':
      return { code: 'TOO_LARGE', message: `${shown} is too large to read: ${error.message}` };
    case 'budget':
      return { code: 'TOO_LARGE', message: `${shown} has too many entries to list.` };
    case 'unauthorized':
      return {
        code: 'UNAVAILABLE',
        message:
          'Access to the project folder was not granted or was revoked — ask the user to ' +
          'reopen the project.',
      };
    case 'forbidden':
      return { code: 'REFUSED', message: `${shown} is outside the project.` };
    case 'aborted':
      return { code: 'FAILED', message: 'Reading was stopped.' };
    case 'failed':
      return { code: 'FAILED', message: `Reading ${shown} failed: ${error.message}` };
  }
}

/** Сколько похожих путей предлагать модели. */
const SUGGESTIONS = 5;

/**
 * Похожие пути для «нет такого»: записи ближайшего существующего каталога, ближе по имени —
 * раньше. Модель чаще всего ошибается в одном сегменте, и соседи этого сегмента — лучшая
 * подсказка; обхода всего проекта ради неё не нужно.
 */
export async function nearbyPaths(
  access: SourceAccess,
  path: string,
  signal: AbortSignal
): Promise<readonly string[]> {
  const wanted = baseName(path).toLowerCase();
  let dir = dirName(path);
  for (;;) {
    const id = idOfPath(access, dir);
    if (id === null) return [];
    const listed = await access.source.list(id, { signal });
    if (listed.ok) {
      return listed.value
        .map((ref) => ({ path: ref.path, name: ref.name.toLowerCase() }))
        .sort((a, b) => closeness(b.name, wanted) - closeness(a.name, wanted))
        .slice(0, SUGGESTIONS)
        .map((entry) => entry.path);
    }
    if (dir === '' || listed.error.kind !== 'not-found') return [];
    dir = dirName(dir);
  }
}

/** Насколько имя похоже на искомое: общий префикс, плюс вхождение одного в другое. */
function closeness(name: string, wanted: string): number {
  let prefix = 0;
  while (prefix < name.length && prefix < wanted.length && name[prefix] === wanted[prefix]) {
    prefix += 1;
  }
  const contains = wanted !== '' && (name.includes(wanted) || wanted.includes(name)) ? 10 : 0;
  return prefix + contains;
}
