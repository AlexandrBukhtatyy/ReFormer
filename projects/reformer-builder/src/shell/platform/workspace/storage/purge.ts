/**
 * Полная очистка хранилищ источника: OPFS, IndexedDB, Cache Storage, `*Storage`.
 *
 * ## Почему сносится ВСЁ, а не перечисленное поимённо
 *
 * Список «наших» хранилищ протухает молча. Кэш сборки завели соседом рабочей копии
 * (`build/` рядом с `ws/`), плагин заведёт свою базу, движок редактора — свой Cache Storage;
 * очистка, знающая только про две базы из `source/fs-handles` и `workspace/storage/idb`,
 * оставила бы ровно то, из-за чего её и позвали, и человек ушёл бы чинить руками через
 * DevTools. Источник у сборщика свой, чужого на нём нет — значит «очистить кэш» честно
 * означает «очистить источник».
 *
 * Имена известных баз всё же принимаются ({@link PurgeEnvironment.knownDatabases}) — но
 * только как ЗАПАСНОЙ путь: `indexedDB.databases()` есть не везде (Safari отдаёт его
 * с оговорками, старые сборки не отдают вовсе), а без перечисления удалять было бы нечего.
 *
 * ## Область видимости — соглашение, а не список
 *
 * На чужом источнике (встроенный билдер открыт с адреса приложения) «всё» сносить нельзя: там
 * лежат данные приложения. Граница при этом всё равно не список — это {@link PurgeScope},
 * предикат «запись наша», который отвечает по СОГЛАШЕНИЮ из `namespace.ts`: один корень OPFS,
 * один префикс имён. Соглашение держит единственный провайдер корня, а не дисциплина, поэтому
 * оно, в отличие от списка, не протухает с каждым новым кэшем. Без области видимости очистка
 * сносит всё — поведение вкладки, где источник свой.
 *
 * ## Открытое соединение не мешает — оно откладывает
 *
 * `deleteDatabase` при живом соединении не отказывает, а зовёт `onblocked` и ждёт. Поэтому
 * закрывать соединения перед очисткой не нужно и вредно: закрытая база в живом приложении —
 * это отказ каждой следующей записи, а очистка обязана оставаться отменяемой ровно до
 * перезагрузки. Отложенное удаление доводится до конца тем самым `reload`, ради которого
 * очистку и затевают, — и в отчёт оно попадает отдельным полем {@link PurgeReport.blocked},
 * а не отказом: это не неудача, а «доделается на перезагрузке».
 *
 * ## Отказ одной области не отменяет остальных
 *
 * Каждая запись сносится своей попыткой, отказ складывается в {@link PurgeReport.failures}
 * и не прерывает обход. Обратное («упали на первом файле — бросили всё») оставляло бы
 * хранилище в состоянии, которого нет ни до, ни после: часть снесена, часть даже не
 * попробована, а повторный запуск шёл бы тем же путём к тому же файлу.
 *
 * Все зависимости берутся из {@link PurgeEnvironment}, потому что тесты идут в `node`,
 * где нет ни OPFS, ни IndexedDB, ни `caches` — то же решение и та же причина, что
 * у `OpfsStoreOptions.directory`.
 *
 * @module shell/platform/workspace/storage/purge
 */

import type { OpfsDirectoryHandle, OpfsDirectoryProvider } from './opfs';

/** Область хранения — чтобы отказ можно было отнести к месту, а не к строке сообщения. */
export type PurgeArea = 'opfs' | 'indexeddb' | 'cache' | 'web-storage';

/** Что не снеслось. */
export interface PurgeFailure {
  readonly area: PurgeArea;
  /** Имя записи: каталог OPFS, база, кэш. Для `*Storage` — `local` либо `session`. */
  readonly name: string;
  readonly error: unknown;
}

/** Итог очистки. */
export interface PurgeReport {
  /** Сколько записей снесено — по всем областям вместе. */
  readonly removed: number;
  /** Базы, чьё удаление отложено до закрытия соединений, то есть до перезагрузки. */
  readonly blocked: readonly string[];
  readonly failures: readonly PurgeFailure[];
}

/**
 * Фабрика IndexedDB в том объёме, который нужен очистке.
 *
 * Объявлена структурно по той же причине, что типы OPFS в `opfs.ts`: подставная реализация
 * реализует ровно это — без приведений и без `any`. `databases` необязателен, потому что
 * его действительно может не быть.
 */
export interface PurgeIndexedDbFactory {
  deleteDatabase(name: string): IDBOpenDBRequest;
  databases?(): Promise<readonly { name?: string }[]>;
}

/** Cache Storage в объёме очистки. */
export interface PurgeCacheStorage {
  keys(): Promise<readonly string[]>;
  delete(key: string): Promise<boolean>;
}

/** `localStorage`/`sessionStorage` в объёме очистки. */
export interface PurgeWebStorage {
  /** `local` либо `session` — попадает в отчёт именем записи. */
  readonly name: string;
  clear(): void;
  /** Все ключи — для очистки по области видимости, где `clear()` снёс бы и чужое. */
  keys(): readonly string[];
  removeItem(key: string): void;
}

/** Окружение очистки. Всё необязательно: отсутствующая область просто не трогается. */
export interface PurgeEnvironment {
  /** Корень OPFS. `null` — OPFS в этом окружении нет. */
  readonly directory?: OpfsDirectoryProvider | null;
  readonly indexedDb?: PurgeIndexedDbFactory | null;
  readonly caches?: PurgeCacheStorage | null;
  readonly webStorage?: readonly PurgeWebStorage[];
  /**
   * Имена баз на случай, когда `databases()` в движке нет.
   *
   * Не «вместо перечисления», а «когда перечислить нечем»: если `databases()` есть,
   * его ответ полнее любого списка, и список к нему не добавляется.
   */
  readonly knownDatabases?: readonly string[];
}

/**
 * Область видимости очистки: `true` — запись наша, её можно снести.
 *
 * Имя записи — то же, что попадает в отчёт: запись корня OPFS, база, кэш, ключ `*Storage`.
 */
export type PurgeScope = (area: PurgeArea, name: string) => boolean;

/** Накопитель отчёта: обход складывает сюда, вызывающий получает замороженный итог. */
interface Tally {
  removed: number;
  readonly blocked: string[];
  readonly failures: PurgeFailure[];
}

/**
 * Сносит всё, что приложение держит на этом источнике, — либо только то, что в области видимости.
 *
 * `scope` — предикат «запись наша» (см. шапку). `null` — весь источник: поведение вкладки,
 * где чужого нет.
 *
 * Не бросает: любой отказ — запись в {@link PurgeReport.failures}. Исключение здесь означало бы,
 * что вызывающий не знает, что успело снестись до него, — а знать это и есть весь смысл отчёта.
 */
export async function purgeOriginStorage(
  env: PurgeEnvironment = {},
  scope: PurgeScope | null = null
): Promise<PurgeReport> {
  const tally: Tally = { removed: 0, blocked: [], failures: [] };

  await purgeOpfs(env.directory ?? null, scope, tally);
  await purgeIndexedDb(env.indexedDb ?? null, env.knownDatabases ?? [], scope, tally);
  await purgeCaches(env.caches ?? null, scope, tally);
  purgeWebStorage(env.webStorage ?? [], scope, tally);

  return Object.freeze({
    removed: tally.removed,
    blocked: Object.freeze([...tally.blocked]),
    failures: Object.freeze([...tally.failures]),
  });
}

/**
 * Содержимое корня OPFS.
 *
 * Сносятся ЗАПИСИ корня, а не корень: удалить сам корень нечем — у него нет родителя.
 * Имена собираются в список до удаления, потому что итератор идёт по тому же каталогу,
 * который мы правим, и удаление на ходу — это обход изменяемой коллекции.
 */
async function purgeOpfs(
  provider: OpfsDirectoryProvider | null,
  scope: PurgeScope | null,
  tally: Tally
): Promise<void> {
  if (provider === null) return;

  let root: OpfsDirectoryHandle;
  try {
    root = await provider();
  } catch (error) {
    // OPFS нет вовсе — законное окружение (приватное окно), а не отказ очистки:
    // чего нет, то и очищено.
    if (isMissingStorage(error)) return;
    tally.failures.push({ area: 'opfs', name: '/', error });
    return;
  }

  let names: string[];
  try {
    names = [];
    for await (const entry of root.values()) names.push(entry.name);
  } catch (error) {
    tally.failures.push({ area: 'opfs', name: '/', error });
    return;
  }

  for (const name of names.filter((name) => inScope(scope, 'opfs', name))) {
    try {
      await root.removeEntry(name, { recursive: true });
      tally.removed += 1;
    } catch (error) {
      tally.failures.push({ area: 'opfs', name, error });
    }
  }
}

/** Все базы источника — либо те из них, что в области видимости. */
async function purgeIndexedDb(
  factory: PurgeIndexedDbFactory | null,
  known: readonly string[],
  scope: PurgeScope | null,
  tally: Tally
): Promise<void> {
  if (factory === null) return;

  const names = (await databaseNames(factory, known, tally)).filter((name) =>
    inScope(scope, 'indexeddb', name)
  );
  for (const name of names) {
    try {
      const outcome = await deleteDatabase(factory, name);
      if (outcome === 'blocked') tally.blocked.push(name);
      else tally.removed += 1;
    } catch (error) {
      tally.failures.push({ area: 'indexeddb', name, error });
    }
  }
}

/**
 * Имена баз: ответ движка, а где его нет — переданный список.
 *
 * Список НЕ добавляется к ответу движка: `databases()` уже вернул всё, и дописанное имя
 * означало бы вторую попытку удаления того же — с `blocked` во второй раз просто потому,
 * что первое удаление ещё идёт.
 */
async function databaseNames(
  factory: PurgeIndexedDbFactory,
  known: readonly string[],
  tally: Tally
): Promise<readonly string[]> {
  if (factory.databases === undefined) return known;
  try {
    const listed = await factory.databases();
    return listed
      .map((entry) => entry.name)
      .filter((name): name is string => typeof name === 'string' && name !== '');
  } catch (error) {
    // Перечисление отказало — падать не на чем: известные базы снести всё ещё можно,
    // и это лучше, чем не тронуть ни одной.
    tally.failures.push({ area: 'indexeddb', name: '*', error });
    return known;
  }
}

/**
 * Удаляет одну базу.
 *
 * `blocked` — не отказ и не окончание ожидания: запрос остаётся в очереди движка и
 * доводится до конца, когда последнее соединение закроется. Возвращать его отдельным
 * исходом обязательно, иначе «удалено» означало бы разное в разных случаях.
 */
function deleteDatabase(
  factory: PurgeIndexedDbFactory,
  name: string
): Promise<'removed' | 'blocked'> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.deleteDatabase(name);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    request.onsuccess = () => {
      resolve('removed');
    };
    request.onblocked = () => {
      resolve('blocked');
    };
    request.onerror = () => {
      reject(request.error ?? new Error(`удаление базы «${name}» отказало`));
    };
  });
}

/** Кэши `CacheStorage`: их заводит движок редактора и сервис-воркер, если он появится. */
async function purgeCaches(
  caches: PurgeCacheStorage | null,
  scope: PurgeScope | null,
  tally: Tally
): Promise<void> {
  if (caches === null) return;

  let keys: readonly string[];
  try {
    keys = await caches.keys();
  } catch (error) {
    tally.failures.push({ area: 'cache', name: '*', error });
    return;
  }

  for (const key of keys.filter((key) => inScope(scope, 'cache', key))) {
    try {
      await caches.delete(key);
      tally.removed += 1;
    } catch (error) {
      tally.failures.push({ area: 'cache', name: key, error });
    }
  }
}

/**
 * `localStorage` и `sessionStorage`.
 *
 * Правило проекта — «`localStorage` не используем нигде», и очистка ему не противоречит:
 * своего мы туда не кладём, но кладут библиотеки (движок редактора помнит там состояние
 * вида), а «очистить кэш», оставляющее чужой мусор, обещает больше, чем делает.
 *
 * С областью видимости `clear()` не годится — он снёс бы и ключи приложения, — поэтому ключи
 * снимаются по одному. Список ключей берётся ДО удаления: `removeItem` сдвигает индексы
 * `key(i)`, и обход на ходу пропускал бы каждый второй.
 */
function purgeWebStorage(
  storages: readonly PurgeWebStorage[],
  scope: PurgeScope | null,
  tally: Tally
): void {
  for (const storage of storages) {
    try {
      if (scope === null) {
        storage.clear();
        tally.removed += 1;
        continue;
      }
      for (const key of storage.keys().filter((key) => scope('web-storage', key))) {
        storage.removeItem(key);
        tally.removed += 1;
      }
    } catch (error) {
      tally.failures.push({ area: 'web-storage', name: storage.name, error });
    }
  }
}

function inScope(scope: PurgeScope | null, area: PurgeArea, name: string): boolean {
  return scope === null || scope(area, name);
}

/** «Хранилища здесь нет» — то же различение, что у `opfsSupported`. */
function isMissingStorage(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'NotFoundError' || error.name === 'SecurityError')
  );
}

/**
 * Окружение браузера: всё, что на этой странице есть на самом деле.
 *
 * Живёт здесь, а не в композиции, потому что это не выбор, а ОПРОС: композиция решает,
 * очищать ли и что делать после, а «есть ли на этой странице Cache Storage» — свойство
 * страницы. Отсутствующее не подставляется заглушкой: `null` в окружении означает
 * «области нет», и очистка её просто не трогает.
 */
export function browserPurgeEnvironment(
  options: { readonly knownDatabases?: readonly string[] } = {}
): PurgeEnvironment {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const glob = globalThis as {
    indexedDB?: IDBFactory;
    caches?: CacheStorage;
    localStorage?: Storage;
    sessionStorage?: Storage;
  };

  const webStorage: PurgeWebStorage[] = [];
  // Обращение к `localStorage` само бросает при запрещённых куках — поэтому проба,
  // а не проверка на `undefined`.
  for (const name of ['local', 'session'] as const) {
    try {
      const storage = name === 'local' ? glob.localStorage : glob.sessionStorage;
      if (storage !== undefined && storage !== null) {
        webStorage.push({
          name,
          clear: () => {
            storage.clear();
          },
          keys: () => {
            const keys: string[] = [];
            for (let index = 0; index < storage.length; index += 1) {
              const key = storage.key(index);
              if (key !== null) keys.push(key);
            }
            return keys;
          },
          removeItem: (key) => {
            storage.removeItem(key);
          },
        });
      }
    } catch {
      // Хранилище недоступно — очищать нечего.
    }
  }

  return {
    directory:
      typeof nav?.storage?.getDirectory === 'function'
        ? // Приведение — то же и по той же причине, что в `opfs.ts`: глобальный
          // `FileSystemDirectoryHandle` не объявляет `values()` при нашем наборе lib.
          async () => (await nav.storage.getDirectory()) as unknown as OpfsDirectoryHandle
        : null,
    indexedDb: glob.indexedDB ?? null,
    caches: glob.caches ?? null,
    webStorage,
    knownDatabases: options.knownDatabases,
  };
}
