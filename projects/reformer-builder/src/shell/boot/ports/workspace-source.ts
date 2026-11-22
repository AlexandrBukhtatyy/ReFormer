/**
 * Служба источника проекта, собранная из платформы: чтение папки проекта мимо рабочей копии.
 *
 * Тот же шов, что у соседней службы записей (`./workspace-files`): держатель проекта читается на
 * КАЖДЫЙ вызов, потому что проект закрывают и открывают, а служба регистрируется один раз.
 *
 * Отличие от соседки — в двух местах. Чтение идёт к ИСТОЧНИКУ сессии, а не к рабочей области:
 * рабочая копия на чтение копирует файл к себе, а здесь читают то, чего никто не открывал. И
 * отказ источника не глотается, а переводится в вид службы: её спрашивают, чтобы рассказать о
 * результате, и «нет файла» и «папку не дали читать» обязаны прозвучать по-разному.
 *
 * @module shell/boot/ports/workspace-source
 */

import {
  isTextMediaType,
  makeResourceId,
  mediaTypeFor,
  normalizePath,
  parseResourceId,
  type ResourceId,
  type ResourceRef,
  type SourceReadErrorKind,
  type SourceResult,
  type WorkspaceSourceService,
} from '@reformer/builder-plugin-api/internal';
import { isSourceError } from '@/shell/platform/source/errors';
import type { Source, Stat } from '@/shell/platform/source/types';
import type { ProjectHost } from '@/shell/boot/project/project';

/** Предел `readText` без явного `maxBytes`: текст больше мегабайта человек не прикрепляет. */
export const SOURCE_TEXT_DEFAULT_MAX_BYTES = 1_048_576;

export interface WorkspaceSourceServiceDeps {
  /** Держатель проекта в объёме, которым пользуется служба: только снимок. */
  readonly project: Pick<ProjectHost, 'get'>;
}

type Refusal = {
  readonly ok: false;
  readonly error: { kind: SourceReadErrorKind; message: string };
};

const refuse = (kind: SourceReadErrorKind, message: string): Refusal => ({
  ok: false,
  error: { kind, message },
});

const accept = <T>(value: T): SourceResult<T> => ({ ok: true, value });

const ABORTED: Refusal = refuse('aborted', 'чтение остановлено');

/** Отказ источника — в вид службы. Видов у источника больше, лишние сводятся к `failed`. */
function refusalOf(err: unknown, path: string): Refusal {
  if (isSourceError(err)) {
    switch (err.kind) {
      case 'not-found':
      case 'unauthorized':
      case 'forbidden':
      case 'budget':
      case 'aborted':
        return refuse(err.kind, err.message);
      default:
        return refuse('failed', err.message);
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  return refuse('failed', `${path === '' ? '(корень)' : path}: ${message}`);
}

/**
 * Путь внутри источника по адресу. Адрес чужого источника — `not-found`: в открытом проекте
 * такого ресурса нет, и это честнее, чем «запрещено». Побег за корень — `forbidden`.
 */
function pathIn(source: Source, id: ResourceId): string | Refusal {
  let parsed: { readonly sourceId: string; readonly path: string };
  try {
    parsed = parseResourceId(id);
  } catch (err) {
    return refuse('forbidden', err instanceof Error ? err.message : String(err));
  }
  if (parsed.sourceId !== source.id) {
    return refuse('not-found', `${id} — не из открытого проекта`);
  }
  return parsed.path;
}

export function createWorkspaceSourceService(
  deps: WorkspaceSourceServiceDeps
): WorkspaceSourceService {
  const { project } = deps;

  /**
   * Общая обвязка вызова: проект, адрес, сигнал и перевод отказа.
   *
   * Сигнал источнику не передаётся — его методы сигнала не принимают, — поэтому остановка
   * обрывает ОЖИДАНИЕ, а не чтение: ответ, пришедший позже, просто никому не нужен.
   */
  const run = async <T>(
    id: ResourceId,
    signal: AbortSignal | undefined,
    body: (source: Source, path: string) => Promise<SourceResult<T>>
  ): Promise<SourceResult<T>> => {
    if (signal?.aborted === true) return ABORTED;
    const source = project.get()?.source;
    if (source === undefined) return refuse('no-project', 'проект не открыт');
    const path = pathIn(source, id);
    if (typeof path !== 'string') return path;

    const work = body(source, path).catch((err: unknown) => refusalOf(err, path));
    if (signal === undefined) return work;
    return new Promise((resolve) => {
      const onAbort = (): void => resolve(ABORTED);
      signal.addEventListener('abort', onAbort, { once: true });
      void work.then((result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      });
    });
  };

  /**
   * `stat` источника, у которого корень — всегда каталог. Адаптер ФС так и отвечает, а двойник
   * в памяти каталогов не хранит и корня «не знает»; спрашивать о корне незачем вовсе.
   */
  const statOf = (source: Source, path: string): Promise<Stat | null> =>
    path === '' ? Promise.resolve({ kind: 'directory' }) : source.stat(path);

  return {
    stat: (id, options) =>
      run(id, options?.signal, async (source, path) => {
        const found = await statOf(source, path);
        if (found === null) return refuse('not-found', `нет ${path}`);
        return accept({
          kind: found.kind,
          ...(found.kind === 'file' ? { mediaType: mediaTypeFor(path, found.mediaType) } : {}),
          ...(found.size !== undefined ? { size: found.size } : {}),
        });
      }),

    list: (dir, options) =>
      run(dir, options?.signal, async (source, base) => {
        const entries = await source.list(base);
        // Форма ссылки и порядок — как у листинга рабочей области: дерево и эта служба
        // описывают один каталог, и расходиться в мелочах им незачем.
        const refs: ResourceRef[] = entries.map((entry) => {
          const path = normalizePath(entry.path);
          return {
            id: makeResourceId(source.id, path),
            sourceId: source.id,
            path,
            name: entry.name,
            kind: entry.kind,
            mediaType: mediaTypeFor(path),
          };
        });
        refs.sort((a, b) =>
          a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
        );
        return accept<readonly ResourceRef[]>(refs);
      }),

    readText: (id, options) =>
      run(id, options?.signal, async (source, path) => {
        // Сначала `stat`: вид, медиатип и размер известны без тела, и отказ по ним не стоит
        // чтения мегабайтов, которые всё равно не отдадут.
        const found = await statOf(source, path);
        if (found === null) return refuse('not-found', `нет ${path}`);
        if (found.kind === 'directory') return refuse('is-directory', `${path} — каталог`);
        const mediaType = mediaTypeFor(path, found.mediaType);
        if (!isTextMediaType(mediaType)) {
          return refuse('not-text', `${path} — не текст (${mediaType})`);
        }
        const limit = options?.maxBytes ?? SOURCE_TEXT_DEFAULT_MAX_BYTES;
        const tooLarge = (size: number): Refusal =>
          refuse('too-large', `${path}: ${size} байт при пределе ${limit}`);
        if (found.size !== undefined && found.size > limit) return tooLarge(found.size);

        const content = await source.read(path);
        // Источник, не знающий размера заранее, проверяется по прочитанному: предел обещан
        // вызывающему, и молча отдать больше значило бы нарушить обещание.
        if (found.size === undefined) {
          const size = new TextEncoder().encode(content.text).length;
          if (size > limit) return tooLarge(size);
        }
        return accept({ text: content.text, mediaType: mediaTypeFor(path, content.mediaType) });
      }),
  };
}
