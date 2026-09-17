/**
 * Хранилище установленных плагинов: файлы в OPFS и запись о том, что установлено.
 *
 * ## Почему рядом с рабочей областью, но НЕ внутри неё
 *
 * Рабочая область живёт в `ws/{workspaceId}/` и принадлежит проекту. Установленный плагин
 * принадлежит человеку: решение «поставить acme-forms» он принимает один раз, а проектов
 * у него много. Поэтому корень свой — `plugins/`, — и смена проекта установленного
 * не касается. Проектным остаётся другое, и это решено отдельно: ЗАПУСК плагина. Включённость
 * и подтверждённые права по-прежнему принадлежат проекту (`../catalog`), так что чужой код
 * не поднимется в проекте, которого человек ещё не открывал.
 *
 * ## Версия в пути, а не поверх прошлой
 *
 * `plugins/<id>/<version>/…` — установка новой версии НЕ затирает прежнюю. Это цена одного
 * каталога на версию против отката, который иначе означал бы «скачайте старую заново»
 * в момент, когда новая уже сломала работу. Какая версия действует, говорит запись
 * ({@link InstalledPluginRecord.version}), а не наличие файлов.
 *
 * ## Запись — источник правды о составе
 *
 * `plugins/installed.json` перечисляет установленное: пакет, действующая версия, подпись,
 * реестр, время. Вывести это обходом каталогов было бы нельзя: по файлам не видно, из какого
 * пакета они приехали и какой подписью проверены, а именно это нужно показать человеку
 * и именно это отличает установленное от «кто-то положил папку».
 *
 * @module shell/platform/plugin/installed/store
 */

import type {
  OpfsDirectoryHandle,
  OpfsDirectoryProvider,
} from '@/shell/platform/workspace/storage/opfs';

/** Корень установленных плагинов в OPFS. Соседний с `ws/`, а не внутри него. */
export const INSTALLED_ROOT_DIR = 'plugins';

/** Имя записи о составе. */
export const INSTALLED_STATE_FILE = 'installed.json';

/** Что известно об установленном плагине. */
export interface InstalledPluginRecord {
  /** Идентификатор плагина из манифеста — он же имя каталога. */
  readonly id: string;
  /** Имя пакета npm. Может отличаться от `id`: `@acme/forms-plugin` против `acme-forms`. */
  readonly package: string;
  /** Действующая версия — та, которую отдаёт слой. */
  readonly version: string;
  /** Подпись архива, которой версия проверена при установке. */
  readonly integrity: string;
  /** Реестр, откуда приехало. Нужен, чтобы обновление шло туда же, а не «куда-нибудь». */
  readonly registry: string;
  /** Версии, оставшиеся на диске: прошлые и текущая. Из них выбирается откат. */
  readonly versions: readonly string[];
}

export interface InstalledPluginStore {
  /** Что установлено. Пусто — обычное состояние, а не отсутствие хранилища. */
  list(): Promise<readonly InstalledPluginRecord[]>;
  /** Кладёт файлы версии и делает её действующей. */
  install(input: InstallInput): Promise<void>;
  /**
   * Делает действующей уже лежащую версию. `false` — такой версии на диске нет.
   *
   * Откат — это ПЕРЕКЛЮЧЕНИЕ, а не скачивание: сломавшая работу новая версия не должна
   * требовать сети для возврата к прежней.
   */
  activate(id: string, version: string): Promise<boolean>;
  /** Убирает плагин целиком — все версии и запись. */
  uninstall(id: string): Promise<void>;
  /** Читает файл действующей версии. `null` — файла нет. */
  readFile(id: string, path: string): Promise<string | null>;
  /** Перечисляет пути файлов действующей версии, рекурсивно. */
  listFiles(id: string): Promise<readonly string[]>;
}

export interface InstallInput {
  readonly id: string;
  readonly package: string;
  readonly version: string;
  readonly integrity: string;
  readonly registry: string;
  /** Файлы пакета: путь внутри плагина → содержимое. */
  readonly files: ReadonlyMap<string, Uint8Array>;
}

export interface InstalledStoreOptions {
  readonly directory?: OpfsDirectoryProvider;
}

/** Сегмент пути, который мы сами порождаем, — но проверить его всё равно обязаны. */
function assertSegment(value: string, what: string): void {
  if (value === '' || value === '.' || value === '..' || /[\\/\0]/.test(value)) {
    throw new Error(`${what} обязан быть одним сегментом пути: ${JSON.stringify(value)}`);
  }
}

const encoder = new TextEncoder();

async function defaultDirectory(): Promise<OpfsDirectoryHandle> {
  // Приведение — то же, что у хранилища рабочей области и по той же причине: структурные типы
  // OPFS объявлены локально, потому что в `lib.dom` нет ни `values()`, ни синхронного хэндла.
  const root = await navigator.storage.getDirectory();
  return root as unknown as OpfsDirectoryHandle;
}

/** Каталог по сегментам. `create: false` и отсутствие каталога — `null`, а не исключение. */
async function dirOf(
  root: OpfsDirectoryHandle,
  segments: readonly string[],
  create: boolean
): Promise<OpfsDirectoryHandle | null> {
  let current = root;
  for (const segment of segments) {
    try {
      current = await current.getDirectoryHandle(segment, { create });
    } catch {
      return null;
    }
  }
  return current;
}

async function readText(dir: OpfsDirectoryHandle, name: string): Promise<string | null> {
  try {
    const handle = await dir.getFileHandle(name);
    return await (await handle.getFile()).text();
  } catch {
    return null;
  }
}

/**
 * Пишет файл. Только `createWritable`: синхронный хэндл существует лишь в Worker, а установка
 * идёт из главного потока, и второй путь записи здесь был бы кодом, который никогда не исполняется.
 */
async function writeBytes(
  dir: OpfsDirectoryHandle,
  name: string,
  bytes: Uint8Array
): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  if (handle.createWritable === undefined) {
    throw new Error(`файл «${name}» не открывается на запись: OPFS не даёт createWritable`);
  }
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

/** Разбирает запись о составе. Испорченный файл читается как «ничего не установлено». */
function parseState(text: string | null): InstalledPluginRecord[] {
  if (text === null) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const records: InstalledPluginRecord[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const strings = ['id', 'package', 'version', 'integrity', 'registry'] as const;
    if (!strings.every((key) => typeof record[key] === 'string' && record[key] !== '')) continue;
    const versions = Array.isArray(record.versions)
      ? record.versions.filter((value): value is string => typeof value === 'string')
      : [];
    records.push({
      id: record.id as string,
      package: record.package as string,
      version: record.version as string,
      integrity: record.integrity as string,
      registry: record.registry as string,
      versions: versions.length > 0 ? versions : [record.version as string],
    });
  }
  return records;
}

export function createInstalledPluginStore(
  options: InstalledStoreOptions = {}
): InstalledPluginStore {
  const provider = options.directory ?? defaultDirectory;

  /** Корень установленных. `create` — только когда собираемся писать. */
  const rootOf = async (create: boolean): Promise<OpfsDirectoryHandle | null> => {
    try {
      return await dirOf(await provider(), [INSTALLED_ROOT_DIR], create);
    } catch {
      // OPFS может не быть вовсе (приватное окно, старый движок): тогда установленных нет,
      // и это законное состояние — каталог проекта работает без них.
      return null;
    }
  };

  const readState = async (): Promise<InstalledPluginRecord[]> => {
    const root = await rootOf(false);
    if (root === null) return [];
    return parseState(await readText(root, INSTALLED_STATE_FILE));
  };

  const writeState = async (records: readonly InstalledPluginRecord[]): Promise<void> => {
    const root = await rootOf(true);
    if (root === null) throw new Error('OPFS недоступен: установить плагин некуда');
    await writeBytes(root, INSTALLED_STATE_FILE, encoder.encode(JSON.stringify(records, null, 2)));
  };

  /** Каталог действующей версии плагина. */
  const versionDir = async (id: string, create: boolean): Promise<OpfsDirectoryHandle | null> => {
    const records = await readState();
    const record = records.find((item) => item.id === id);
    if (record === undefined) return null;
    const root = await rootOf(create);
    return root === null ? null : dirOf(root, [id, record.version], create);
  };

  async function walk(dir: OpfsDirectoryHandle, prefix: string): Promise<string[]> {
    const paths: string[] = [];
    for await (const handle of dir.values()) {
      const path = prefix === '' ? handle.name : `${prefix}/${handle.name}`;
      if (handle.kind === 'directory') paths.push(...(await walk(handle, path)));
      else paths.push(path);
    }
    return paths;
  }

  return {
    list: readState,

    async install(input) {
      assertSegment(input.id, 'идентификатор плагина');
      assertSegment(input.version, 'версия плагина');

      const root = await rootOf(true);
      if (root === null) throw new Error('OPFS недоступен: установить плагин некуда');
      const target = await dirOf(root, [input.id, input.version], true);
      if (target === null) throw new Error(`каталог «${input.id}/${input.version}» не создаётся`);

      for (const [path, bytes] of input.files) {
        const segments = path.split('/');
        const name = segments.pop();
        if (name === undefined || name === '') continue;
        const dir = segments.length === 0 ? target : await dirOf(target, segments, true);
        if (dir === null) throw new Error(`каталог для «${path}» не создаётся`);
        await writeBytes(dir, name, bytes);
      }

      const records = await readState();
      const previous = records.find((item) => item.id === input.id);
      const versions = [...new Set([...(previous?.versions ?? []), input.version])];
      const record: InstalledPluginRecord = {
        id: input.id,
        package: input.package,
        version: input.version,
        integrity: input.integrity,
        registry: input.registry,
        versions,
      };
      await writeState([...records.filter((item) => item.id !== input.id), record]);
    },

    async activate(id, version) {
      const records = await readState();
      const record = records.find((item) => item.id === id);
      if (record === undefined || !record.versions.includes(version)) return false;
      // Подпись и пакет прежние: это ТА ЖЕ версия, что уже проверена при установке, —
      // переключение не скачивает ничего и потому ничего не проверяет заново.
      await writeState(records.map((item) => (item.id === id ? { ...item, version } : item)));
      return true;
    },

    async uninstall(id) {
      const root = await rootOf(false);
      if (root !== null) {
        try {
          await root.removeEntry(id, { recursive: true });
        } catch {
          // Каталога нет — значит и удалять нечего; запись всё равно снимаем.
        }
      }
      const records = await readState();
      await writeState(records.filter((item) => item.id !== id));
    },

    async readFile(id, path) {
      const dir = await versionDir(id, false);
      if (dir === null) return null;
      const segments = path.split('/');
      const name = segments.pop();
      if (name === undefined || name === '') return null;
      const target = segments.length === 0 ? dir : await dirOf(dir, segments, false);
      return target === null ? null : readText(target, name);
    },

    async listFiles(id) {
      const dir = await versionDir(id, false);
      return dir === null ? [] : walk(dir, '');
    },
  };
}
