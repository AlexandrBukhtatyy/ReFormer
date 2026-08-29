/**
 * Источник поверх File System Access — локальный каталог проекта.
 *
 * **Переписан против контракта, а не перенесён из v1.** Три места, где v1 (`io/fs-access.ts`,
 * `io/fs-ops.ts`, `io/discovery.ts`) поступает плохо, и повторять это нельзя:
 *
 * 1. **Существование выясняется двумя обращениями** — сначала `getFileHandle`, потом
 *    `getDirectoryHandle`, оба через `try/catch` (`existsIn`). Здесь это ОДИН
 *    {@link createFsAccessSource | stat}: спецификация обязывает `getFileHandle` отказать
 *    `TypeMismatchError`, если имя занято каталогом, — то есть вид ресурса сообщает сам отказ,
 *    и второе обращение не нужно. Заодно возвращается не `boolean`, а вид: `stat` каталога
 *    обязан отвечать `kind: 'directory'`, иначе резолвер импортов не соберёт форму.
 * 2. **Подбор свободного имени делает до тысячи последовательных проверок** (`uniqueName`
 *    крутит `existsIn` в цикле — до 2000 обращений к ФС на одно копирование). Здесь такой
 *    операции нет вовсе: `list` отдаёт уровень одним обращением, и подбор имени — это подсчёт
 *    в памяти у вызывающего. Источник обязан лишь не заставлять его ходить по одному.
 * 3. **Обход каталога читает каждый `.json`-кандидат**, чтобы решить, форма ли это. Здесь
 *    {@link createFsAccessSource | list} не читает содержимого НИКОГДА (проверяется тестом
 *    контракта: после листинга счётчик прочитанных тел равен нулю). Классификация — предметное
 *    знание, источнику оно не принадлежит.
 *
 * **Что взято из v1 сознательно:** структурные типы хэндлов, объявленные локально (в `lib.dom`
 * при `lib: ["ES2022","DOM","DOM.Iterable"]` нет ни `values()`, ни `createWritable()`, ни
 * `move()`, ни `queryPermission()`), и пошаговый резолв каталога по сегментам пути —
 * другого способа адресоваться путём это API не даёт.
 *
 * **Ревизия — время модификации в виде строки.** Для вызывающего она непрозрачна, и это
 * важнее точности: сравнение идёт только на равенство. Известное ограничение — разрешение
 * `lastModified` (миллисекунда): две записи в один тик неотличимы. Для конфликта это
 * консервативно в опасную сторону (конфликт может быть не замечен), но лучшего маркера
 * File System Access не даёт — хеш содержимого стоил бы чтения файла на каждый `stat`.
 *
 * @module host/source/fs-access
 */

import { basename, dirname, joinPath, mediaTypeFor } from '../primitives/resource';
import { SourceError, isSourceError, sourcePath, unsupported } from './errors';
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

/*
 * ──────────────────────  Структурные типы File System Access  ──────────────────────
 *
 * Объявлены локально по той же причине, что и типы OPFS в `workspace/storage/opfs.ts`:
 * штатные слишком неполны, а приведения по месту расползлись бы по всему модулю. Побочная
 * выгода — подставной каталог из `testing.ts` реализует ровно эти интерфейсы, без `any`.
 */

/** Файл, каким его отдаёт хэндл. Тело читается ЛЕНИВО: `size`/`lastModified` его не трогают. */
export interface FsFile {
  readonly size: number;
  readonly lastModified: number;
  /** Медиатип по мнению браузера. Часто пустая строка — тогда решает таблица расширений ядра. */
  readonly type: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Поток записи: пишет в swap-файл, коммитит на `close()`. */
export interface FsWritable {
  write(data: Uint8Array | string): Promise<void>;
  close(): Promise<void>;
}

/** Хэндл файла. `createWritable`/`move` необязательны — их наличие и есть детект возможности. */
export interface FsFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<FsFile>;
  createWritable?(): Promise<FsWritable>;
  move?(parent: FsDirectoryHandle, name?: string): Promise<void>;
}

/** Хэндл каталога. */
export interface FsDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterableIterator<FsFileHandle | FsDirectoryHandle>;
  move?(parent: FsDirectoryHandle, name?: string): Promise<void>;
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

/*
 * ────────────────────────────────  Перевод отказов  ────────────────────────────────
 */

/**
 * `DOMException.name` → вид отказа.
 *
 * Имена — часть спецификации File System Access, а не деталь Chromium, поэтому опираться
 * на них можно. Всё, чего в таблице нет, — `network`: неопознанный сбой ввода-вывода лучше
 * назвать транспортным (вызывающий остановится и скажет), чем «нет файла» (пойдёт дальше
 * с пустотой).
 */
const KIND_BY_DOM_NAME: Readonly<Record<string, SourceError['kind'] | undefined>> = {
  NotFoundError: 'not-found',
  TypeMismatchError: 'not-found',
  NotAllowedError: 'unauthorized',
  SecurityError: 'forbidden',
  NoModificationAllowedError: 'forbidden',
  InvalidModificationError: 'forbidden',
  QuotaExceededError: 'budget',
  AbortError: 'aborted',
};

const nameOf = (err: unknown): string => (err instanceof Error ? err.name : '');

/** Имени нет — значит, каталог занят файлом или наоборот. Ответ спецификации, не авария. */
const isNotFound = (err: unknown): boolean => nameOf(err) === 'NotFoundError';
/** Имя есть, но это НЕ то, что просили: файл вместо каталога или каталог вместо файла. */
const isTypeMismatch = (err: unknown): boolean => nameOf(err) === 'TypeMismatchError';

/** Приводит сбой хэндла к типизированному отказу. Уже типизированный — пропускает как есть. */
function toSourceError(err: unknown, operation: string, path: string): SourceError {
  if (isSourceError(err)) return err as SourceError;
  const kind = KIND_BY_DOM_NAME[nameOf(err)] ?? 'network';
  const detail = err instanceof Error ? err.message : String(err);
  return new SourceError(kind, `${operation}: ${path} (${detail})`, { path, cause: err });
}

/*
 * ────────────────────────────────  Резолв каталога  ────────────────────────────────
 */

const segmentsOf = (path: string): readonly string[] => (path === '' ? [] : path.split('/'));

/**
 * Каталог по пути или `null`, если его там нет.
 *
 * `null`, а не отказ: вызывающие отвечают на отсутствие по-разному — `stat` возвращает `null`,
 * `list` отказывает `not-found`, `write` жалуется на каталог, а не на файл. Решать это внутри
 * резолва значило бы зашить в него чужую политику.
 */
async function findDirectory(
  root: FsDirectoryHandle,
  path: string
): Promise<FsDirectoryHandle | null> {
  let current = root;
  for (const segment of segmentsOf(path)) {
    try {
      current = await current.getDirectoryHandle(segment);
    } catch (err) {
      if (isNotFound(err) || isTypeMismatch(err)) return null;
      throw toSourceError(err, 'открытие каталога', path);
    }
  }
  return current;
}

/** Каталог по пути, доделывая недостающие уровни. */
async function makeDirectory(root: FsDirectoryHandle, path: string): Promise<FsDirectoryHandle> {
  let current = root;
  for (const segment of segmentsOf(path)) {
    try {
      current = await current.getDirectoryHandle(segment, { create: true });
    } catch (err) {
      throw toSourceError(err, 'создание каталога', path);
    }
  }
  return current;
}

/** Хэндл файла или `null`. Каталог по этому пути — тоже `null`: файла там нет. */
async function findFile(
  parent: FsDirectoryHandle,
  name: string,
  path: string
): Promise<FsFileHandle | null> {
  try {
    return await parent.getFileHandle(name);
  } catch (err) {
    if (isNotFound(err) || isTypeMismatch(err)) return null;
    throw toSourceError(err, 'открытие файла', path);
  }
}

/** Ревизия файла: время модификации строкой. Непрозрачна для всех, включая нас. */
const revisionOf = (file: FsFile): string => String(file.lastModified);

/*
 * ────────────────────────────────  Разрешения  ────────────────────────────────
 */

/**
 * Подтверждает доступ к каталогу: сначала спрашивает уже выданное, потом просит.
 *
 * **Источник без модели разрешений отвечает «доступ есть», а не «метода нет».** Это шов, в
 * который у источника с аутентификацией встанет запрос токена, поэтому отсутствие методов
 * здесь — не повод отменять переоткрытие (именно так делает v1, и там это верно лишь потому,
 * что источник ровно один).
 */
export async function ensureFsPermission(
  handle: FsDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  if (handle.queryPermission === undefined && handle.requestPermission === undefined) return true;
  if (handle.queryPermission !== undefined) {
    if ((await handle.queryPermission({ mode })) === 'granted') return true;
  }
  if (handle.requestPermission !== undefined) {
    if ((await handle.requestPermission({ mode })) === 'granted') return true;
  }
  return false;
}

/*
 * ────────────────────────────────  Источник  ────────────────────────────────
 */

/** Настройки адаптера. */
export interface FsAccessSourceOptions {
  /** Идентификатор источника — первая половина `ResourceId`. По умолчанию — `handleKey`. */
  readonly id?: string;
  /** Ключ, по которому хэндл каталога лежит в хранилище. Он же едет в дескриптор. */
  readonly handleKey?: string;
  /**
   * Каталог открыт только на чтение: методы изменения не объявляются вовсе.
   *
   * Нужно не ради полноты: разрешение `readwrite` могло быть не выдано, и источник обязан
   * честно сказать об этом возможностями, а не отказывать на каждой записи.
   */
  readonly readOnly?: boolean;
  /** Потолок листинга одного уровня. По умолчанию {@link SOURCE_LIST_LIMIT}. */
  readonly listLimit?: number;
}

/**
 * Источник поверх выбранного каталога.
 *
 * @param root хэндл каталога проекта — из `showDirectoryPicker()` или из IndexedDB.
 */
export function createFsAccessSource(
  root: FsDirectoryHandle,
  options: FsAccessSourceOptions = {}
): Source {
  const handleKey = options.handleKey ?? options.id ?? 'fs';
  const id = options.id ?? handleKey;
  const listLimit = options.listLimit ?? SOURCE_LIST_LIMIT;
  const writable = options.readOnly !== true;

  const descriptor: SourceDescriptor = { kind: 'fs', handleKey };
  const capabilities: SourceCapabilities = {
    write: writable,
    tree: true,
    revisions: true,
    // Единственный источник, которому это разрешено: код лежит на машине пользователя,
    // а не приехал по сети (умолчание для всех остальных — `false`).
    executesCode: true,
    // Разрешение переживает перезагрузку не всегда и переспрашивается при переоткрытии.
    auth: 'session',
  };

  /** Хэндл файла для чтения. Отсутствие — отказ: у чтения нет осмысленного пустого ответа. */
  const fileFor = async (path: string): Promise<FsFileHandle> => {
    const parent = await findDirectory(root, dirname(path));
    if (parent === null)
      throw new SourceError('not-found', `нет каталога ${dirname(path)}`, { path });
    const handle = path === '' ? null : await findFile(parent, basename(path), path);
    if (handle === null) throw new SourceError('not-found', `нет файла ${path}`, { path });
    return handle;
  };

  const source: Source = {
    id,
    descriptor,
    capabilities,

    async read(path) {
      const target = sourcePath(path);
      const file = await (await fileFor(target)).getFile();
      const content: SourceContent = {
        text: await file.text(),
        revision: revisionOf(file),
        mediaType: mediaTypeFor(target, file.type),
      };
      return content;
    },

    async readBytes(path) {
      const target = sourcePath(path);
      const file = await (await fileFor(target)).getFile();
      const bytes: SourceBytes = {
        bytes: new Uint8Array(await file.arrayBuffer()),
        revision: revisionOf(file),
        mediaType: mediaTypeFor(target, file.type),
      };
      return bytes;
    },

    async list(dir) {
      const base = sourcePath(dir);
      const handle = await findDirectory(root, base);
      if (handle === null) {
        // Отказ, а не пустой список: «каталога нет» и «каталог пуст» — разные указания.
        throw new SourceError('not-found', `нет каталога ${base}`, { path: base });
      }
      const entries: Entry[] = [];
      try {
        for await (const child of handle.values()) {
          if (entries.length >= listLimit) {
            throw new SourceError(
              'budget',
              `в каталоге ${base} больше ${listLimit} записей: это похоже на node_modules, а не на проект`,
              { path: base }
            );
          }
          entries.push({
            name: child.name,
            path: joinPath(base, child.name),
            kind: child.kind,
          });
        }
      } catch (err) {
        throw toSourceError(err, 'листинг', base);
      }
      return sortEntries(entries);
    },

    async stat(path) {
      const target = sourcePath(path);
      // Корень источника существует всегда, и спрашивать о нём ФС нечего.
      if (target === '') return { kind: 'directory' };

      const parent = await findDirectory(root, dirname(target));
      if (parent === null) return null;

      try {
        const file = await (await parent.getFileHandle(basename(target))).getFile();
        const stat: Stat = {
          kind: 'file',
          revision: revisionOf(file),
          size: file.size,
          mediaType: mediaTypeFor(target, file.type),
        };
        return stat;
      } catch (err) {
        // ОДНО обращение вместо двух: отказ сам сообщил, что имя занято каталогом.
        if (isTypeMismatch(err)) return { kind: 'directory' };
        if (isNotFound(err)) return null;
        throw toSourceError(err, 'stat', target);
      }
    },
  };

  if (!writable) return source;

  /**
   * Общее тело записи для текста и байтов.
   *
   * Разведены только точки входа: проверка ревизии, создание файла и атомарность на `close()`
   * у них буква в букву одни и те же, а поток записи File System Access принимает и строку,
   * и `Uint8Array` без различия. Две копии этого тела разошлись бы на первой же правке
   * детекта конфликта — то есть там, где расхождение дороже всего.
   */
  const writeData = async (
    path: string,
    data: string | Uint8Array,
    expected?: string
  ): Promise<Written> => {
    const target = sourcePath(path);
    const parent = await findDirectory(root, dirname(target));
    if (parent === null) {
      throw new SourceError('not-found', `нет каталога ${dirname(target)}`, { path: target });
    }

    if (expected !== undefined) {
      const existing = await findFile(parent, basename(target), target);
      // Файла нет вовсе — это НЕ конфликт: запись его восстановит, а требовать слияния
      // с пустотой не с чем. Конфликт — только расхождение существующих ревизий, и только
      // на равенстве: «новее» у непрозрачного маркера не вычисляется.
      if (existing !== null) {
        const current = revisionOf(await existing.getFile());
        if (current !== expected) {
          throw new SourceError('conflict', `ревизия ${target} разошлась с источником`, {
            path: target,
            revision: current,
          });
        }
      }
    }

    let handle: FsFileHandle;
    try {
      handle = await parent.getFileHandle(basename(target), { create: true });
    } catch (err) {
      throw toSourceError(err, 'создание файла', target);
    }
    if (handle.createWritable === undefined) throw unsupported('запись', target);

    try {
      const writer = await handle.createWritable();
      await writer.write(data);
      await writer.close();
    } catch (err) {
      throw toSourceError(err, 'запись', target);
    }
    return { revision: revisionOf(await handle.getFile()) };
  };

  source.write = (path: string, text: string, expected?: string): Promise<Written> =>
    writeData(path, text, expected);

  source.writeBytes = (path: string, bytes: Uint8Array, expected?: string): Promise<Written> =>
    writeData(path, bytes, expected);

  source.mkdir = async (path: string): Promise<void> => {
    await makeDirectory(root, sourcePath(path));
  };

  source.remove = async (path: string): Promise<void> => {
    const target = sourcePath(path);
    if (target === '') throw new SourceError('forbidden', 'нельзя удалить корень источника');
    const parent = await findDirectory(root, dirname(target));
    if (parent === null) throw new SourceError('not-found', `нет ${target}`, { path: target });
    try {
      await parent.removeEntry(basename(target), { recursive: true });
    } catch (err) {
      throw toSourceError(err, 'удаление', target);
    }
  };

  source.move = async (from: string, to: string): Promise<void> => {
    const src = sourcePath(from);
    const dst = sourcePath(to);
    const srcParent = await findDirectory(root, dirname(src));
    if (srcParent === null) throw new SourceError('not-found', `нет ${src}`, { path: src });

    // Здесь два обращения оправданы, и это не тот случай, что в v1: нужен сам ОБЪЕКТ, а не
    // ответ «существует ли», и первый отказ уже сообщил, каким он оказался.
    let handle: FsFileHandle | FsDirectoryHandle | null = await findFile(
      srcParent,
      basename(src),
      src
    );
    if (handle === null) {
      try {
        handle = await srcParent.getDirectoryHandle(basename(src));
      } catch (err) {
        if (isNotFound(err) || isTypeMismatch(err)) {
          throw new SourceError('not-found', `нет ${src}`, { path: src });
        }
        throw toSourceError(err, 'перемещение', src);
      }
    }

    const target = await findDirectory(root, dirname(dst));
    if (target === null) {
      throw new SourceError('not-found', `нет каталога ${dirname(dst)}`, { path: dst });
    }
    if (handle.move === undefined) throw unsupported('перемещение', src);
    try {
      await handle.move(target, basename(dst));
    } catch (err) {
      throw toSourceError(err, 'перемещение', src);
    }
  };

  return source;
}

/**
 * Порядок листинга: каталоги, затем файлы, каждый по имени.
 *
 * Детерминированность — часть контракта, а не украшение: `values()` отдаёт записи в порядке
 * файловой системы, и дерево, перерисованное после единственной записи, иначе меняет порядок
 * само по себе.
 */
function sortEntries(entries: Entry[]): readonly Entry[] {
  return entries.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
  );
}

/*
 * ────────────────────────────────  Переоткрытие  ────────────────────────────────
 */

/** Где живут хэндлы каталогов между сессиями. В приложении — IndexedDB (Э2). */
export interface FsHandleStore {
  /** Хэндл по ключу или `null`, если его там нет. */
  open(handleKey: string): Promise<FsDirectoryHandle | null>;
}

/** Настройки фабрики. */
export interface FsSourceFactoryOptions {
  readonly readOnly?: boolean;
  readonly listLimit?: number;
  /** Точка подмены запроса разрешения — в тестах и там, где режим известен заранее. */
  readonly ensureAccess?: (handle: FsDirectoryHandle) => Promise<boolean>;
}

/** Вид источника, под которым фабрика встаёт в реестр. */
export const FS_SOURCE_KIND = 'fs';

/**
 * Фабрика: дескриптор → живой источник.
 *
 * Не поднялось — обычный ход событий, а не авария, и случаев ДВА, различимых по ответу:
 *
 * - `missing` — хэндла в хранилище нет: проект открывали на другой машине, базу почистили,
 *   каталог удалили. Поднимать нечего, и человеку остаётся выбрать проект заново;
 * - `denied` — хэндл есть, а разрешения нет: его не выдали, отозвали, либо спросить было
 *   некогда — `requestPermission` требует жеста пользователя, а восстановление идёт на старте.
 *   Здесь человеку хватит одного «разрешить», и повторный `restore` из обработчика нажатия
 *   уже сможет спросить.
 *
 * Слить их в один ответ значило бы предложить одну кнопку на два разных случая — см.
 * {@link SourceUnavailableReason}.
 */
export function createFsSourceFactory(
  store: FsHandleStore,
  options: FsSourceFactoryOptions = {}
): SourceFactory {
  const mode = options.readOnly === true ? 'read' : 'readwrite';
  const ensureAccess =
    options.ensureAccess ?? ((handle: FsDirectoryHandle) => ensureFsPermission(handle, mode));

  return {
    kind: FS_SOURCE_KIND,
    async restore(descriptor) {
      // Чужой вид — «этого источника у меня нет»: реестр разводит по видам сам, и сюда такой
      // дескриптор попадает только от того, кто позвал фабрику напрямую.
      if (descriptor.kind !== FS_SOURCE_KIND) return { unavailable: 'missing' };
      const handle = await store.open(descriptor.handleKey);
      if (handle === null) return { unavailable: 'missing' };
      if (!(await ensureAccess(handle))) return { unavailable: 'denied' };
      return createFsAccessSource(handle, {
        id: descriptor.handleKey,
        handleKey: descriptor.handleKey,
        readOnly: options.readOnly,
        listLimit: options.listLimit,
      });
    },
  };
}

/*
 * ────────────────────────────────  Вход в браузере  ────────────────────────────────
 */

interface DirectoryPicker {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FsDirectoryHandle>;
}

/** Есть ли File System Access в этом движке. Chromium — да, остальные — пока нет. */
export function fsAccessSupported(): boolean {
  return typeof (globalThis as DirectoryPicker).showDirectoryPicker === 'function';
}

/**
 * Показывает выбор каталога.
 *
 * `readwrite` запрашивается сразу: разделение на «сначала чтение, потом запись» даёт
 * пользователю два диалога вместо одного, а отказаться он может и в первом.
 */
export function pickFsDirectory(
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<FsDirectoryHandle> {
  const picker = globalThis as DirectoryPicker;
  if (picker.showDirectoryPicker === undefined) {
    throw unsupported('выбор каталога: File System Access недоступен');
  }
  // Вызываем МЕТОДОМ на глобальном объекте — иначе TypeError: Illegal invocation.
  return picker.showDirectoryPicker({ mode });
}
