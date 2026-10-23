/**
 * Двойники рабочей области для тестов ассистента и стеков форм в нём.
 *
 * Общий плагин ассистента (`forms/ai`) и стек форм (`reformer/ai`) лежат в разных доменах и друг
 * друга не импортируют, а рабочая область для их тестов одна и та же: файлы проекта картой
 * «путь → текст» и открытые документы с журналом записей. Поэтому двойники здесь — типы только
 * структурные и из SDK, без знания о формате формы.
 *
 * @module plugins/.shared/assistant-fakes
 */

import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';

/** Пометка записи, как её видит двойник. */
export interface FakeWriteMark {
  readonly origin?: 'user' | 'agent';
  readonly txId?: string;
}

/**
 * Двойник файлов проекта: проект как карта «путь → текст», адрес ресурса — сам путь.
 *
 * Пути — от корня проекта, без ведущего слэша, как у `ResourceRef.path`. Каталоги не хранятся:
 * каталог есть, пока в нём есть хоть один файл, — так листинг совпадает с тем, что видит модель
 * в рабочей области после записи нового файла.
 */
export interface FakeFiles {
  read(id: ResourceId): Promise<string | null>;
  write(id: ResourceId, text: string, mark?: FakeWriteMark): Promise<void>;
  list(dir: ResourceId): Promise<readonly ResourceRef[]>;
  exists(id: ResourceId): Promise<boolean>;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
  parentOf(id: ResourceId): ResourceId;
  pathOf(id: ResourceId): string;
  /** Положить файл мимо `write` — как он лежал в проекте до хода. */
  put(path: string, text: string): void;
  /** Текст файла сейчас. */
  text(path: string): string | undefined;
  /** Что и в каком порядке ушло в `write`, вместе с пометкой происхождения. */
  readonly writes: readonly {
    readonly path: string;
    readonly text: string;
    readonly mark?: FakeWriteMark;
  }[];
  /** Отказывать в записи этой ошибкой. */
  failWrites(error: Error | null): void;
}

/** Каталог пути; у файла в корне проекта — пустая строка. */
const dirOf = (path: string): string => {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
};

/** Собрать двойник файлов проекта. */
export function createFakeFiles(initial: Readonly<Record<string, string>> = {}): FakeFiles {
  const texts = new Map<string, string>(Object.entries(initial));
  const writes: { path: string; text: string; mark?: FakeWriteMark }[] = [];
  let failure: Error | null = null;

  const refOf = (path: string, kind: ResourceRef['kind']): ResourceRef => ({
    id: path,
    sourceId: 'fake',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind,
    mediaType: path.endsWith('.json') ? 'application/json' : 'text/plain',
  });

  return {
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
    resolve: (dir, ...segments) => [dir, ...segments].filter((segment) => segment !== '').join('/'),
    parentOf: (id) => dirOf(id),
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

/** Открытый документ двойника. */
export interface FakeDocument {
  readonly ref: ResourceRef;
  getText(): string;
}

/**
 * Двойник открытых документов: карта документов и журнал записей.
 *
 * Файл проекта, который не открывали двойником, — тоже документ с буфером файла: в приложении
 * активная вкладка всегда открыта, а её буфер и есть то, что читает порт файлов.
 */
export interface FakeDocuments {
  documentOf(id: ResourceId): FakeDocument | null;
  writeText(id: ResourceId, text: string, mark?: FakeWriteMark): Promise<void>;
  /** Положить (или заменить) содержимое документа. */
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
    readonly mark?: FakeWriteMark;
  }[];
  /** Отказывать в записи этой ошибкой. */
  failWrites(error: Error | null): void;
}

/** Собрать двойник открытых документов. */
export function createFakeDocuments(files?: FakeFiles): FakeDocuments {
  const texts = new Map<ResourceId, string>();
  const writes: { id: ResourceId; text: string; mark?: FakeWriteMark }[] = [];
  let failure: Error | null = null;

  const documentFor = (id: ResourceId): FakeDocument => ({
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
    documentOf: (id) => (texts.has(id) || files?.text(id) !== undefined ? documentFor(id) : null),
    writeText(id, text, mark) {
      if (failure !== null) return Promise.reject(failure);
      writes.push({ id, text, ...(mark === undefined ? {} : { mark }) });
      texts.set(id, text);
      return Promise.resolve();
    },
    openDocument(id, text) {
      texts.set(id, text);
    },
    editOutside(id, text) {
      texts.set(id, text);
    },
    closeDocument(id) {
      texts.delete(id);
    },
    writes,
    failWrites(error) {
      failure = error;
    },
  };
}
