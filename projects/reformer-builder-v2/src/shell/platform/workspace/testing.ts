/**
 * Подставной источник для тестов Workspace — с журналом обращений.
 *
 * **Журнал здесь не украшение, а способ проверить главное свойство контракта.** Утверждение
 * «`writeText` не трогает источник» нельзя проверить по состоянию: рабочая копия и без того
 * лежит в OPFS, а источник и без того не изменился бы, если бы запись просто не дошла.
 * Проверяется оно только тем, что в источник НЕ БЫЛО ОБРАЩЕНИЯ. То же и с «повторное открытие
 * не ходит в источник»: без счётчика чтений тест проходит на любой реализации.
 *
 * **Чем этот двойник отличается от файловой системы** — намеренно, по правилу приёмки Э3
 * («двойник полезен, только если устроен принципиально иначе»):
 *
 * - плоское пространство имён, каталоги синтезируются при листинге;
 * - ревизии — непрозрачные строки (`r1`, `r2`), а не время модификации: код, решивший,
 *   что ревизии сравнимы на «новее», обязан сломаться здесь, а не на первом сервере;
 * - отказы вводятся намеренно ({@link MemorySource.failNext}), включая конфликт записи;
 * - запись выключается целиком (`writable: false`) — источник без записи не объявляет метод.
 *
 * Файл лежит в `src`, а не рядом с одним тестом, по той же причине, что и
 * `storage/testing.ts`: им пользуются тесты Workspace, догрузки и вытеснения.
 *
 * @module shell/platform/workspace/testing
 */

import { normalizePath } from '@/shell/platform/primitives/resource';
import type {
  SourceBytes,
  SourceContent,
  SourceEntry,
  SourceErrorKind,
  SourceStat,
  SourceWritten,
  WorkspaceSource,
} from './source';

/** Отказ двойника. Форма — та же, что у `SourceError` из Э3: класс распознаётся структурно. */
export class TestSourceError extends Error {
  readonly kind: SourceErrorKind;
  readonly path?: string;
  readonly revision?: string;

  constructor(
    kind: SourceErrorKind,
    message: string,
    options: { path?: string; revision?: string } = {}
  ) {
    super(message);
    this.name = 'TestSourceError';
    this.kind = kind;
    this.path = options.path;
    this.revision = options.revision;
  }
}

/** Что и по какому пути спросили у источника. */
export interface SourceCall {
  readonly op: 'read' | 'readBytes' | 'list' | 'stat' | 'write';
  readonly path: string;
}

export interface MemorySourceOptions {
  readonly id?: string;
  /** `false` — источник только на чтение: метод `write` не объявляется вовсе. */
  readonly writable?: boolean;
  /** `false` — источник не умеет отдавать байты: `readBytes` не объявляется. */
  readonly binary?: boolean;
}

/** Двойник источника с журналом и внешними правками. */
export interface MemorySource extends WorkspaceSource {
  /** Все обращения по порядку. */
  readonly calls: readonly SourceCall[];
  /** Сколько раз спрашивали — всего или по конкретному пути. */
  countOf(op: SourceCall['op'], path?: string): number;
  /** Очищает журнал, не трогая содержимое: «дальше считаем с нуля». */
  forget(): void;

  /** Правка МИМО Workspace: так имитируется изменение файла снаружи. Ревизия растёт. */
  put(path: string, text: string): void;
  remove(path: string): void;
  textOf(path: string): string | undefined;
  revisionOf(path: string): string | undefined;

  /** Следующее обращение этого вида по этому пути отказывает. */
  failNext(op: SourceCall['op'], path: string, kind: SourceErrorKind): void;
}

interface StoredFile {
  text: string;
  revision: string;
}

/**
 * Источник в памяти.
 *
 * @param initial путь → содержимое. Пути нормализуются, ревизии выдаются автоматически.
 */
export function createMemorySource(
  initial: Readonly<Record<string, string>> = {},
  options: MemorySourceOptions = {}
): MemorySource {
  const id = options.id ?? 'mem';
  const files = new Map<string, StoredFile>();
  const calls: SourceCall[] = [];
  const failures: { op: SourceCall['op']; path: string; kind: SourceErrorKind }[] = [];
  let revisionSeq = 0;

  const nextRevision = (): string => {
    revisionSeq += 1;
    return `r${revisionSeq}`;
  };

  const put = (path: string, text: string): void => {
    files.set(normalizePath(path), { text, revision: nextRevision() });
  };

  for (const [path, text] of Object.entries(initial)) put(path, text);

  /** Записывает обращение и бросает отказ, если он был заказан. */
  const record = (op: SourceCall['op'], path: string): void => {
    calls.push({ op, path });
    const at = failures.findIndex((f) => f.op === op && f.path === path);
    if (at === -1) return;
    const failure = failures[at];
    failures.splice(at, 1);
    throw new TestSourceError(failure.kind, `${op} ${path}: отказ по заказу теста`, { path });
  };

  const source: MemorySource = {
    id,

    async read(path) {
      const key = normalizePath(path);
      record('read', key);
      const file = files.get(key);
      if (file === undefined) {
        throw new TestSourceError('not-found', `нет ресурса ${key}`, { path: key });
      }
      const content: SourceContent = { text: file.text, revision: file.revision };
      return content;
    },

    async list(dir) {
      const base = normalizePath(dir);
      record('list', base);
      const prefix = base === '' ? '' : `${base}/`;
      const seen = new Map<string, SourceEntry>();
      let matched = false;
      for (const path of files.keys()) {
        if (base !== '' && !path.startsWith(prefix)) continue;
        matched = true;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1) {
          seen.set(rest, { name: rest, path, kind: 'file' });
          continue;
        }
        // Каталог синтезируется: пространство имён плоское, дерева в нём нет.
        const name = rest.slice(0, slash);
        seen.set(name, { name, path: `${prefix}${name}`, kind: 'directory' });
      }
      if (!matched && base !== '') {
        throw new TestSourceError('not-found', `нет каталога ${base}`, { path: base });
      }
      return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    },

    async stat(path) {
      const key = normalizePath(path);
      record('stat', key);
      const file = files.get(key);
      if (file !== undefined) {
        const stat: SourceStat = {
          kind: 'file',
          revision: file.revision,
          size: file.text.length,
        };
        return stat;
      }
      const prefix = `${key}/`;
      for (const candidate of files.keys()) {
        if (candidate.startsWith(prefix)) return { kind: 'directory' };
      }
      return null;
    },

    get calls() {
      return calls;
    },

    countOf(op, path) {
      const key = path === undefined ? undefined : normalizePath(path);
      return calls.filter((call) => call.op === op && (key === undefined || call.path === key))
        .length;
    },

    forget() {
      calls.length = 0;
    },

    put,

    remove(path) {
      files.delete(normalizePath(path));
    },

    textOf(path) {
      return files.get(normalizePath(path))?.text;
    },

    revisionOf(path) {
      return files.get(normalizePath(path))?.revision;
    },

    failNext(op, path, kind) {
      failures.push({ op, path: normalizePath(path), kind });
    },
  };

  if (options.binary === true) {
    source.readBytes = async (path: string): Promise<SourceBytes> => {
      const key = normalizePath(path);
      record('readBytes', key);
      const file = files.get(key);
      if (file === undefined) {
        throw new TestSourceError('not-found', `нет ресурса ${key}`, { path: key });
      }
      return { bytes: new TextEncoder().encode(file.text), revision: file.revision };
    };
  }

  if (options.writable !== false) {
    source.write = async (
      path: string,
      text: string,
      expected?: string
    ): Promise<SourceWritten> => {
      const key = normalizePath(path);
      record('write', key);
      const file = files.get(key);
      // Конфликт — на РАВЕНСТВЕ ревизий, а не на «новее»: маркер непрозрачен.
      if (expected !== undefined && file !== undefined && file.revision !== expected) {
        throw new TestSourceError('conflict', `ревизия ${key} разошлась`, {
          path: key,
          revision: file.revision,
        });
      }
      put(key, text);
      return { revision: files.get(key)?.revision };
    };
  }

  return source;
}
