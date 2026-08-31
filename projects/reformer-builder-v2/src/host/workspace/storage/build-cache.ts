/**
 * Кэш сборки в OPFS: содержимое, адресуемое хешем, отдельно от рабочей копии.
 *
 * ## Почему это НЕ третий слой рабочей области
 *
 * `StorageLayer` — пара `files`/`base`, и на её парности держатся {@link counterpartLayer},
 * `removePair` и разбор пути ({@link parseStoragePath}): вытеснение идёт парой, иначе теряется
 * основание трёхстороннего слияния. Кэш производный — у него нет и не может быть «второй половины»,
 * поэтому третьим слоем он сломал бы инвариант, ради которого слои и заведены. Отсюда собственный
 * корень рядом с `ws/`, а не внутри него.
 *
 * ```text
 * OPFS
 * ├── ws/{workspaceId}/{files,base}/<путь>     рабочая копия
 * └── build/{workspaceId}/{версия}/
 *     ├── file/{xx}/{hash}.js                  транспиляция одного файла
 *     └── set/{xx}/{hash}.json                 весь набор одним чтением
 * ```
 *
 * ## Почему версия — каталог, а не файл-маркер
 *
 * Смена формата кэша обязана обесценить всё, что записано прежним. Маркер потребовал бы читать
 * его перед каждой операцией и сносить дерево при расхождении; каталог с номером не требует
 * ничего: новая версия просто не видит старую, а уборка — это удаление соседних номеров.
 *
 * ## Почему шардируем по двум знакам хеша
 *
 * Каталог OPFS с тысячами записей обходится медленно, а обход нужен уборке. Два знака дают
 * 256 корзин — при бюджете в тысячи файлов этого достаточно, и глубже вложенность только
 * удлинила бы путь.
 *
 * ## Промах — не ошибка, и отказ записи тоже
 *
 * Кэш ускоряет, а не хранит: любое чтение вправе ответить `null`, любая запись вправе тихо
 * не случиться (квота, приватный режим, отсутствие OPFS). Вызывающий обязан работать без него,
 * поэтому наружу отсюда исключения не летят вовсе — это единственный модуль хранилища с такой
 * политикой, и она следует из того, что терять здесь нечего.
 *
 * `navigator.storage.persist()` НЕ запрашиваем: содержимое одноразовое, и вытеснение браузером —
 * штатный режим (тот же довод, что в `packages/reformer-form-registry/src/storage/opfs.ts`).
 *
 * @module host/workspace/storage/build-cache
 */

import type { OpfsDirectoryHandle, OpfsFileHandle, OpfsStoreOptions } from './opfs';
import { assertWorkspaceId } from './layout';

/** Корень кэша сборки внутри OPFS. Сосед `ws/`, а не его часть. */
export const BUILD_ROOT_DIR = 'build';

/**
 * Версия раскладки кэша.
 *
 * Поднимается, когда меняется СМЫСЛ записанного: формат бандла набора, состав ключа, способ
 * склейки. Версия движка транспиляции сюда не входит — она часть ключа, и обесценивать ею
 * всё дерево не нужно.
 */
export const BUILD_CACHE_VERSION = 'v1';

/** Что лежит в кэше. Виды различаются форматом и потому хранятся врозь. */
export type BuildArtifactKind =
  /** Транспиляция одного файла: готовый JS. */
  | 'file'
  /** Весь набор одним чтением: JSON «путь → JS». */
  | 'set';

const EXTENSION: Readonly<Record<BuildArtifactKind, string>> = {
  file: '.js',
  set: '.json',
};

/**
 * Допустимый ключ — ровно то, что отдаёт `digestHex`.
 *
 * Проверка не педантизм, а граница: ключ приходит из вычисления, но путь строится из него,
 * и `../` в ключе означал бы запись мимо кэша. Отвергаем, а не кодируем — ключ порождаем мы сами,
 * значит вправе предъявить к нему требование.
 */
const HASH = /^[0-9a-f]{64}$/;

/** Одна запись кэша при обходе. */
interface CacheEntry {
  readonly kind: BuildArtifactKind;
  readonly shard: string;
  readonly name: string;
  readonly size: number;
  /** Время записи. Настоящий `File` его отдаёт; двойник может и не отдать — тогда `0`. */
  readonly writtenAt: number;
}

/** Что сделала уборка. */
export interface SweepResult {
  /** Сколько байт занимал кэш до уборки. */
  readonly bytesBefore: number;
  /** Сколько удалено записей. */
  readonly removed: number;
}

/** Кэш сборки одной рабочей области. */
export interface BuildCacheStore {
  readonly workspaceId: string;
  /** Текст артефакта либо `null` — промаха, отказа и битого ключа здесь не различают. */
  read(kind: BuildArtifactKind, hash: string): Promise<string | null>;
  /** Записывает артефакт. Отказ проглатывается: кэш не обязан получиться. */
  write(kind: BuildArtifactKind, hash: string, text: string): Promise<void>;
  /**
   * Ужимает кэш до бюджета, удаляя самые давние по времени ЗАПИСИ.
   *
   * Это не LRU: честный LRU требовал бы трогать файл на каждом попадании, то есть писать в кэш
   * при чтении — вдвое больше операций ради порядка вытеснения, который здесь почти совпадает.
   * Артефакт, который перестали пересобирать, и есть самый старый по записи.
   */
  sweep(budgetBytes: number): Promise<SweepResult>;
  /** Сносит кэш этой рабочей области целиком, включая прежние версии раскладки. */
  clear(): Promise<void>;
}

/** «Нет такого» — от любого движка приходит так же, как в `opfs.ts`. */
function isMissing(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
  );
}

/** Файл, каким его отдаёт OPFS, плюс время записи, которого нет в структурном типе `OpfsFile`. */
interface TimedFile {
  readonly size: number;
  readonly lastModified?: number;
  text(): Promise<string>;
}

async function defaultDirectory(): Promise<OpfsDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root as unknown as OpfsDirectoryHandle;
}

/**
 * Кэш сборки над OPFS.
 *
 * Фабрика синхронна и ничего не открывает: корень резолвится лениво, а неудача сбрасывает кэш
 * промиса — один отказ не должен делать кэш нерабочим навсегда.
 */
export function createBuildCacheStore(
  workspaceId: string,
  options: OpfsStoreOptions = {}
): BuildCacheStore {
  assertWorkspaceId(workspaceId);
  const provider = options.directory ?? defaultDirectory;

  let rootPromise: Promise<OpfsDirectoryHandle> | undefined;
  const root = (): Promise<OpfsDirectoryHandle> => {
    if (rootPromise !== undefined) return rootPromise;
    rootPromise = provider().catch((error: unknown) => {
      rootPromise = undefined;
      throw error;
    });
    return rootPromise;
  };

  /** Каталог по сегментам; `create` доделывает недостающие. */
  const dirAt = async (
    segments: readonly string[],
    create: boolean
  ): Promise<OpfsDirectoryHandle> => {
    let dir = await root();
    for (const segment of segments) {
      dir = await dir.getDirectoryHandle(segment, create ? { create: true } : undefined);
    }
    return dir;
  };

  const versionRoot = [BUILD_ROOT_DIR, workspaceId, BUILD_CACHE_VERSION];

  const fileAt = async (
    kind: BuildArtifactKind,
    hash: string,
    create: boolean
  ): Promise<OpfsFileHandle> => {
    const dir = await dirAt([...versionRoot, kind, hash.slice(0, 2)], create);
    return dir.getFileHandle(`${hash}${EXTENSION[kind]}`, create ? { create: true } : undefined);
  };

  return {
    workspaceId,

    async read(kind, hash) {
      if (!HASH.test(hash)) return null;
      try {
        const handle = await fileAt(kind, hash, false);
        return await (await handle.getFile()).text();
      } catch {
        return null;
      }
    },

    async write(kind, hash, text) {
      if (!HASH.test(hash)) return;
      try {
        const handle = await fileAt(kind, hash, true);
        // Только `createWritable`: он атомарен по спецификации (пишет в swap, коммитит
        // на `close`). Синхронный хэндл здесь не нужен — его выигрыш в скорости несопоставим
        // с ценой замка, а писать наполовину записанный кэш нельзя: он же исполняемый код.
        if (typeof handle.createWritable !== 'function') return;
        const writable = await handle.createWritable();
        try {
          await writable.write(text);
        } finally {
          await writable.close();
        }
      } catch {
        // Квота, приватный режим, гонка — кэш не обязан получиться.
      }
    },

    async sweep(budgetBytes) {
      const entries: CacheEntry[] = [];
      let bytesBefore = 0;

      for (const kind of ['file', 'set'] as const) {
        let kindDir: OpfsDirectoryHandle;
        try {
          kindDir = await dirAt([...versionRoot, kind], false);
        } catch {
          continue;
        }
        for await (const shard of kindDir.values()) {
          if (shard.kind !== 'directory') continue;
          for await (const entry of shard.values()) {
            if (entry.kind !== 'file') continue;
            let file: TimedFile;
            try {
              file = (await entry.getFile()) as TimedFile;
            } catch {
              continue;
            }
            bytesBefore += file.size;
            entries.push({
              kind,
              shard: shard.name,
              name: entry.name,
              size: file.size,
              writtenAt: file.lastModified ?? 0,
            });
          }
        }
      }

      if (bytesBefore <= budgetBytes) return { bytesBefore, removed: 0 };

      // Самые давние — первыми под нож. Имя вторым ключом, чтобы порядок был воспроизводим
      // там, где времени записи нет вовсе.
      entries.sort((a, b) => a.writtenAt - b.writtenAt || a.name.localeCompare(b.name));

      let bytes = bytesBefore;
      let removed = 0;
      for (const entry of entries) {
        if (bytes <= budgetBytes) break;
        try {
          const dir = await dirAt([...versionRoot, entry.kind, entry.shard], false);
          await dir.removeEntry(entry.name);
          bytes -= entry.size;
          removed += 1;
        } catch (error) {
          if (!isMissing(error)) throw error;
        }
      }
      return { bytesBefore, removed };
    },

    async clear() {
      try {
        const parent = await dirAt([BUILD_ROOT_DIR], false);
        await parent.removeEntry(workspaceId, { recursive: true });
      } catch (error) {
        if (isMissing(error)) return;
        throw error;
      }
    },
  };
}

/**
 * Какие рабочие области оставили после себя кэш.
 *
 * Нужно уборке брошенного: каталоги OPFS живут, пока их не удалить, а рабочую область могли
 * закрыть и забыть. Отдаёт то, что реально лежит на диске, — сверять со списком живых областей
 * будет вызывающий, ровно как это делает `listStoredWorkspaces` для рабочих копий.
 */
export async function listStoredBuildCaches(
  options: OpfsStoreOptions = {}
): Promise<readonly string[]> {
  const provider = options.directory ?? defaultDirectory;
  let parent: OpfsDirectoryHandle;
  try {
    parent = await (await provider()).getDirectoryHandle(BUILD_ROOT_DIR);
  } catch {
    return [];
  }
  const ids: string[] = [];
  for await (const entry of parent.values()) {
    if (entry.kind === 'directory') ids.push(entry.name);
  }
  return ids.sort((a, b) => a.localeCompare(b));
}
