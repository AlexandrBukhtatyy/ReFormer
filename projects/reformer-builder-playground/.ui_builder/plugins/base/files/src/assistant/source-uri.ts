/**
 * Адреса `source:` — файлы проекта такими, какими они сохранены на диске.
 *
 * Путь в адресе — от корня проекта, тот же, что у записи в дереве (`ResourceRef.path`). Модель
 * присылает его сама, поэтому разбор строгий: путь, выводящий за корень, абсолютный путь и буква
 * диска отвергаются по сегментам, а не сравнением строк.
 *
 * Здесь же — что модели читать нельзя вовсе: секреты (`.env`) и служебная история (`.git`). Это
 * политика того, кто даёт ресурсы, а не платформы: служба источника отдаёт любой файл проекта,
 * а решение «что показывать внешней модели» принимает провайдер.
 *
 * @module plugins/base/files/assistant/source-uri
 */

import { parseAssistantResourceUri } from '@reformer/builder-plugin-api';

/** Схема адресов источника проекта. */
export const SOURCE_SCHEME = 'source';

/** Адрес по пути от корня проекта; корень — `source:`. */
export function uriOfPath(path: string): string {
  return `${SOURCE_SCHEME}:${path}`;
}

/**
 * Путь от корня проекта в нормальном виде (`/`, без `./` и хвостового слэша) или `null`, если
 * путь выводит за корень, абсолютный или пустой посередине. `''` — корень проекта.
 */
export function normalizeSourcePath(input: string): string | null {
  let path = input.trim().replace(/\\/g, '/');
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return null;
  while (path.startsWith('./')) path = path.slice(2);
  path = path.replace(/\/+$/, '');
  if (path === '' || path === '.') return '';
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') return null;
  }
  return segments.join('/');
}

/** Путь из адреса `source:` или `null`: чужая схема либо негодный путь. */
export function pathOfUri(uri: string): string | null {
  const parsed = parseAssistantResourceUri(uri);
  if (parsed === null || parsed.scheme !== SOURCE_SCHEME) return null;
  return normalizeSourcePath(parsed.rest);
}

/** Почему этот путь модели не показывается (фраза для модели); `null` — показывается. */
export function deniedReason(path: string): string | null {
  const segments = path.split('/');
  if (segments.includes('.git')) return 'Git internals are not shown to the assistant.';
  const name = segments.at(-1) ?? '';
  if (name === '.env' || name.startsWith('.env.')) {
    return `${name} may contain secrets and is not shown to the assistant.`;
  }
  return null;
}

/** Каталоги, в которые обход проекта не заходит: зависимости, сборка и служебные. */
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

/** Заходить ли обходу в этот каталог. Скрытые каталоги (`.git`, `.ui_builder`) пропускаются. */
export function skippedInWalk(name: string): boolean {
  return name.startsWith('.') || SKIPPED_DIRECTORIES.has(name);
}

/** Последний сегмент пути. */
export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Каталог пути; у записи в корне — `''`. */
export function dirName(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
}
