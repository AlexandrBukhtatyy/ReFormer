/**
 * Метаданные рабочей области в IndexedDB: `workspaces`, `opened`, `stats`, `history`.
 *
 * **Одно соединение, а не соединение на операцию.** Образец — не v1
 * (`projects/reformer-builder/src/io/idb.ts` и `io/handle-store.ts`), а
 * `packages/reformer-form-registry/src/storage/indexeddb.ts`, где в шапке разобран постмортем:
 * v1 открывает БД на каждый вызов и не закрывает её, резолвит запись по `request.onsuccess`
 * (для `readwrite` это резолв ДО коммита: читатель следом может не увидеть запись) и не
 * обрабатывает ни `onabort`, ни исчерпание квоты. Здесь наоборот:
 *
 * - соединение кэшируется на всё время жизни модуля и переоткрывается по `onclose`
 *   и `onversionchange` — иначе очистка данных сайта из другой вкладки навсегда ломала бы
 *   хранилище до перезагрузки страницы;
 * - запись резолвится по `transaction.oncomplete`, то есть после КОММИТА;
 * - `QuotaExceededError` обрабатывается превентивно и **ровно одним** повтором.
 *
 * **Почему повтор ровно один.** Квота — общая на origin, и место могут занимать соседи;
 * цикл «освободили — не влезло — освободили» в этих условиях не сходится, а выглядит как
 * зависший интерфейс. Отказ хуже успеха, но лучше зависания: вызывающий покажет ошибку,
 * а данные останутся в памяти документа, где истина всё равно и находится.
 *
 * **Чего здесь нет.** Политики журнала (опорные снимки, схлопывание, возраст, объём — Э6):
 * хранилище умеет складывать и выбрасывать записи, но не знает, какие из них можно выбросить
 * без потери воспроизведения. Владелец журнала передаёт это знание через `onQuotaPressure`;
 * умолчание — намеренно грубое, см. {@link WorkspaceMetaStoreOptions}.
 *
 * @module host/workspace/storage/idb
 */

import { toDisposable, type Disposable } from '../../primitives/disposable';
import type { ResourceId, ResourceStat } from '../../primitives/resource';
import { StorageError } from './errors';
import { openedKey, statKey, type HistoryKey } from './layout';

/** Имя базы. Одна на приложение: рабочие области разделены ключами, а не базами. */
export const WORKSPACE_DB_NAME = 'reformer-builder.workspace';

/**
 * Версия схемы. Растёт только вместе с миграцией в {@link upgradeSchema}.
 *
 * `2` — добавлено хранилище {@link STORE_SETTINGS}. Миграции данных нет и быть не может:
 * хранилище новое и пустое, а прежние четыре не тронуты. База версии 1 доедет до второй
 * первым же открытием.
 */
export const WORKSPACE_DB_VERSION = 2;

export const STORE_WORKSPACES = 'workspaces';
export const STORE_OPENED = 'opened';
export const STORE_STATS = 'stats';
export const STORE_HISTORY = 'history';

/**
 * Настройки, не принадлежащие НИ ОДНОЙ рабочей области: язык, тема, ширины панелей.
 *
 * Отдельное хранилище, а не запись в `workspaces`, потому что их читают ДО того, как хоть
 * одна область восстановлена (раскладка берётся при монтировании, восстановление идёт после
 * отрисовки), и синтетическая «область приложения» была бы записью, которая ничем не является.
 * Настройки САМОЙ области сюда не попадают: у них владелец есть — это
 * {@link WorkspaceRecord.settings}, и второе место для них означало бы два источника правды.
 */
export const STORE_SETTINGS = 'settings';

/** Индекс «всё, что принадлежит рабочей области» — на нём держится каскадное удаление. */
export const INDEX_BY_WORKSPACE = 'by-workspace';

/** Индекс «журнал одного ресурса». Составной, поэтому запись отдаётся сразу в порядке `seq`. */
export const INDEX_BY_RESOURCE = 'by-resource';

const ALL_STORES: readonly string[] = [STORE_WORKSPACES, STORE_OPENED, STORE_STATS, STORE_HISTORY];

/**
 * Дескриптор источника, каким его видит хранилище.
 *
 * Структурно, а не типом из Э3: Workspace не обязан знать, какие бывают источники, а хранилище
 * тем более. Живой объект источника несериализуем — здесь лежит только то, по чему фабрика
 * умеет его восстановить.
 */
export interface StoredSourceDescriptor {
  readonly kind: string;
  readonly [key: string]: unknown;
}

/** Запись хранилища `workspaces`: чем открыта рабочая область и как она настроена. */
export interface WorkspaceRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly descriptor: StoredSourceDescriptor;
  /** Человекочитаемое имя для списка рабочих областей. */
  readonly label?: string;
  readonly createdAt: number;
  /** Для сортировки списка и для уборки брошенных областей. */
  readonly lastOpenedAt: number;
  /** Настройки области. Непрозрачны для хранилища: их смысл знает тот, кто их положил. */
  readonly settings?: Readonly<Record<string, unknown>>;
}

/**
 * Запись хранилища `opened`: вкладка.
 *
 * `opened ⊆ materialized`: здесь лежит только то, что пользователь открыл явно, а материализованное
 * содержимое — в `stats` и в OPFS. Разведение обязательно, иначе «единица открытия» становится
 * неразрешимым вопросом.
 */
export interface OpenedRecord {
  readonly workspaceId: string;
  readonly resourceId: ResourceId;
  /** Порядок вкладки в ряду. */
  readonly order: number;
  /** Закреплённые вкладки не вытесняются никогда. */
  readonly pinned: boolean;
  readonly openedAt: number;
  /** Когда вкладку последний раз активировали — восстановление активной и LRU. */
  readonly activatedAt: number;
  /**
   * Эфемерное состояние вида: прокрутка, текущий шаг визарда, режим.
   *
   * Непрозрачно для хранилища и намеренно НЕ файл: это производное состояние, которое
   * пользователь не уносит с собой (в отличие от мок-данных, которые живут в OPFS).
   */
  readonly viewState?: Readonly<Record<string, unknown>>;
}

/**
 * Запись хранилища `stats`: то, что известно про материализованный ресурс, но не хранится
 * в самом файле.
 *
 * Расширяет {@link ResourceStat} из примитивов, а не повторяет его: `revision` сравнивается
 * только на равенство, и второе определение этого поля рано или поздно разошлось бы с первым.
 */
export interface StatRecord extends ResourceStat {
  readonly workspaceId: string;
  /** Путь ресурса, нормализованный: иначе `a//b` и `a/b` стали бы двумя записями об одном файле. */
  readonly path: string;
  /**
   * Есть ли BASE для этого ресурса.
   *
   * BASE живёт, пока ресурс материализован, и вытесняется парой с содержимым: выброшенный
   * в одиночку, он означал бы потерю возможности слияния при живой рабочей копии.
   */
  readonly hasBase: boolean;
  readonly materializedAt: number;
  /** Давность использования — по ней вытесняются догруженные зависимости. */
  readonly lastUsedAt: number;
  /** Расходится ли рабочая копия с BASE. Кэш ответа: пересчёт требует чтения обоих слоёв. */
  readonly dirty: boolean;
}

/**
 * Правка текста в нейтральном формате.
 *
 * Смещения — в кодовых единицах UTF-16 (как считают JavaScript и Monaco); потребитель,
 * решивший, что это байты или кодовые точки, сломается на первом эмодзи. `removed` хранится,
 * хотя для проигрывания вперёд не нужен: он делает запись самодостаточной и обратимой.
 */
export interface StoredTextEdit {
  readonly offset: number;
  readonly removed: string;
  readonly inserted: string;
}

interface HistoryRecordBase {
  readonly workspaceId: string;
  readonly resourceId: ResourceId;
  /** Монотонен в пределах рабочей области: журнал читается как ОДИН поток, а не как два. */
  readonly seq: number;
  readonly ts: number;
  /** Объём записи — по нему считается потолок журнала. Считает владелец, хранилище только хранит. */
  readonly bytes: number;
}

/**
 * Опорный снимок: точка, от которой журнал проигрывается.
 *
 * Инвариант политики хранения: в журнале всегда есть снимок не позже самой старой записи —
 * иначе после удаления старых патчей остаётся хвост правок без основания.
 */
export interface HistorySnapshotRecord extends HistoryRecordBase {
  readonly kind: 'snapshot';
  readonly content: string | Uint8Array;
}

/** Запись журнала: правка текста или операции над моделью. */
export interface HistoryEntryRecord extends HistoryRecordBase {
  readonly kind: 'entry';
  readonly origin: 'user' | 'agent' | 'external';
  /** Логический шаг: ход ассистента или мультикурсорная правка — одна запись. */
  readonly txId?: string;
  readonly payload:
    | { readonly kind: 'text'; readonly edits: readonly StoredTextEdit[] }
    /**
     * Операции над моделью. Их форму знает предметный слой (`lib/form-model`), а Host
     * предметной логики не знает вовсе — для журнала это транспорт, и `unknown` здесь
     * не лень, а граница слоя.
     */
    | { readonly kind: 'model'; readonly ops: readonly unknown[] };
}

/** Всё, что лежит в `history`: снимки и записи в одном потоке, упорядоченные общим `seq`. */
export type HistoryRecord = HistorySnapshotRecord | HistoryEntryRecord;

/** Что известно о давлении на квоту. */
/**
 * Запись хранилища {@link STORE_SETTINGS}: одна область настроек целиком.
 *
 * Областью целиком, а не по ключу на запись, потому что читают её тоже целиком: `get`
 * настройки синхронен, значит кэш заполняется одним заходом на старте, и поштучное хранение
 * означало бы обход всего хранилища на каждую загрузку.
 *
 * Ключ лежит ВНУТРИ записи (`keyPath: 'scope'`) — как у хэндлов каталогов и по той же причине:
 * дамп базы читается без обращения к индексу, а подставная IndexedDB из `./testing` умеет
 * только `keyPath`.
 *
 * Значения непрозрачны для хранилища: в них лежит то, что положили прошлые версии приложения,
 * и разбираться с этим обязан тот, кто их читает.
 */
export interface SettingsRecord {
  /** Имя области. Сегодня единственное — `user`. */
  readonly scope: string;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface QuotaPressure {
  /** Рабочая область, чья запись не влезла; `undefined` — операция не привязана к области. */
  readonly workspaceId?: string;
  /** `true` — место уже кончилось (реакция на отказ), `false` — превентивная проверка. */
  readonly urgent: boolean;
}

/** Настройки хранилища метаданных. */
export interface WorkspaceMetaStoreOptions {
  /** Подмена IndexedDB — для тестов и для нестандартных окружений. */
  readonly factory?: IDBFactory;
  readonly databaseName?: string;
  /**
   * Освобождение места. Вызывается превентивно при давлении на квоту и один раз после отказа.
   *
   * Умолчание грубое намеренно: оно выбрасывает самые старые записи журнала рабочей области
   * ({@link WorkspaceMetaStore.removeOldestHistory}) и НЕ соблюдает инвариант опорного снимка,
   * потому что политику журнала знает его владелец (Э6), а не хранилище. Владелец обязан
   * передать сюда свою — иначе после аварийной уборки часть истории окажется невоспроизводимой.
   */
  readonly onQuotaPressure?: (pressure: QuotaPressure) => Promise<void>;
  /** Откуда берётся оценка занятого места. По умолчанию — `navigator.storage.estimate()`. */
  readonly estimate?: () => Promise<{ usage?: number; quota?: number }>;
  readonly now?: () => number;
}

/** Доля квоты, после которой начинаем освобождать место, не дожидаясь отказа. */
const PRESSURE_RATIO = 0.9;

/** Как часто спрашивать оценку. `estimate()` не бесплатен, а давление меняется медленно. */
const PRESSURE_CHECK_INTERVAL_MS = 30_000;

/** Сколько записей журнала выбрасывает умолчательное освобождение места. */
const DEFAULT_RELIEF_RECORDS = 200;

/**
 * Метаданные рабочих областей.
 *
 * `dispose()` закрывает соединение — но только когда его отпустил последний владелец: два
 * хранилища над одной базой делят одно соединение, и закрытие «своего» рвало бы чужое.
 */
export interface WorkspaceMetaStore extends Disposable {
  /* workspaces */
  putWorkspace(record: WorkspaceRecord): Promise<void>;
  getWorkspace(id: string): Promise<WorkspaceRecord | null>;
  /** Все рабочие области, свежая первой. */
  listWorkspaces(): Promise<readonly WorkspaceRecord[]>;
  /** Удаляет область вместе со вкладками, свойствами и журналом — одной транзакцией. */
  removeWorkspace(id: string): Promise<void>;
  /**
   * Настройки области. Пустой объект — записи нет; отличать её от «настроек нет» незачем:
   * ответ на оба вопроса один.
   */
  getWorkspaceSettings(id: string): Promise<Readonly<Record<string, unknown>>>;
  /**
   * Записать настройки области ЦЕЛИКОМ.
   *
   * Чтение и запись идут ОДНОЙ транзакцией: поле `settings` живёт в общей записи с
   * `lastOpenedAt` и дескриптором, которые пишет открытие проекта. Прочитать запись, а потом
   * положить её обратно другой транзакцией значило бы затереть то, что успел записать сосед.
   *
   * Области, которой ещё нет, настройки не приписываются: запись без источника и дескриптора
   * была бы неполной рабочей областью, а восстановление берёт «последнюю» именно из этого
   * списка. Отказ с кодом `bad-workspace-id` — вызывающий обязан различать «не сохранилось»
   * и «сохранилось».
   */
  putWorkspaceSettings(id: string, values: Readonly<Record<string, unknown>>): Promise<void>;

  /* settings */
  /** Настройки, не принадлежащие области, — см. {@link STORE_SETTINGS}. */
  getAppSettings(scope: string): Promise<Readonly<Record<string, unknown>>>;
  putAppSettings(scope: string, values: Readonly<Record<string, unknown>>): Promise<void>;

  /* opened */
  putOpened(record: OpenedRecord): Promise<void>;
  /** Вкладки области в порядке `order`. */
  listOpened(workspaceId: string): Promise<readonly OpenedRecord[]>;
  removeOpened(workspaceId: string, resourceId: ResourceId): Promise<void>;

  /* stats */
  putStat(record: StatRecord): Promise<void>;
  /** Пакетом и одной транзакцией: материализация замыкания приносит до 200 записей разом. */
  putStats(records: readonly StatRecord[]): Promise<void>;
  getStat(workspaceId: string, path: string): Promise<StatRecord | null>;
  listStats(workspaceId: string): Promise<readonly StatRecord[]>;
  removeStats(workspaceId: string, paths: readonly string[]): Promise<void>;

  /* history */
  appendHistory(record: HistoryRecord): Promise<void>;
  /** Журнал одного ресурса в порядке `seq`. */
  listHistory(workspaceId: string, resourceId: ResourceId): Promise<readonly HistoryRecord[]>;
  /**
   * Весь журнал области ОДНИМ потоком, в порядке `seq`.
   *
   * Нужен владельцу политики хранения: и потолок объёма, и граница удаления — величины
   * на всю область, а не на ресурс, потому что `seq` монотонен по области. Собрать то же
   * из {@link listHistory} нельзя: списка ресурсов, о которых есть записи, взять неоткуда.
   */
  listWorkspaceHistory(workspaceId: string): Promise<readonly HistoryRecord[]>;
  /** Наибольший выданный `seq` области; `0`, если журнал пуст. Читает только ключи. */
  lastSeq(workspaceId: string): Promise<number>;
  /** Удаляет записи с `seq < before`. Возвращает число удалённых. */
  removeHistoryBefore(workspaceId: string, before: number): Promise<number>;
  /** Удаляет `count` самых старых записей области. Возвращает число удалённых. */
  removeOldestHistory(workspaceId: string, count: number): Promise<number>;
}

/** Есть ли IndexedDB в этом окружении (в приватном режиме части движков открытие глушится). */
export function idbSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Разделяемое соединение: `refs` — сколько хранилищ его держат. */
interface PooledConnection {
  refs: number;
  db?: Promise<IDBDatabase>;
}

/**
 * Пул соединений на всё время жизни модуля.
 *
 * Ключ — пара «фабрика + имя базы»: подставная фабрика в тесте обязана получать своё соединение,
 * иначе тесты потекли бы друг в друга через модульное состояние.
 */
const pools = new WeakMap<IDBFactory, Map<string, PooledConnection>>();

function acquireConnection(factory: IDBFactory, name: string): PooledConnection {
  let byName = pools.get(factory);
  if (byName === undefined) {
    byName = new Map<string, PooledConnection>();
    pools.set(factory, byName);
  }
  let pooled = byName.get(name);
  if (pooled === undefined) {
    pooled = { refs: 0 };
    byName.set(name, pooled);
  }
  pooled.refs += 1;
  return pooled;
}

function releaseConnection(factory: IDBFactory, name: string, pooled: PooledConnection): void {
  pooled.refs -= 1;
  if (pooled.refs > 0) return;
  const db = pooled.db;
  pooled.db = undefined;
  pools.get(factory)?.delete(name);
  // Закрытие асинхронно и может прийти уже после того, как соединение умерло само — отказ
  // здесь ничего не значит.
  void db?.then((it) => it.close()).catch(() => undefined);
}

/** Создание хранилищ и индексов. Единственное место, знающее схему. */
function upgradeSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
    db.createObjectStore(STORE_SETTINGS, { keyPath: 'scope' });
  }
  if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
    db.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(STORE_OPENED)) {
    const store = db.createObjectStore(STORE_OPENED, { keyPath: ['workspaceId', 'resourceId'] });
    store.createIndex(INDEX_BY_WORKSPACE, 'workspaceId');
  }
  if (!db.objectStoreNames.contains(STORE_STATS)) {
    const store = db.createObjectStore(STORE_STATS, { keyPath: ['workspaceId', 'path'] });
    store.createIndex(INDEX_BY_WORKSPACE, 'workspaceId');
  }
  if (!db.objectStoreNames.contains(STORE_HISTORY)) {
    const store = db.createObjectStore(STORE_HISTORY, {
      keyPath: ['workspaceId', 'resourceId', 'seq'],
    });
    store.createIndex(INDEX_BY_WORKSPACE, 'workspaceId');
    store.createIndex(INDEX_BY_RESOURCE, ['workspaceId', 'resourceId']);
  }
}

/** Промис над запросом. Отказ запроса — отказ промиса, а не тихий `undefined`. */
function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('запрос IndexedDB не удался'));
  });
}

/**
 * Похоже ли на исчерпание квоты.
 *
 * Проверяется имя, а не класс: `DOMException` — не единственный носитель этой ошибки
 * (движки различаются, а обёртки над транзакцией могут пересобрать её в обычный `Error`),
 * зато имя стабильно. Сообщение остаётся последней зацепкой и намеренно последней:
 * оно локализуемо и на него полагаться нельзя.
 */
function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota/i.test(err.message)
  );
}

/**
 * Хранилище метаданных рабочих областей.
 *
 * Фабрика синхронна и соединение не открывает: оно поднимается при первой операции. Отсутствие
 * IndexedDB — отказ с кодом `idb-unavailable`, а не исключение из конструктора, чтобы вызывающий
 * мог решить про деградацию один раз ({@link idbSupported}).
 */
export function createWorkspaceMetaStore(
  options: WorkspaceMetaStoreOptions = {}
): WorkspaceMetaStore {
  const dbName = options.databaseName ?? WORKSPACE_DB_NAME;
  const factory = options.factory ?? (idbSupported() ? indexedDB : undefined);
  const now = options.now ?? (() => Date.now());
  const estimate =
    options.estimate ??
    (async () => {
      const storage = (globalThis as { navigator?: { storage?: StorageManager } }).navigator
        ?.storage;
      if (typeof storage?.estimate !== 'function') return {};
      return storage.estimate();
    });

  if (factory === undefined) {
    // Соединения не будет вовсе: возвращаем объект, который честно отказывает на каждой операции.
    return unavailableStore();
  }

  const pooled = acquireConnection(factory, dbName);
  const closer = toDisposable(() => releaseConnection(factory, dbName, pooled));

  const open = (): Promise<IDBDatabase> => {
    const cached = pooled.db;
    if (cached !== undefined) return cached;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(dbName, WORKSPACE_DB_VERSION);
      req.onupgradeneeded = () => upgradeSchema(req.result);
      req.onsuccess = () => {
        const db = req.result;
        // Соединение могут закрыть извне (очистка данных сайта, версия из другой вкладки).
        // Сбрасываем кэш, чтобы следующая операция переоткрыла базу, а не падала навсегда.
        db.onclose = () => {
          pooled.db = undefined;
        };
        db.onversionchange = () => {
          db.close();
          pooled.db = undefined;
        };
        resolve(db);
      };
      req.onerror = () =>
        reject(
          new StorageError('idb-unavailable', 'не удалось открыть IndexedDB', {
            cause: req.error,
          })
        );
      req.onblocked = () =>
        reject(
          new StorageError('idb-unavailable', 'открытие IndexedDB заблокировано другим соединением')
        );
    }).catch((err: unknown) => {
      pooled.db = undefined; // Неудачу не кэшируем: разрешение могли дать через секунду.
      throw err;
    });
    pooled.db = opening;
    return opening;
  };

  /**
   * Одна транзакция на операцию.
   *
   * Для `readwrite` промис резолвится по `oncomplete` — после КОММИТА. Резолв по
   * `request.onsuccess` означал бы «запрос принят», а не «данные на диске»: транзакция ещё
   * может быть прервана, а вызывающий уже ушёл дальше с ложным успехом.
   */
  const transact = async <T>(
    stores: readonly string[],
    mode: IDBTransactionMode,
    body: (tx: IDBTransaction) => Promise<T> | T
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores as string[], mode);
      let result: T;
      let failed = false;
      tx.oncomplete = () => {
        if (!failed) resolve(result);
      };
      tx.onabort = () => {
        failed = true;
        reject(tx.error ?? new Error('транзакция IndexedDB прервана'));
      };
      tx.onerror = () => {
        failed = true;
        reject(tx.error ?? new Error('транзакция IndexedDB не удалась'));
      };
      Promise.resolve(body(tx))
        .then((value) => {
          result = value;
          // Для чтения ждать коммита незачем: данные уже в руках.
          if (mode === 'readonly' && !failed) resolve(value);
        })
        .catch((err: unknown) => {
          failed = true;
          try {
            tx.abort();
          } catch {
            /* транзакция уже завершена — ронять поверх нечего */
          }
          reject(err);
        });
    });
  };

  // Минус бесконечность, а не 0: иначе «прошло ли окно» зависело бы от начала отсчёта часов,
  // и первая запись сессии проверку пропускала бы ровно там, где она нужнее всего.
  let lastPressureCheck = Number.NEGATIVE_INFINITY;

  const relieve = async (pressure: QuotaPressure): Promise<void> => {
    if (options.onQuotaPressure !== undefined) {
      await options.onQuotaPressure(pressure);
      return;
    }
    if (pressure.workspaceId === undefined) return;
    await removeOldestHistoryImpl(pressure.workspaceId, DEFAULT_RELIEF_RECORDS);
  };

  /** Превентивная проверка: спрашиваем оценку не чаще раза в {@link PRESSURE_CHECK_INTERVAL_MS}. */
  const relieveIfTight = async (workspaceId?: string): Promise<void> => {
    const at = now();
    if (at - lastPressureCheck < PRESSURE_CHECK_INTERVAL_MS) return;
    lastPressureCheck = at;
    let usage: number | undefined;
    let quota: number | undefined;
    try {
      ({ usage, quota } = await estimate());
    } catch {
      return; // Оценки нет — работаем как раньше: отказ по квоте всё равно будет обработан.
    }
    if (usage === undefined || quota === undefined || quota === 0) return;
    if (usage / quota < PRESSURE_RATIO) return;
    await relieve({ workspaceId, urgent: false });
  };

  /**
   * Запись с обработкой квоты: превентивно, затем — РОВНО один повтор.
   *
   * Тело транзакции обязано быть идемпотентным: при отказе по квоте оно выполняется второй раз.
   * Все операции здесь — `put`/`delete` по явным ключам, поэтому это выполняется по построению.
   */
  const write = async <T>(
    workspaceId: string | undefined,
    stores: readonly string[],
    body: (tx: IDBTransaction) => Promise<T> | T
  ): Promise<T> => {
    await relieveIfTight(workspaceId);
    try {
      return await transact(stores, 'readwrite', body);
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      await relieve({ workspaceId, urgent: true });
      try {
        return await transact(stores, 'readwrite', body);
      } catch (retryErr) {
        if (!isQuotaError(retryErr)) throw retryErr;
        throw new StorageError(
          'quota-exceeded',
          'место в IndexedDB кончилось: запись не прошла и после освобождения',
          { cause: retryErr }
        );
      }
    }
  };

  /** Ключи журнала области, самые старые первыми. Читает ТОЛЬКО ключи — тела не поднимает. */
  const historyKeysOldestFirst = async (workspaceId: string): Promise<HistoryKey[]> => {
    const keys = await transact([STORE_HISTORY], 'readonly', (tx) =>
      request(tx.objectStore(STORE_HISTORY).index(INDEX_BY_WORKSPACE).getAllKeys(workspaceId))
    );
    // Индекс по `workspaceId` отдаёт ключи в порядке первичного ключа `[ws, resource, seq]`,
    // то есть сгруппированными по ресурсу. Журнал же — один поток, и старшинство в нём задаёт
    // `seq`, поэтому пересортировываем; сортируются ключи, не записи, так что это дёшево.
    return (keys as unknown as HistoryKey[]).slice().sort((a, b) => a[2] - b[2]);
  };

  const removeOldestHistoryImpl = async (workspaceId: string, count: number): Promise<number> => {
    if (count <= 0) return 0;
    const keys = (await historyKeysOldestFirst(workspaceId)).slice(0, count);
    if (keys.length === 0) return 0;
    await transact([STORE_HISTORY], 'readwrite', (tx) => {
      const store = tx.objectStore(STORE_HISTORY);
      for (const key of keys) store.delete(key);
    });
    return keys.length;
  };

  return {
    dispose: () => closer.dispose(),

    async putWorkspace(record) {
      await write(record.id, [STORE_WORKSPACES], (tx) =>
        request(tx.objectStore(STORE_WORKSPACES).put(record))
      );
    },

    async getWorkspace(id) {
      const found = await transact([STORE_WORKSPACES], 'readonly', (tx) =>
        request(tx.objectStore(STORE_WORKSPACES).get(id) as IDBRequest<WorkspaceRecord | undefined>)
      );
      return found ?? null;
    },

    async listWorkspaces() {
      const all = await transact([STORE_WORKSPACES], 'readonly', (tx) =>
        request(tx.objectStore(STORE_WORKSPACES).getAll() as IDBRequest<WorkspaceRecord[]>)
      );
      return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    },

    async removeWorkspace(id) {
      // Одной транзакцией по всем четырём хранилищам: половина удалённой рабочей области —
      // это осиротевший журнал, который потом некому будет ни показать, ни убрать.
      await write(id, ALL_STORES, async (tx) => {
        tx.objectStore(STORE_WORKSPACES).delete(id);
        for (const name of [STORE_OPENED, STORE_STATS, STORE_HISTORY]) {
          const store = tx.objectStore(name);
          const keys = await request(store.index(INDEX_BY_WORKSPACE).getAllKeys(id));
          for (const key of keys) store.delete(key);
        }
      });
    },

    async getWorkspaceSettings(id) {
      const found = await transact([STORE_WORKSPACES], 'readonly', (tx) =>
        request(tx.objectStore(STORE_WORKSPACES).get(id) as IDBRequest<WorkspaceRecord | undefined>)
      );
      return found?.settings ?? {};
    },

    async putWorkspaceSettings(id, values) {
      // Отсутствие области возвращается ЗНАЧЕНИЕМ, а не исключением из тела: брошенное здесь
      // прерывает транзакцию, а отказ прерванной транзакции приходит вызывающему раньше
      // и вместо него — и «области нет» стало бы неотличимо от любого другого срыва записи.
      const stored = await write(id, [STORE_WORKSPACES], async (tx) => {
        const store = tx.objectStore(STORE_WORKSPACES);
        const found = await request(store.get(id) as IDBRequest<WorkspaceRecord | undefined>);
        if (found === undefined) return false;
        await request(store.put({ ...found, settings: values }));
        return true;
      });
      if (!stored) {
        throw new StorageError(
          'bad-workspace-id',
          `настройки некуда положить: рабочей области ${id} в хранилище нет`
        );
      }
    },

    async getAppSettings(scope) {
      const found = await transact([STORE_SETTINGS], 'readonly', (tx) =>
        request(tx.objectStore(STORE_SETTINGS).get(scope) as IDBRequest<SettingsRecord | undefined>)
      );
      return found?.values ?? {};
    },

    async putAppSettings(scope, values) {
      const record: SettingsRecord = { scope, values };
      // Область не названа: `write` без идентификатора освобождает место только политикой
      // владельца журнала — своей рабочей области у настроек нет.
      await write(undefined, [STORE_SETTINGS], (tx) =>
        request(tx.objectStore(STORE_SETTINGS).put(record))
      );
    },

    async putOpened(record) {
      await write(record.workspaceId, [STORE_OPENED], (tx) =>
        request(tx.objectStore(STORE_OPENED).put(record))
      );
    },

    async listOpened(workspaceId) {
      const all = await transact([STORE_OPENED], 'readonly', (tx) =>
        request(
          tx.objectStore(STORE_OPENED).index(INDEX_BY_WORKSPACE).getAll(workspaceId) as IDBRequest<
            OpenedRecord[]
          >
        )
      );
      return all.sort((a, b) => a.order - b.order);
    },

    async removeOpened(workspaceId, resourceId) {
      await write(workspaceId, [STORE_OPENED], (tx) =>
        request(tx.objectStore(STORE_OPENED).delete(openedKey(workspaceId, resourceId)))
      );
    },

    async putStat(record) {
      await write(record.workspaceId, [STORE_STATS], (tx) =>
        request(tx.objectStore(STORE_STATS).put(record))
      );
    },

    async putStats(records) {
      if (records.length === 0) return;
      await write(records[0].workspaceId, [STORE_STATS], (tx) => {
        const store = tx.objectStore(STORE_STATS);
        for (const record of records) store.put(record);
      });
    },

    async getStat(workspaceId, path) {
      const found = await transact([STORE_STATS], 'readonly', (tx) =>
        request(
          tx.objectStore(STORE_STATS).get(statKey(workspaceId, path)) as IDBRequest<
            StatRecord | undefined
          >
        )
      );
      return found ?? null;
    },

    async listStats(workspaceId) {
      const all = await transact([STORE_STATS], 'readonly', (tx) =>
        request(
          tx.objectStore(STORE_STATS).index(INDEX_BY_WORKSPACE).getAll(workspaceId) as IDBRequest<
            StatRecord[]
          >
        )
      );
      return all.sort((a, b) => a.path.localeCompare(b.path));
    },

    async removeStats(workspaceId, paths) {
      if (paths.length === 0) return;
      await write(workspaceId, [STORE_STATS], (tx) => {
        const store = tx.objectStore(STORE_STATS);
        for (const path of paths) store.delete(statKey(workspaceId, path));
      });
    },

    async appendHistory(record) {
      await write(record.workspaceId, [STORE_HISTORY], (tx) =>
        request(tx.objectStore(STORE_HISTORY).put(record))
      );
    },

    async listHistory(workspaceId, resourceId) {
      const all = await transact([STORE_HISTORY], 'readonly', (tx) =>
        request(
          tx
            .objectStore(STORE_HISTORY)
            .index(INDEX_BY_RESOURCE)
            .getAll([workspaceId, resourceId]) as IDBRequest<HistoryRecord[]>
        )
      );
      return all.sort((a, b) => a.seq - b.seq);
    },

    async listWorkspaceHistory(workspaceId) {
      const all = await transact([STORE_HISTORY], 'readonly', (tx) =>
        request(
          tx.objectStore(STORE_HISTORY).index(INDEX_BY_WORKSPACE).getAll(workspaceId) as IDBRequest<
            HistoryRecord[]
          >
        )
      );
      // Индекс отдаёт записи в порядке первичного ключа, то есть сгруппированными по ресурсу.
      // Журнал же — один поток, и старшинство в нём задаёт `seq`.
      return all.sort((a, b) => a.seq - b.seq);
    },

    async lastSeq(workspaceId) {
      const keys = await historyKeysOldestFirst(workspaceId);
      const last = keys[keys.length - 1];
      return last === undefined ? 0 : last[2];
    },

    async removeHistoryBefore(workspaceId, before) {
      const keys = (await historyKeysOldestFirst(workspaceId)).filter((key) => key[2] < before);
      if (keys.length === 0) return 0;
      await write(workspaceId, [STORE_HISTORY], (tx) => {
        const store = tx.objectStore(STORE_HISTORY);
        for (const key of keys) store.delete(key);
      });
      return keys.length;
    },

    removeOldestHistory(workspaceId, count) {
      return removeOldestHistoryImpl(workspaceId, count);
    },
  };
}

/**
 * Хранилище для окружения без IndexedDB.
 *
 * Отказывает одинаково на всех операциях и с одним кодом: вызывающий, проверивший
 * {@link idbSupported}, сюда не попадёт, а тот, кто не проверил, получит объяснимую ошибку
 * вместо `undefined is not a function` из глубины.
 */
function unavailableStore(): WorkspaceMetaStore {
  // Отказ ПРОМИСОМ, а не исключением: все операции хранилища асинхронны, и вызывающий
  // ловит их через `await`/`catch`, а не через `try` вокруг вызова.
  const fail = (): Promise<never> =>
    Promise.reject(new StorageError('idb-unavailable', 'IndexedDB недоступен в этом окружении'));
  return {
    dispose: () => undefined,
    putWorkspace: fail,
    getWorkspace: fail,
    listWorkspaces: fail,
    removeWorkspace: fail,
    getWorkspaceSettings: fail,
    putWorkspaceSettings: fail,
    getAppSettings: fail,
    putAppSettings: fail,
    putOpened: fail,
    listOpened: fail,
    removeOpened: fail,
    putStat: fail,
    putStats: fail,
    getStat: fail,
    listStats: fail,
    removeStats: fail,
    appendHistory: fail,
    listHistory: fail,
    listWorkspaceHistory: fail,
    lastSeq: fail,
    removeHistoryBefore: fail,
    removeOldestHistory: fail,
  };
}
