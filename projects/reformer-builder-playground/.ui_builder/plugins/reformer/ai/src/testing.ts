/**
 * Двойники платформы для юнитов моста.
 *
 * Порт ассистента (`./host`) держит ровно три глагола про рабочую область, поэтому двойник
 * получается маленьким — и это его главное свойство: тест моста не поднимает ни Workspace,
 * ни OPFS, ни оболочку, а поведение проверяет то же самое. Ровно ради этого платформа и
 * приходит портом, а не импортом.
 *
 * @module plugins/reformer/ai/testing
 */

import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import {
  moduleRootOfDocument,
  moduleRootPathOf,
  modulePlacementOf,
} from '../../core/codegen/layout';
import type { AiDocument, AiFiles, AiHost, FileScope, Translate, WriteMark } from './host';
import type { KnowledgeLoader } from './knowledge';
import { composeForm } from './files/compose';
import { createFileJournal, type FileJournal } from './files/journal';
import { createFileTurn, type FileTurn } from './files/turn';

/** Двойник рабочей области: карта документов, активная вкладка и журнал записей. */
export interface FakeHost extends AiHost {
  /** Положить (или заменить) содержимое документа и сделать его активным. */
  openDocument(id: ResourceId, text: string): void;
  /** Заменить текст мимо `writeText` — как это делает правка руками во время хода. */
  editOutside(id: ResourceId, text: string): void;
  /** Закрыть вкладку: `documentOf` начнёт отвечать `null`. */
  closeDocument(id: ResourceId): void;
  /**
   * Что и в каком порядке ушло в `writeText`, вместе с пометкой происхождения.
   *
   * Пометка здесь не для полноты: без неё тест не отличает запись ассистента от записи
   * человека — а это ровно то свойство, ради которого канал пометки заведён.
   */
  readonly writes: readonly {
    readonly id: ResourceId;
    readonly text: string;
    readonly mark?: WriteMark;
  }[];
  /** Отказывать в записи этой ошибкой. */
  failWrites(error: Error | null): void;
  setActive(id: ResourceId | null): void;
}

/** Ключ и параметры одной строкой: тест сверяет КЛЮЧ, а не перевод. */
const echoTranslate: Translate = (key, params) =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`;

/** Собрать двойник платформы. */
export function createFakeHost(files?: FakeFiles): FakeHost {
  const texts = new Map<ResourceId, string>();
  const writes: { id: ResourceId; text: string; mark?: WriteMark }[] = [];
  let active: ResourceId | null = null;
  let failure: Error | null = null;

  const documentFor = (id: ResourceId): AiDocument => ({
    ref: {
      id,
      sourceId: 'fake',
      path: String(id),
      name: String(id),
      kind: 'file',
      mediaType: 'application/json',
    },
    getText: () => texts.get(id) ?? files?.text(id) ?? '',
  });

  return {
    useTranslate: () => echoTranslate,
    translate: echoTranslate,

    activeResource: () => active,
    // Файл проекта, который не открывали двойником, — вкладка с буфером файла: в приложении
    // активная вкладка всегда открыта, а её буфер и есть то, что читает порт файлов.
    documentOf: (id) => (texts.has(id) || files?.text(id) !== undefined ? documentFor(id) : null),

    writeText(id, text, mark) {
      if (failure !== null) return Promise.reject(failure);
      writes.push({ id, text, ...(mark === undefined ? {} : { mark }) });
      texts.set(id, text);
      return Promise.resolve();
    },

    ...(files ? { files } : {}),

    // Открыть документ, созданный мимо двойника (файлом): текст берётся из файлов, если они есть.
    async open(id) {
      const text = files === undefined ? null : await files.read(id);
      texts.set(id, text ?? texts.get(id) ?? '');
      active = id;
    },

    openDocument(id, text) {
      texts.set(id, text);
      active = id;
    },

    editOutside(id, text) {
      texts.set(id, text);
    },

    closeDocument(id) {
      texts.delete(id);
      if (active === id) active = null;
    },

    writes,

    failWrites(error) {
      failure = error;
    },

    setActive(id) {
      active = id;
    },
  };
}

/**
 * Двойник файлов модуля: проект как карта «путь → текст», адрес ресурса — сам путь.
 *
 * Пути — от корня проекта, без ведущего слэша, как у `ResourceRef.path`. Каталоги не хранятся:
 * каталог есть, пока в нём есть хоть один файл, — так листинг совпадает с тем, что видит модель
 * в рабочей области после записи нового файла.
 */
export interface FakeFiles extends AiFiles {
  /**
   * Модуль формы документа — как его находит стек по раскладке; `null` — документа нет или у
   * него нет своей папки модуля.
   */
  scopeOf(id: ResourceId): FileScope | null;
  /** Положить файл мимо `write` — как он лежал в проекте до хода. */
  put(path: string, text: string): void;
  /** Текст файла сейчас. */
  text(path: string): string | undefined;
  /** Что и в каком порядке ушло в `write`, вместе с пометкой происхождения. */
  readonly writes: readonly {
    readonly path: string;
    readonly text: string;
    readonly mark?: WriteMark;
  }[];
  /** Отказывать в записи этой ошибкой. */
  failWrites(error: Error | null): void;
}

/** Каталог пути; у файла в корне проекта — пустая строка. */
const dirOf = (path: string): string => {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
};

/** Собрать двойник файлов модуля. */
export function createFakeFiles(initial: Readonly<Record<string, string>> = {}): FakeFiles {
  const texts = new Map<string, string>(Object.entries(initial));
  const writes: { path: string; text: string; mark?: WriteMark }[] = [];
  let failure: Error | null = null;

  const resolve = (dir: ResourceId, ...segments: readonly string[]): ResourceId =>
    [dir, ...segments].filter((segment) => segment !== '').join('/');
  const parentOf = (id: ResourceId): ResourceId => dirOf(id);

  const refOf = (path: string, kind: ResourceRef['kind']): ResourceRef => ({
    id: path,
    sourceId: 'fake',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind,
    mediaType: path.endsWith('.json') ? 'application/json' : 'text/plain',
  });

  return {
    scopeOf(id): FileScope | null {
      if (!texts.has(id) || modulePlacementOf(id).kind === 'detached') return null;
      const root = moduleRootOfDocument({ parentOf, resolve }, id, id);
      const rootPath = moduleRootPathOf(id);
      return {
        root,
        rootPath,
        document: id,
        schemaPath: rootPath === '' ? id : id.slice(rootPath.length + 1),
      };
    },
    read: (id) => Promise.resolve(texts.get(id) ?? null),
    write(id, text, mark) {
      if (failure !== null) return Promise.reject(failure);
      writes.push({ path: id, text, ...(mark === undefined ? {} : { mark }) });
      texts.set(id, text);
      return Promise.resolve();
    },
    list(dir) {
      const prefix = dir === '' ? '' : `${dir}/`;
      const children = new Map<string, ResourceRef>();
      for (const path of texts.keys()) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf('/');
        const name = slash < 0 ? rest : rest.slice(0, slash);
        children.set(name, refOf(`${prefix}${name}`, slash < 0 ? 'file' : 'directory'));
      }
      return Promise.resolve([...children.values()]);
    },
    exists: (id) =>
      Promise.resolve(texts.has(id) || [...texts.keys()].some((path) => path.startsWith(`${id}/`))),
    resolve,
    parentOf,
    pathOf: (id) => id,

    put(path, text) {
      texts.set(path, text);
    },
    text: (path) => texts.get(path),
    writes,
    failWrites(error) {
      failure = error;
    },
  };
}

/** Документ формы образцового модуля в двойнике файлов. */
export const FORM_PATH = 'forms/loan/schema/form.schema.json';

/**
 * Попытка хода над двойником файлов — так, как её собирает мост: модуль по документу, база —
 * форма, собранная из файлов на начало попытки.
 */
export async function createTestFileTurn(
  files: FakeFiles,
  options: {
    readonly documentPath?: string;
    readonly knowledge?: KnowledgeLoader;
    readonly journal?: FileJournal;
    readonly txId?: string;
  } = {}
): Promise<FileTurn> {
  const scope = files.scopeOf(options.documentPath ?? FORM_PATH);
  if (scope === null) throw new Error('createTestFileTurn: документ без модуля');
  const composed = await composeForm(
    (rel) => files.read(files.resolve(scope.root, ...rel.split('/'))),
    scope.schemaPath
  );
  if (!composed.ok) throw new Error(`createTestFileTurn: ${composed.error}`);
  return createFileTurn({
    files,
    scope,
    journal: options.journal ?? createFileJournal(),
    mark: { origin: 'agent', txId: options.txId ?? 'turn-1' },
    base: composed.schema,
    ...(options.knowledge ? { knowledge: options.knowledge } : {}),
  });
}
