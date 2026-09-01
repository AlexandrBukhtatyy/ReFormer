/**
 * Тестовый двойник источника — ВТОРАЯ реализация контракта, а не копия первой.
 *
 * HTTP-источник отложен, поэтому проверять контракт больше нечем: единственная реализация
 * всегда «соответствует» контракту, потому что контракт из неё и вычитали. Двойник эту роль
 * выполняет, только если устроен ПРИНЦИПИАЛЬНО ИНАЧЕ — файловая система в памяти не проверяет
 * ничего, кроме умения писать в `Map`.
 *
 * Отсюда список расхождений, и каждое ловит свой класс ошибок:
 *
 * | Свойство    | File System Access        | Здесь                                          |
 * | ----------- | ------------------------- | ---------------------------------------------- |
 * | Структура   | дерево каталогов          | плоское пространство имён, `tree: false`       |
 * | Ревизии     | время модификации, число  | непрозрачная строка БЕЗ порядка                |
 * | Задержка    | пренебрежимая             | настраиваемая, всегда ненулевая                |
 * | Отказы      | редкие                    | вводятся намеренно: {@link MemorySource.failNext} |
 * | Возможности | почти все включены        | по умолчанию `write: false`, `executesCode: false` |
 *
 * **Что именно ловит каждое расхождение.**
 *
 * - *Плоское пространство имён*: код, считающий, что путь — это обязательно навигация
 *   по каталогам. Каталоги здесь СИНТЕЗИРУЮТСЯ при листинге, потому что `tree: false`
 *   означает «нет навигации по дереву», а не «нет путей»: `stat` каталога обязан отвечать
 *   `kind: 'directory'` и здесь тоже — на этом держится резолвер импортов.
 * - *Ревизии без порядка* (`rev-3k1`, а не `1712345678901`): код, решивший, что ревизии
 *   сравнимы на «новее». Он обязан сломаться здесь, а не на первом настоящем сервере.
 * - *Ненулевая задержка*: код, который «работает», потому что промис успевал разрешиться
 *   до следующей строки.
 * - *Намеренные отказы*: ветки `unauthorized` и `network`, которые на локальном диске
 *   не воспроизводятся вообще никогда.
 * - *Выключенная запись*: разница между «возможности нет» и «метод упал».
 *
 * @module shell/platform/source/memory
 */

import { joinPath, mediaTypeFor } from '@/shell/platform/primitives/resource';
import { SourceError, sourcePath } from './errors';
import type { SourceErrorKind } from './errors';
import type {
  Entry,
  Source,
  SourceBytes,
  SourceCapabilities,
  SourceContent,
  SourceDescriptor,
  SourceFactory,
  Stat,
  Written,
} from './types';
import { SOURCE_LIST_LIMIT } from './types';

/** Операции, которые двойник умеет учитывать и заваливать. */
export type MemoryOp = 'read' | 'readBytes' | 'list' | 'stat' | 'write' | 'remove' | 'move';

/** Обращение к источнику — что и по какому пути спросили. */
export interface MemoryCall {
  readonly op: MemoryOp;
  readonly path: string;
}

/** Настройки двойника. */
export interface MemorySourceOptions {
  /** Идентификатор источника. По умолчанию совпадает с {@link MemorySourceOptions.label}. */
  readonly id?: string;
  /** Метка, по которой источник находится при восстановлении из дескриптора. */
  readonly label?: string;
  /**
   * Включить запись. По умолчанию ВЫКЛЮЧЕНА: двойник обязан представлять и источник,
   * у которого возможности нет, — иначе эта ветка не проверяется никогда.
   */
  readonly writable?: boolean;
  /** Задержка каждой операции, миллисекунды. Ноль запрещён: нулевая задержка ничего не ловит. */
  readonly delayMs?: number;
  /** Потолок листинга. По умолчанию {@link SOURCE_LIST_LIMIT}. */
  readonly listLimit?: number;
}

/** Двойник: источник плюс то, чем его дёргают тесты. */
export interface MemorySource extends Source {
  /** Все обращения по порядку. */
  readonly calls: readonly MemoryCall[];
  /**
   * Сколько раз источник ОТДАЛ тело файла.
   *
   * Счётчик N+1: после листинга каталога он обязан остаться нулём, что бы в каталоге ни лежало.
   */
  readonly bodyReads: number;
  /** Обнуляет счётчики, не трогая содержимое. */
  forget(): void;

  /** Правка МИМО контракта: так имитируется изменение снаружи. Ревизия меняется. */
  put(path: string, text: string, mediaType?: string): void;
  /** Удаление мимо контракта. */
  drop(path: string): void;
  textOf(path: string): string | undefined;
  revisionOf(path: string): string | undefined;

  /**
   * Завалить следующую операцию.
   *
   * Без цели — заваливает ближайшую любую (так проверяется, что вызывающий вообще
   * различает отказы); с целью — только совпавшую по операции и пути.
   */
  failNext(kind: SourceErrorKind, target?: { op?: MemoryOp; path?: string }): void;
}

interface StoredFile {
  text: string;
  bytes: number;
  revision: string;
  mediaType?: string;
}

interface PlannedFailure {
  kind: SourceErrorKind;
  op?: MemoryOp;
  path?: string;
}

/** Вид источника, под которым двойник встаёт в реестр. */
export const MEMORY_SOURCE_KIND = 'memory';

/**
 * Живые двойники по метке.
 *
 * Аналог IndexedDB с хэндлами каталогов: дескриптор сериализуем, а объект — нет, и поднять
 * его можно только из места, где он остался жив. Для двойника таким местом является память
 * процесса, и это ровно та же семантика, а не поблажка.
 */
const LIVE = new Map<string, MemorySource>();

/**
 * Непрозрачная ревизия.
 *
 * Намеренно НЕ монотонна: последовательность даёт `rev-25f`, `rev-4rr`, `rev-6nr`, …, и всякая
 * попытка сравнить ревизии на «больше» получает бессмысленный ответ. Детерминированность
 * при этом сохранена — тесты воспроизводимы.
 */
const revisionAt = (seq: number): string => `rev-${((seq * 7919) % 10007).toString(36)}`;

/**
 * Создаёт двойник.
 *
 * @param initial путь → содержимое. Пути нормализуются как у любого источника.
 */
export function createMemorySource(
  initial: Readonly<Record<string, string>> = {},
  options: MemorySourceOptions = {}
): MemorySource {
  const label = options.label ?? 'memory';
  const id = options.id ?? label;
  const writable = options.writable === true;
  const delayMs = options.delayMs ?? 1;
  const listLimit = options.listLimit ?? SOURCE_LIST_LIMIT;
  if (delayMs <= 0) throw new Error('задержка двойника обязана быть ненулевой');

  const files = new Map<string, StoredFile>();
  const calls: MemoryCall[] = [];
  const failures: PlannedFailure[] = [];
  let revisionSeq = 0;
  let bodyReads = 0;

  const encoder = new TextEncoder();

  const put = (path: string, text: string, mediaType?: string): void => {
    revisionSeq += 1;
    files.set(sourcePath(path), {
      text,
      bytes: encoder.encode(text).length,
      revision: revisionAt(revisionSeq),
      mediaType,
    });
  };

  for (const [path, text] of Object.entries(initial)) put(path, text);

  const delay = (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });

  /** Ждёт, записывает обращение и бросает заказанный отказ, если он подходит. */
  const enter = async (op: MemoryOp, path: string): Promise<void> => {
    await delay();
    calls.push({ op, path });
    const at = failures.findIndex(
      (f) => (f.op === undefined || f.op === op) && (f.path === undefined || f.path === path)
    );
    if (at === -1) return;
    const failure = failures[at];
    failures.splice(at, 1);
    throw new SourceError(failure.kind, `${op} ${path}: отказ по заказу теста`, {
      path,
      // Конфликт обязан нести текущую ревизию — даже заказанный вручную.
      revision: failure.kind === 'conflict' ? files.get(path)?.revision : undefined,
    });
  };

  /** Есть ли под этим префиксом хоть что-нибудь: так здесь выглядит «каталог существует». */
  const hasPrefix = (base: string): boolean => {
    const prefix = `${base}/`;
    for (const path of files.keys()) if (path.startsWith(prefix)) return true;
    return false;
  };

  const statOf = (path: string): Stat | null => {
    const file = files.get(path);
    if (file !== undefined) {
      return {
        kind: 'file',
        revision: file.revision,
        size: file.bytes,
        mediaType: mediaTypeFor(path, file.mediaType),
      };
    }
    // Каталог здесь — не объект, а наблюдение: под этим префиксом что-то лежит.
    return path !== '' && hasPrefix(path) ? { kind: 'directory' } : null;
  };

  const descriptor: SourceDescriptor = { kind: MEMORY_SOURCE_KIND, label };
  const capabilities: SourceCapabilities = {
    write: writable,
    // Плоское пространство имён: каталогов нет, а пути есть. Создавать каталог нечем.
    tree: false,
    revisions: true,
    // Умолчание для всего, кроме локальной ФС: код, пришедший не с диска, не исполняем.
    executesCode: false,
    auth: 'none',
  };

  const source: MemorySource = {
    id,
    descriptor,
    capabilities,

    async read(path: string): Promise<SourceContent> {
      const target = sourcePath(path);
      await enter('read', target);
      const file = files.get(target);
      if (file === undefined)
        throw new SourceError('not-found', `нет ресурса ${target}`, { path: target });
      bodyReads += 1;
      return {
        text: file.text,
        revision: file.revision,
        mediaType: mediaTypeFor(target, file.mediaType),
      };
    },

    async readBytes(path: string): Promise<SourceBytes> {
      const target = sourcePath(path);
      await enter('readBytes', target);
      const file = files.get(target);
      if (file === undefined)
        throw new SourceError('not-found', `нет ресурса ${target}`, { path: target });
      bodyReads += 1;
      return {
        bytes: encoder.encode(file.text),
        revision: file.revision,
        mediaType: mediaTypeFor(target, file.mediaType),
      };
    },

    async list(dir: string): Promise<readonly Entry[]> {
      const base = sourcePath(dir);
      await enter('list', base);
      if (base !== '' && !hasPrefix(base)) {
        throw new SourceError('not-found', `нет каталога ${base}`, { path: base });
      }
      const prefix = base === '' ? '' : `${base}/`;
      const seen = new Map<string, Entry>();
      for (const path of files.keys()) {
        if (base !== '' && !path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1) {
          seen.set(rest, { name: rest, path, kind: 'file' });
        } else {
          // Каталог СИНТЕЗИРУЕТСЯ: пространство имён плоское, объекта-каталога в нём нет.
          const name = rest.slice(0, slash);
          seen.set(name, { name, path: `${prefix}${name}`, kind: 'directory' });
        }
        if (seen.size > listLimit) {
          throw new SourceError('budget', `в каталоге ${base} больше ${listLimit} записей`, {
            path: base,
          });
        }
      }
      return [...seen.values()].sort((a, b) =>
        a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
      );
    },

    async stat(path: string): Promise<Stat | null> {
      const target = sourcePath(path);
      await enter('stat', target);
      if (target === '') return { kind: 'directory' };
      return statOf(target);
    },

    get calls(): readonly MemoryCall[] {
      return calls;
    },

    get bodyReads(): number {
      return bodyReads;
    },

    forget(): void {
      calls.length = 0;
      bodyReads = 0;
    },

    put,

    drop(path: string): void {
      files.delete(sourcePath(path));
    },

    textOf(path: string): string | undefined {
      return files.get(sourcePath(path))?.text;
    },

    revisionOf(path: string): string | undefined {
      return files.get(sourcePath(path))?.revision;
    },

    failNext(kind: SourceErrorKind, target: { op?: MemoryOp; path?: string } = {}): void {
      failures.push({
        kind,
        op: target.op,
        path: target.path === undefined ? undefined : sourcePath(target.path),
      });
    },
  };

  if (writable) {
    source.write = async (path: string, text: string, expected?: string): Promise<Written> => {
      const target = sourcePath(path);
      await enter('write', target);
      const file = files.get(target);
      // Конфликт — на РАВЕНСТВЕ ревизий. Исчезнувший файл не конфликтует: восстановить его
      // записью безопаснее, чем требовать слияния с пустотой.
      if (expected !== undefined && file !== undefined && file.revision !== expected) {
        throw new SourceError('conflict', `ревизия ${target} разошлась с источником`, {
          path: target,
          revision: file.revision,
        });
      }
      put(target, text, file?.mediaType);
      return { revision: files.get(target)?.revision };
    };

    source.remove = async (path: string): Promise<void> => {
      const target = sourcePath(path);
      await enter('remove', target);
      if (target === '') throw new SourceError('forbidden', 'нельзя удалить корень источника');
      if (files.delete(target)) return;
      // Удаление «каталога» — это удаление всего под префиксом: объекта-каталога здесь нет.
      const prefix = `${target}/`;
      const victims = [...files.keys()].filter((key) => key.startsWith(prefix));
      if (victims.length === 0) {
        throw new SourceError('not-found', `нет ресурса ${target}`, { path: target });
      }
      for (const victim of victims) files.delete(victim);
    };

    source.move = async (from: string, to: string): Promise<void> => {
      const src = sourcePath(from);
      const dst = sourcePath(to);
      await enter('move', src);
      const file = files.get(src);
      if (file !== undefined) {
        files.delete(src);
        files.set(dst, file);
        return;
      }
      const prefix = `${src}/`;
      const victims = [...files.keys()].filter((key) => key.startsWith(prefix));
      if (victims.length === 0) {
        throw new SourceError('not-found', `нет ресурса ${src}`, { path: src });
      }
      for (const victim of victims) {
        const moved = files.get(victim);
        if (moved === undefined) continue;
        files.delete(victim);
        files.set(joinPath(dst, victim.slice(prefix.length)), moved);
      }
    };
  }

  LIVE.set(label, source);
  return source;
}

/**
 * Фабрика двойника.
 *
 * Восстанавливает источник по метке из живых. Метки нет — `missing`: тот же ответ, что у
 * File System Access, когда хэндл не пережил хранилище. Ответа `denied` у двойника нет и быть
 * не может: модели разрешений у него нет вовсе, и выдумывать отказ доступа значило бы дать
 * интерфейсу кнопку «разрешить», за которой ничего не стоит.
 */
export function createMemorySourceFactory(): SourceFactory {
  return {
    kind: MEMORY_SOURCE_KIND,
    async restore(descriptor) {
      if (descriptor.kind !== MEMORY_SOURCE_KIND) return { unavailable: 'missing' };
      return LIVE.get(descriptor.label) ?? { unavailable: 'missing' };
    },
  };
}

/** Забывает живые двойники — чтобы метки не протекали между наборами тестов. */
export function forgetMemorySources(): void {
  LIVE.clear();
}
