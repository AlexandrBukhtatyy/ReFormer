/**
 * Провайдер ресурсов `source:` — ассистент читает файлы и каталоги проекта прямо из источника.
 *
 * Читается то, что лежит в папке проекта на самом деле, а не рабочая копия: несохранённых правок
 * провайдер не видит, и об этом сказано модели в описании схемы. Рабочую копию чтение не трогает
 * вовсе — служба источника ничего в неё не копирует, поэтому модель, прочитавшая полпроекта, не
 * заполняет хранилище браузера файлами, которых никто не открывал.
 *
 * Каталог по адресу — тоже ресурс: его чтение отдаёт список записей уровня. Так у модели один
 * инструмент на оба вопроса, а обход глубже — у `list_source`.
 *
 * @module plugins/base/files/assistant/source-provider
 */

import type {
  AssistantResourceProvider,
  AssistantResourceRead,
} from '@reformer/builder-plugin-api';
import {
  assistantErrorOf,
  idOfPath,
  NO_PROJECT,
  nearbyPaths,
  type SourceAccess,
} from './source-errors';
import type { SourceIndex } from './source-index';
import { deniedReason, pathOfUri, SOURCE_SCHEME } from './source-uri';

/** Предел файла, который отдаётся модели целиком; страницы режет ассистент. */
export const SOURCE_READ_MAX_BYTES = 512 * 1024;

/** Медиатип ответа на чтение каталога. */
const DIRECTORY_MEDIA_TYPE = 'inode/directory';

/** Строка каталога в затравке хода — как выглядят адреса и что за ними. */
export const SOURCE_DESCRIBE =
  'source:<path> — project files as saved on disk (unsaved edits are not visible), path from ' +
  'the project root; a directory URI lists its entries.';

/** Чтение файла или каталога источника по адресу `source:`. */
export async function readSource(
  access: SourceAccess,
  uri: string,
  signal: AbortSignal
): Promise<AssistantResourceRead> {
  const path = pathOfUri(uri);
  if (path === null) {
    return {
      ok: false,
      error: { code: 'REFUSED', message: `${uri} is not a path inside the project.` },
    };
  }
  const denied = deniedReason(path);
  if (denied !== null) return { ok: false, error: { code: 'REFUSED', message: denied } };
  const id = idOfPath(access, path);
  if (id === null) return { ok: false, error: NO_PROJECT };

  const stat = await access.source.stat(id, { signal });
  if (!stat.ok) {
    const suggestions =
      stat.error.kind === 'not-found' ? await nearbyPaths(access, path, signal) : undefined;
    return { ok: false, error: assistantErrorOf(stat.error, path, suggestions) };
  }

  if (stat.value.kind === 'directory') {
    const listed = await access.source.list(id, { signal });
    if (!listed.ok) return { ok: false, error: assistantErrorOf(listed.error, path) };
    const lines = listed.value.map((ref) => (ref.kind === 'directory' ? `${ref.name}/` : ref.name));
    return { ok: true, text: lines.join('\n'), mediaType: DIRECTORY_MEDIA_TYPE };
  }

  const read = await access.source.readText(id, { signal, maxBytes: SOURCE_READ_MAX_BYTES });
  if (!read.ok) return { ok: false, error: assistantErrorOf(read.error, path) };
  return { ok: true, text: read.value.text, mediaType: read.value.mediaType };
}

/** Провайдер схемы `source:`. */
export function sourceResourceProvider(
  access: SourceAccess,
  index: SourceIndex
): AssistantResourceProvider {
  return {
    scheme: SOURCE_SCHEME,
    describe: SOURCE_DESCRIBE,
    search: (query, signal) => index.search(query, signal),
    read: (uri, signal) => readSource(access, uri, signal),
  };
}
