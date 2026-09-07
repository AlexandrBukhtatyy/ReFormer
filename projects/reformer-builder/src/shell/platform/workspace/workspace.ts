/**
 * Workspace — рабочий набор поверх источника, а не зеркало проекта.
 *
 * ## Два множества, а не одно
 *
 * ```text
 * opened          явное действие пользователя: вкладки, закрепление
 * materialized    кэш содержимого, включая догруженные зависимости
 * ```
 *
 * `opened ⊆ materialized`. Разведение обязательно: без него «единица открытия» становится
 * неразрешимым вопросом — файл ломает компиляцию (сосед по импорту не открыт, значит его нет),
 * а каталог формы не покрывает импорт извне каталога. С разведением ответ тривиален: открытие —
 * это вкладка, а всё, что нужно ей для сборки, догружается в кэш и живёт по своим правилам.
 *
 * ## `writeText` пишет в рабочую копию; единственный путь наружу — `save`
 *
 * Это не удобство, а граница прав. Ассистент работает теми же операциями, что и интерфейс,
 * и именно поэтому не нуждается в отдельных правах: он физически не может дотянуться
 * до источника мимо сохранения. Отдельный «канал записи для агента» пришлось бы охранять
 * политиками, и первая же дыра в них означала бы правку файла без ведома пользователя.
 *
 * Одна дверь на всех означает, что в журнале правки неразличимы, — если у двери нет таблички.
 * Табличка есть: {@link WriteOptions} называет происхождение и логический шаг. Прав она не
 * даёт (запись и так разрешена) и по умолчанию не меняет ничего, поэтому границу прав она
 * не трогает — она делает возможным аудит, ради которого журнал и заводился.
 *
 * ## Истина
 *
 * Workspace — истина для РЕСУРСОВ. Для открытого документа истина — его буфер (а после Э6 —
 * модель), и файл в рабочей области является её сериализацией. Поэтому `writeText` обновляет
 * буфер открытого документа, а не наоборот.
 *
 * ## События приходят пакетом, всегда
 *
 * Одиночное изменение — пакет из одного. Причина — материализация замыкания: бюджет допускает
 * до 200 файлов, и событие на ресурс означало бы 200 перерисовок дерева на одно открытие
 * документа. Пакет собирается на время операции и отправляется одной микрозадачей после её
 * завершения, поэтому соседние операции коалесцируются, а подписчик всегда получает связный
 * срез, а не полуфабрикат.
 *
 * ## Деградация без хранилища
 *
 * Отказ метаданных (нет IndexedDB, очищены данные сайта) не валит рабочую область: она
 * продолжает работать в памяти сессии. Теряется не содержимое, а качество вытеснения
 * и восстановление набора после перезагрузки — цена, которую надо платить один раз
 * и с предупреждением, а не падением на каждом чтении.
 *
 * ## Журнал изменений подключается, а не встраивается
 *
 * Журнал ({@link WorkspaceOptions.journal}) необязателен, и БЕЗ НЕГО рабочая область работает
 * ровно как работала: ни одной лишней операции, ни одного лишнего чтения. Это не осторожность,
 * а требование к шву — журнал появился отдельным слоем со своими сроками и своей политикой
 * хранения, и делать его обязательным значило бы связать две сдачи в одну.
 *
 * С журналом рабочая область берёт на себя ровно одно: рассказать ему о правках, которые сама
 * же и совершила ({@link Workspace.writeText} и {@link Workspace.revert}). Всё остальное —
 * схлопывание, опорные снимки, уборка по потолку — решает журнал, потому что это его политика,
 * а не политика набора файлов.
 *
 * @module shell/platform/workspace/workspace
 */

import type { Diagnostic } from '@/shell/platform/services/diagnostics/types';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import { createEventBus, defineEvent, type EventBus } from '@/shell/platform/primitives/event';
import {
  basename,
  dirname,
  isTextMediaType,
  makeResourceId,
  mediaTypeFor,
  normalizePath,
  parseResourceId,
  type ResourceId,
  type ResourceRef,
  type ResourceStat,
} from '@/shell/platform/primitives/resource';
import { createDocument, type Document, type DocumentHandle } from './document';
import {
  DEFAULT_EVICTION_BUDGET,
  planEviction,
  type EvictionBudget,
  type EvictionEntry,
} from './eviction';
import {
  CLOSURE_DIAGNOSTIC_SOURCE,
  DEFAULT_CLOSURE_BUDGET,
  materializeClosure,
  type ClosureBudget,
  type ClosureFile,
  type ClosureHost,
  type ImportExtractor,
  type MaterializeResult,
} from './materialize';
import type { Journal } from './journal/journal';
import type { JournalOrigin } from './journal/record';
import { classifyDivergence, type ExternalCheck } from './merge/divergence';
import { diffText, type TextEdit } from './model/history';
import {
  conflictRevision,
  isSourceError,
  type SourceEntry,
  type SourceErrorKind,
  type WorkspaceSource,
} from './source';
import type { StatRecord, WorkspaceMetaStore } from './storage/idb';
import type { WorkspaceFileStore } from './storage/opfs';

/** Что случилось с ресурсом. */
export type WorkspaceChangeType = 'materialized' | 'written' | 'saved' | 'evicted' | 'removed';

export interface WorkspaceChangeItem {
  readonly id: ResourceId;
  readonly type: WorkspaceChangeType;
}

/**
 * Пакет изменений. Подписчик фильтрует сам — сводить фильтрацию в подписку значило бы
 * пересобирать пакет под каждого.
 */
export interface WorkspaceChange {
  readonly changes: readonly WorkspaceChangeItem[];
}

/** Событие шины. Идентификатор с пространством имён владельца — требование `event.ts`. */
export const WorkspaceDidChange = defineEvent<WorkspaceChange>('workspace.didChange');

/** Ресурс не сохранился: ревизия у источника разошлась с той, от которой мы правили. */
export interface SaveConflict {
  readonly id: ResourceId;
  /** Ревизия, которую мы считали текущей. */
  readonly expected?: string;
  /** Ревизия источника сейчас. Без неё диалогу слияния нечего показать. */
  readonly actual?: string;
}

/** Ресурс не сохранился по причине, не являющейся конфликтом. */
export interface SaveFailure {
  readonly id: ResourceId;
  readonly kind: SourceErrorKind;
  readonly message: string;
}

/**
 * Итог сохранения.
 *
 * Результат, а не исключение: `save()` без аргумента сохраняет всё изменённое, и один
 * конфликт не должен отменять остальные записи. Исключение выбрасывается только на том,
 * что отказом источника не является — то есть на ошибке в нас самих.
 */
export interface SaveResult {
  readonly ok: boolean;
  readonly saved: readonly ResourceId[];
  readonly conflicts: readonly SaveConflict[];
  readonly failures: readonly SaveFailure[];
}

/**
 * Чем пометить правку в журнале — необязательная приписка к {@link Workspace.writeText}.
 *
 * **Зачем понадобилась.** Запись в рабочую копию у всех одна и та же дверь: и интерфейс,
 * и структурный редактор, и ассистент зовут `writeText`. Это граница прав, и менять её
 * нельзя. Но пока у двери не было таблички, журнал писал `origin: 'user'` на всё подряд —
 * то есть правку машины было нечем отличить от правки человека, а различимость и есть
 * половина ценности аудита, ради которого журнал заводился.
 *
 * **Почему приписка, а не отдельный метод.** Второй метод записи означал бы второй путь,
 * который придётся охранять политиками, — ровно то, чего избегает шапка модуля. Здесь же
 * ничего не охраняется: пометка НЕ ДАЁТ прав, она только называет автора уже разрешённой
 * записи, и подделка её не открывает ни одной двери.
 *
 * **Необязательная, и это часть контракта.** Вызывающий, который о происхождении не думал,
 * обязан получить прежнее поведение до последней записи журнала.
 */
/** Чем править сохранение. Пусто по умолчанию — обычное сохранение ничего не знает о слиянии. */
export interface SaveOptions {
  /**
   * Ревизия, ОТ КОТОРОЙ мы правили, вместо той, что помнит рабочая область.
   *
   * Нужна ровно одному вызывающему — тому, кто разрешил расхождение: он слил текст поверх
   * версии источника, значит ожидаемой стала именно она, а не та, с которой мы разошлись.
   * Без этого сохранение после слияния конфликтовало бы вечно.
   *
   * Побочное следствие, названное намеренно: с `expected` сохранение пишет ДАЖЕ неизменённый
   * относительно BASE текст. Обычное сохранение такой файл пропускает («писать нечего»),
   * но при разрешении конфликта «нечего» неверно: в источнике сейчас другое, и не записать
   * значит оставить расхождение неразрешённым.
   */
  readonly expected?: string;
}

export interface WriteOptions {
  /**
   * Кто правит. По умолчанию `'user'`: `writeText` без пометки зовут от имени человека,
   * и в этом случае догадка верна.
   *
   * Словарь — целиком журнальный ({@link JournalOrigin}), а не сокращённый до «человек или
   * машина»: рабочая область здесь ПЕРЕДАТОЧНОЕ звено, и сужать чужой словарь по дороге
   * значило бы завести второй, который разъедется с первым.
   */
  readonly origin?: JournalOrigin;
  /**
   * Логический шаг, которому принадлежит правка: ход ассистента, мультикурсорная правка.
   *
   * Нужен для `Journal.undoTransaction` — отката шага целиком. Ход, приземлившийся ДВУМЯ
   * записями (например, ход со второй попыткой), отменяется одним действием только если обе
   * записи названы одним `txId`; без него отменять пришлось бы по одной, и промежуточное
   * состояние формы человек увидел бы как результат.
   */
  readonly txId?: string;
}

export interface Workspace {
  readonly id: string;
  readonly sourceId: string;

  /* множество opened */

  /**
   * Открывает ресурс: материализует его вместе с замыканием импортов и создаёт документ.
   *
   * Повторное открытие отдаёт ТОТ ЖЕ документ и в источник не ходит — иначе две вкладки
   * одного файла разошлись бы в двух буферах.
   */
  open(id: ResourceId): Promise<Document>;
  /** Снимает закрепление. Содержимое остаётся: удаление ленивое, см. `eviction.ts`. */
  close(id: ResourceId): Promise<void>;
  openedResources(): readonly ResourceId[];

  /* содержимое; материализует по требованию */

  readText(id: ResourceId): Promise<string>;
  readBytes(id: ResourceId): Promise<Uint8Array>;
  /**
   * Пишет в рабочую копию. В источник не пишет ничего и никогда — для этого есть `save`.
   *
   * `options` — только пометка для журнала: на саму запись она не влияет ничем, и без журнала
   * не значит вообще ничего. Пропущенный `options` даёт прежнее поведение до последней записи —
   * см. {@link WriteOptions}.
   */
  writeText(id: ResourceId, text: string, options?: WriteOptions): Promise<void>;
  /** Свойства без материализации: `stat` заменяет проверку существования и стоит столько же. */
  stat(id: ResourceId): Promise<ResourceStat | null>;
  /** Один уровень каталога: то, что в источнике, плюс созданное локально и ещё не сохранённое. */
  list(dir: ResourceId): Promise<readonly ResourceRef[]>;

  /**
   * BASE — содержимое, каким его отдал источник, когда мы его прочитали.
   *
   * `null` означает «основания нет»: файл создан локально либо BASE вытеснен вместе
   * с ресурсом. Для трёхстороннего слияния это разница между «сливаем» и «спрашиваем»,
   * поэтому отдельный ответ, а не пустая строка.
   *
   * Наружу выведен ради слияния и только: BASE — не вторая рабочая копия, писать в него
   * нельзя ниоткуда, кроме материализации и сохранения.
   */
  readBase(id: ResourceId): Promise<string | null>;

  /**
   * Читает ресурс ИЗ ИСТОЧНИКА, минуя рабочую копию и не трогая её.
   *
   * Это третья сторона слияния — «версия источника». Кэш здесь противопоказан: спрашиваем
   * ровно затем, что подозреваем расхождение, и ответ рабочей области на этот вопрос — то,
   * с чем мы разошлись.
   *
   * `null` — файла в источнике больше нет.
   */
  readSourceText(id: ResourceId): Promise<{ text: string; revision?: string } | null>;

  /**
   * Спрашивает источник, не ушёл ли он вперёд. Без списка — обо всех ОТКРЫТЫХ ресурсах.
   *
   * Содержимое не тянется: только `stat` и сравнение ревизий. Ограничение открытыми
   * записано в контракте (решение 4) и держится здесь, а не у вызывающего: догруженные
   * по импорту соседи исчисляются сотнями, и обход их всех при каждом возврате фокуса
   * превратил бы дешёвую проверку в обход диска.
   */
  checkSource(ids?: readonly ResourceId[]): Promise<readonly ExternalCheck[]>;

  /* Workspace → Source */

  /** Без аргумента — всё изменённое. `options` осмысленны только вместе с `id`. */
  save(id?: ResourceId, options?: SaveOptions): Promise<SaveResult>;
  /** Возвращает рабочую копию к BASE. Локально созданный файл при этом исчезает. */
  revert(id: ResourceId): Promise<void>;

  /**
   * Принимает версию источника как свою: рабочая копия, BASE и ревизия становятся её.
   *
   * Исход «взять версию источника» из диалога слияния. В источник при этом НЕ пишется
   * ничего, и это единственно верно по двум причинам: писать туда то, что там и так лежит,
   * означало бы лишнюю ревизию на пустом месте, а источник только на чтение (расхождение
   * у него обнаруживается так же) не принял бы запись вовсе.
   *
   * После вызова ресурс не изменён: сливать больше нечего.
   */
  acceptExternal(id: ResourceId, text: string, revision?: string): Promise<void>;

  isDirty(id?: ResourceId): boolean;
  onDidChange(cb: (e: WorkspaceChange) => void): Disposable;
}

/**
 * Куда уходит диагностика догрузки. Форма совпадает с `DiagnosticsService.publish`, поэтому
 * служба подставляется как есть — но Workspace от неё не зависит и работает без неё.
 */
export interface DiagnosticsSink {
  publish(resource: ResourceId, source: string, items: readonly Diagnostic[]): void;
}

/**
 * Журнал — в объёме, который нужен рабочей области.
 *
 * `Pick` от настоящего журнала, а не свой интерфейс: список обязан оставаться ПОДмножеством,
 * иначе он разъедется с ним при первой же правке, и разъезд обнаружится не компилятором,
 * а в рантайме. Тот же приём, которым журнал сужает хранилище метаданных (`JournalStore`).
 *
 * Одного метода достаточно: рабочая область только РАССКАЗЫВАЕТ о правках. Читать журнал,
 * восстанавливать по нему состояние и убирать старое — дело владельца журнала, и давать
 * рабочей области эти методы значило бы позволить ей принимать решения о чужой политике.
 */
export type WorkspaceJournal = Pick<Journal, 'record'>;

export interface WorkspaceOptions {
  /** Идентификатор рабочей области; обязан совпадать с тем, на котором создано хранилище файлов. */
  readonly id: string;
  readonly source: WorkspaceSource;
  readonly files: WorkspaceFileStore;
  readonly meta: WorkspaceMetaStore;
  /** Общая шина, если события нужны за пределами рабочей области. По умолчанию — своя. */
  readonly events?: EventBus;
  readonly diagnostics?: DiagnosticsSink;
  /**
   * Куда писать правки рабочих копий. Без него всё работает как раньше — просто без истории.
   *
   * **Журнал создаёт композиция, а не рабочая область.** Ему нужно хранилище метаданных
   * и содержимое ресурса для опорных снимков, а содержимое умеет отдать только сама рабочая
   * область — то есть тот, кого ещё нет в момент создания журнала. Разрывается это отложенным
   * замыканием, ровно как в `createJournalRelief`:
   *
   * ```ts
   * let workspace: Workspace | undefined;
   * const journal = createJournal({
   *   store: meta,
   *   workspaceId,
   *   content: (resource) => workspace?.readText(resource),
   * });
   * workspace = createWorkspace({ id: workspaceId, source, files, meta, journal });
   * ```
   *
   * Без `content` журнал записи ведёт, но опорных снимков не кладёт, а без них восстановление
   * невозможно — поэтому провайдер содержимого обязателен для того, кто журнал заводит.
   */
  readonly journal?: WorkspaceJournal;
  readonly closureBudget?: ClosureBudget;
  readonly evictionBudget?: EvictionBudget;
  readonly imports?: ImportExtractor;
  readonly now?: () => number;
}

/** Материализованный ресурс в памяти: зеркало `StatRecord`, но синхронно читаемое. */
interface Entry {
  readonly path: string;
  readonly kind: 'file' | 'directory';
  revision?: string;
  size: number;
  mediaType: string;
  hasBase: boolean;
  dirty: boolean;
  readonly materializedAt: number;
  lastUsedAt: number;
}

/** Открытый ресурс: документ, порядок вкладки и замыкание, которое он удерживает. */
interface OpenState {
  readonly handle: DocumentHandle;
  readonly order: number;
  /** Пути, без которых документ не собирается. Пока он открыт, они не вытесняются. */
  required: ReadonlySet<string>;
}

const encoder = new TextEncoder();

/** Размер в байтах, а не в кодовых единицах: бюджеты и `stats` считают байты. */
function byteLength(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Создаёт рабочую область над источником и парой хранилищ.
 *
 * Всё внедряется, ничего не создаётся внутри: рабочая область не знает, откуда взялся
 * источник (Э3 восстановит его по дескриптору), а хранилища создаются один раз на приложение
 * и переиспользуются. Побочная выгода — тесты идут против подставных хранилищ из
 * `storage/testing.ts` без единого мока.
 */
export function createWorkspace(options: WorkspaceOptions): Workspace {
  const { id, source, files: store, meta } = options;
  if (store.workspaceId !== id) {
    throw new Error(
      `хранилище файлов создано для другой рабочей области: ${store.workspaceId} ≠ ${id}`
    );
  }

  const bus = options.events ?? createEventBus();
  const now = options.now ?? ((): number => Date.now());
  const closureBudget = options.closureBudget ?? DEFAULT_CLOSURE_BUDGET;
  const evictionBudget = options.evictionBudget ?? DEFAULT_EVICTION_BUDGET;

  const materialized = new Map<string, Entry>();
  const opened = new Map<ResourceId, OpenState>();
  /** Свойства, изменившиеся в памяти и ещё не записанные. Пишутся одной транзакцией. */
  const dirtyStats = new Set<string>();
  /** Пути, чьи свойства надо удалить: вытеснение и откат созданного файла. */
  const droppedStats = new Set<string>();

  let openedOrder = 0;

  /*
   * ─────────────────────────  идентификаторы  ─────────────────────────
   */

  const idOf = (path: string): ResourceId => makeResourceId(source.id, path);

  const pathOf = (resource: ResourceId): string => {
    const parsed = parseResourceId(resource);
    if (parsed.sourceId !== source.id) {
      throw new Error(`ресурс чужого источника: ${resource} (ожидался ${source.id})`);
    }
    return parsed.path;
  };

  const refOf = (entry: Entry): ResourceRef => ({
    id: idOf(entry.path),
    sourceId: source.id,
    path: entry.path,
    name: basename(entry.path),
    kind: entry.kind,
    mediaType: entry.mediaType,
  });

  /*
   * ─────────────────────────  пакет изменений  ─────────────────────────
   */

  const pendingChanges: WorkspaceChangeItem[] = [];
  let batchDepth = 0;
  let flushScheduled = false;

  const note = (path: string, type: WorkspaceChangeType): void => {
    pendingChanges.push({ id: idOf(path), type });
  };

  const flushChanges = (): void => {
    flushScheduled = false;
    if (batchDepth > 0 || pendingChanges.length === 0) return;
    bus.emit(WorkspaceDidChange, { changes: pendingChanges.splice(0, pendingChanges.length) });
  };

  /**
   * Обёртка операции: пока она идёт, изменения копятся, а не рассылаются.
   *
   * Группировать по одной микрозадаче без этого нельзя: операция — цепочка `await`, и каждая
   * её ступень попадала бы в свою микрозадачу, то есть в своё событие. Отправка планируется
   * микрозадачей уже ПОСЛЕ завершения — так коалесцируются и соседние операции.
   */
  const batched = async <T>(body: () => Promise<T>): Promise<T> => {
    batchDepth += 1;
    try {
      return await body();
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0 && !flushScheduled) {
        flushScheduled = true;
        queueMicrotask(flushChanges);
      }
    }
  };

  /*
   * ─────────────────────────  метаданные  ─────────────────────────
   */

  let metaBroken = false;

  /**
   * Метаданные — не критический путь: без них теряется восстановление набора и качество
   * вытеснения, но не содержимое. Поэтому первый отказ переводит хранилище в «сломано»
   * и дальше не тревожит операции.
   */
  const tryMeta = async (body: () => Promise<void>): Promise<void> => {
    if (metaBroken) return;
    try {
      await body();
    } catch (err) {
      metaBroken = true;
      console.error(
        '[workspace] метаданные недоступны; рабочая область продолжает работать в памяти',
        err
      );
    }
  };

  /*
   * ─────────────────────────  журнал  ─────────────────────────
   */

  const journal = options.journal;
  let journalBroken = false;

  /**
   * Записывает правку в журнал — если журнал вообще подключён.
   *
   * Политика отказа та же, что у метаданных, и по той же причине: журнал — не критический
   * путь. Без него теряется история и восстановление после перезагрузки, но не содержимое,
   * а правка, которую не приняли в журнал, уже лежит в рабочей копии. Ронять из-за этого
   * запись означало бы менять поведение редактора в зависимости от состояния хранилища —
   * то есть делать журнал обязательным задним числом.
   *
   * Происхождение приходит пометкой от вызывающего ({@link WriteOptions}); умолчание —
   * `'user'`, потому что `writeText` без пометки зовут от имени человека. Ассистент правит
   * теми же операциями (в этом смысл границы прав), и назвать себя ему больше нечем: канал
   * пометки — единственное, что отличает его запись от человеческой. Записи с разным
   * происхождением журнал не схлопывает (`journal/policy.canMerge`), поэтому ход ассистента
   * не сливается с правкой руками, случившейся секундой раньше.
   */
  const journalEdits = async (
    resource: ResourceId,
    edits: readonly TextEdit[],
    options?: WriteOptions
  ): Promise<void> => {
    if (journal === undefined || journalBroken || edits.length === 0) return;
    try {
      await journal.record({
        resource,
        origin: options?.origin ?? 'user',
        ...(options?.txId === undefined ? {} : { txId: options.txId }),
        payload: { kind: 'text', edits },
      });
    } catch (err) {
      journalBroken = true;
      console.error('[workspace] журнал недоступен; правки перестали попадать в историю', err);
    }
  };

  /** Текст рабочей копии ДО правки — основание для дельты. Читается только ради журнала. */
  const journalBase = async (path: string): Promise<string | null> => {
    if (journal === undefined || journalBroken) return null;
    return store.readText('files', path);
  };

  const toRecord = (entry: Entry): StatRecord => ({
    workspaceId: id,
    path: entry.path,
    kind: entry.kind,
    revision: entry.revision,
    size: entry.size,
    mediaType: entry.mediaType,
    hasBase: entry.hasBase,
    materializedAt: entry.materializedAt,
    lastUsedAt: entry.lastUsedAt,
    dirty: entry.dirty,
  });

  /** Сбрасывает накопленные свойства одной транзакцией: замыкание приносит их до 200 разом. */
  const persist = async (): Promise<void> => {
    if (dirtyStats.size > 0) {
      const records: StatRecord[] = [];
      for (const path of dirtyStats) {
        const entry = materialized.get(path);
        if (entry !== undefined) records.push(toRecord(entry));
      }
      dirtyStats.clear();
      if (records.length > 0) await tryMeta(() => meta.putStats(records));
    }
    if (droppedStats.size > 0) {
      const paths = [...droppedStats];
      droppedStats.clear();
      await tryMeta(() => meta.removeStats(id, paths));
    }
  };

  let hydration: Promise<void> | undefined;

  /**
   * Поднимает множество materialized из `stats`.
   *
   * Именно это делает удаление ленивым между сессиями: содержимое пережило перезагрузку
   * в OPFS, и повторное открытие того же файла не идёт в источник.
   *
   * Вкладки (`opened`) здесь НЕ восстанавливаются. Восстановление сессии — решение оболочки:
   * какие вкладки поднять, в каком порядке и какую сделать активной, знает она, а не рабочая
   * область. Записи в хранилище для этого есть; поднимет их Э5, вызвав `open` на каждой.
   */
  const ready = (): Promise<void> => {
    if (hydration !== undefined) return hydration;
    hydration = tryMeta(async () => {
      for (const record of await meta.listStats(id)) {
        // То, что успели материализовать до гидратации, свежее записи в хранилище.
        if (materialized.has(record.path)) continue;
        materialized.set(record.path, {
          path: record.path,
          kind: record.kind,
          revision: record.revision,
          size: record.size ?? 0,
          mediaType: record.mediaType ?? mediaTypeFor(record.path),
          hasBase: record.hasBase,
          dirty: record.dirty,
          materializedAt: record.materializedAt,
          lastUsedAt: record.lastUsedAt,
        });
      }
    });
    return hydration;
  };

  /*
   * ─────────────────────────  материализация  ─────────────────────────
   */

  const touch = (entry: Entry): void => {
    entry.lastUsedAt = now();
    dirtyStats.add(entry.path);
  };

  /** Доводит ресурс до рабочей области. Отказ источника выходит наружу как есть. */
  const materializeOne = async (path: string): Promise<ClosureFile> => {
    const existing = materialized.get(path);
    if (existing !== undefined) {
      touch(existing);
      return { path, bytes: existing.size, fresh: false };
    }

    const content = await source.read(path);
    const size = byteLength(content.text);
    // Оба слоя пишутся сразу: BASE, появившийся позже содержимого, означал бы окно, в котором
    // слияние невозможно, — а именно в этом окне и происходит первая правка.
    await store.writeText('files', path, content.text);
    await store.writeText('base', path, content.text);

    const ts = now();
    materialized.set(path, {
      path,
      kind: 'file',
      revision: content.revision,
      size,
      mediaType: mediaTypeFor(path, content.mediaType),
      hasBase: true,
      dirty: false,
      materializedAt: ts,
      lastUsedAt: ts,
    });
    dirtyStats.add(path);
    note(path, 'materialized');
    return { path, bytes: size, fresh: true };
  };

  /** То же, но «в источнике нет» — обычный ответ, а не авария: догрузка идёт дальше. */
  const tryMaterializeOne = async (path: string): Promise<ClosureFile | null> => {
    try {
      return await materializeOne(path);
    } catch (err) {
      if (isSourceError(err, 'not-found')) return null;
      throw err;
    }
  };

  /** Двоичный ресурс. Источник без `readBytes` отдаёт текст — кодируем его сами. */
  const materializeBytes = async (path: string): Promise<void> => {
    const existing = materialized.get(path);
    if (existing !== undefined) {
      touch(existing);
      return;
    }
    const readBytes = source.readBytes;
    if (readBytes === undefined) {
      await materializeOne(path);
      return;
    }
    const content = await readBytes.call(source, path);
    await store.writeBytes('files', path, content.bytes);
    await store.writeBytes('base', path, content.bytes);
    const ts = now();
    materialized.set(path, {
      path,
      kind: 'file',
      revision: content.revision,
      size: content.bytes.length,
      mediaType: mediaTypeFor(path, content.mediaType),
      hasBase: true,
      dirty: false,
      materializedAt: ts,
      lastUsedAt: ts,
    });
    dirtyStats.add(path);
    note(path, 'materialized');
  };

  /**
   * Текст рабочей копии.
   *
   * Пропажа файла при живой записи в `stats` — не выдумка: OPFS чистится браузером, и данные
   * сайта удаляются целиком. Тогда запись в памяти врёт, и единственный честный ответ —
   * сходить в источник ещё раз.
   */
  const workingText = async (path: string): Promise<string> => {
    const text = await store.readText('files', path);
    if (text !== null) return text;
    materialized.delete(path);
    await materializeOne(path);
    const again = await store.readText('files', path);
    if (again === null) throw new Error(`рабочая копия недоступна после материализации: ${path}`);
    return again;
  };

  const closureHost: ClosureHost = {
    materialize: (path) => tryMaterializeOne(path),
    async textOf(path) {
      const entry = materialized.get(path);
      // Двоичный ресурс импортов не несёт, и декодировать его текстом — тихая порча данных.
      if (entry !== undefined && !isTextMediaType(entry.mediaType)) return null;
      return store.readText('files', path);
    },
    async resolves(path) {
      if (materialized.has(path)) return true;
      const found = await source.stat(path);
      return found !== null && found.kind === 'file';
    },
  };

  const runClosure = async (path: string): Promise<MaterializeResult> => {
    const result = await materializeClosure(path, closureHost, {
      budget: closureBudget,
      imports: options.imports,
    });
    // Публикуем ВСЕГДА, включая пустой список: пустая публикация снимает то, что догрузка
    // сообщала о прошлом состоянии этого ресурса, — см. `diagnostics/service.ts`.
    options.diagnostics?.publish(idOf(path), CLOSURE_DIAGNOSTIC_SOURCE, result.diagnostics);
    return result;
  };

  /*
   * ─────────────────────────  вытеснение  ─────────────────────────
   */

  /**
   * Проверяет потолок и выбрасывает лишнее.
   *
   * Вызывается там, где набор растёт (материализация при чтении и открытии) и там, где он
   * теряет защитника (`close`). В `writeText` — намеренно нет: это дебаунсенный горячий путь,
   * а запись сама себя защищает признаком изменённости, и сканировать набор на каждое
   * нажатие клавиши незачем.
   */
  const maybeEvict = async (): Promise<void> => {
    const pinned = new Set<string>();
    const required = new Set<string>();
    for (const [resource, state] of opened) {
      pinned.add(pathOf(resource));
      for (const path of state.required) required.add(path);
    }

    const entries: EvictionEntry[] = [];
    for (const entry of materialized.values()) {
      entries.push({
        path: entry.path,
        size: entry.size,
        lastUsedAt: entry.lastUsedAt,
        dirty: entry.dirty,
        pinned: pinned.has(entry.path),
        required: required.has(entry.path),
      });
    }

    const plan = planEviction(entries, evictionBudget);
    for (const path of plan.evict) {
      // Пара, а не файл: выброшенный в одиночку BASE — потеря возможности слияния.
      await store.removePair(path);
      materialized.delete(path);
      dirtyStats.delete(path);
      droppedStats.add(path);
      note(path, 'evicted');
    }
  };

  /*
   * ─────────────────────────  публичный API  ─────────────────────────
   */

  return {
    id,
    sourceId: source.id,

    open(resource) {
      return batched(async () => {
        await ready();
        const path = pathOf(resource);

        const existing = opened.get(resource);
        if (existing !== undefined) {
          const entry = materialized.get(path);
          if (entry !== undefined) touch(entry);
          await persist();
          return existing.handle.document;
        }

        // Корень материализуется отдельно и первым: его отсутствие — отказ открытия,
        // а не «неполное замыкание», и путать эти два случая нельзя.
        await materializeOne(path);
        const closure = await runClosure(path);

        const entry = materialized.get(path);
        if (entry === undefined) throw new Error(`ресурс не материализовался: ${path}`);
        const text = await workingText(path);
        const handle = createDocument(refOf(entry), text, entry.dirty);

        const order = openedOrder;
        openedOrder += 1;
        opened.set(resource, { handle, order, required: new Set(closure.files) });

        const ts = now();
        await tryMeta(() =>
          meta.putOpened({
            workspaceId: id,
            resourceId: resource,
            order,
            // Закрепление вкладки пользователем и защита от вытеснения — разные вещи:
            // от вытеснения защищает само членство в `opened`.
            pinned: false,
            openedAt: ts,
            activatedAt: ts,
          })
        );
        await maybeEvict();
        await persist();
        return handle.document;
      });
    },

    close(resource) {
      return batched(async () => {
        const state = opened.get(resource);
        if (state === undefined) return;
        opened.delete(resource);
        await tryMeta(() => meta.removeOpened(id, resource));
        // Содержимое остаётся: закрыть и открыть тот же файл не должно означать поход
        // в источник. Уйдёт оно только под давлением бюджета — и тогда честно, событием.
        await maybeEvict();
        await persist();
      });
    },

    openedResources() {
      return [...opened.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([resource]) => resource);
    },

    readText(resource) {
      return batched(async () => {
        await ready();
        const path = pathOf(resource);
        // Отказ ДО обращения к источнику: `readText` двоичного ресурса обязан быть отказом,
        // а не набором мусорных символов — тихая порча данных хуже отказа, и тянуть ради неё
        // содержимое незачем.
        const mediaType = materialized.get(path)?.mediaType ?? mediaTypeFor(path);
        if (!isTextMediaType(mediaType)) {
          throw new Error(
            `ресурс не читается текстом: ${path} (${mediaType}) — используй readBytes`
          );
        }
        await materializeOne(path);
        const text = await workingText(path);
        await maybeEvict();
        await persist();
        return text;
      });
    },

    readBytes(resource) {
      return batched(async () => {
        await ready();
        const path = pathOf(resource);
        await materializeBytes(path);
        const bytes = await store.readBytes('files', path);
        if (bytes === null) throw new Error(`рабочая копия недоступна: ${path}`);
        await maybeEvict();
        await persist();
        return bytes;
      });
    },

    writeText(resource, text, options) {
      return batched(async () => {
        await ready();
        const path = pathOf(resource);

        let entry = materialized.get(path);
        if (entry === undefined) {
          // Материализуем ДО записи: без BASE и ревизии `save` не обнаружит конфликт,
          // а слияние не восстановит основание — перезапросить его у источника нельзя.
          const found = await tryMaterializeOne(path);
          entry = materialized.get(path);
          if (found === null || entry === undefined) {
            // В источнике такого нет: это создание нового файла, и BASE у него не бывает.
            const ts = now();
            entry = {
              path,
              kind: 'file',
              revision: undefined,
              size: 0,
              mediaType: mediaTypeFor(path),
              hasBase: false,
              dirty: true,
              materializedAt: ts,
              lastUsedAt: ts,
            };
            materialized.set(path, entry);
            note(path, 'materialized');
          }
        }

        // Основание дельты снимается ДО записи и только когда журнал подключён: без него
        // это лишнее чтение на каждое нажатие клавиши, а `writeText` — дебаунсенный
        // горячий путь. Локально созданного файла в рабочей копии ещё нет — его появление
        // и есть вставка всего текста.
        const previous = await journalBase(path);

        await store.writeText('files', path, text);
        // `dirty` — кэш ответа: пересчёт требует чтения обоих слоёв, и держать его
        // в `stats` дешевле, чем читать BASE на каждый вопрос «изменено ли».
        const base = entry.hasBase ? await store.readText('base', path) : null;
        entry.size = byteLength(text);
        entry.dirty = base === null || base !== text;
        touch(entry);
        note(path, 'written');

        const state = opened.get(resource);
        if (state !== undefined) {
          state.handle.setText(text);
          state.handle.setDirty(entry.dirty);
        }
        await journalEdits(resource, diffText(previous ?? '', text), options);
        await persist();
      });
    },

    async readBase(resource) {
      await ready();
      const path = pathOf(resource);
      const entry = materialized.get(path);
      // Спрашивают про ресурс, которого у нас нет, — основания у нас тоже нет. В источник
      // за ним идти бессмысленно: там уже другая версия, именно поэтому вопрос и задан.
      if (entry === undefined || !entry.hasBase) return null;
      return store.readText('base', path);
    },

    async readSourceText(resource) {
      const path = pathOf(resource);
      try {
        const content = await source.read(path);
        return { text: content.text, revision: content.revision };
      } catch (err) {
        if (isSourceError(err, 'not-found')) return null;
        throw err;
      }
    },

    async checkSource(ids) {
      await ready();
      const targets = ids ?? [...opened.keys()];
      const checks: ExternalCheck[] = [];
      for (const resource of targets) {
        const path = pathOf(resource);
        const entry = materialized.get(path);
        // Не материализован — расходиться нечему: своей версии у нас нет.
        if (entry === undefined) continue;
        const found = await source.stat(path);
        const status = classifyDivergence({
          expected: entry.revision,
          hasBase: entry.hasBase,
          present: found !== null,
          actual: found?.revision,
        });
        checks.push({
          id: resource,
          status,
          expected: entry.revision,
          actual: found?.revision,
        });
      }
      return checks;
    },

    async acceptExternal(resource, text, revision) {
      return batched(async () => {
        await ready();
        const path = pathOf(resource);
        // Оба слоя разом, как при материализации: BASE, отставший от рабочей копии, означал бы
        // «изменено» сразу после принятия чужой версии — то есть ложное расхождение.
        const previous = await journalBase(path);
        await store.writeText('files', path, text);
        await store.writeText('base', path, text);

        const ts = now();
        const entry = materialized.get(path);
        if (entry === undefined) {
          materialized.set(path, {
            path,
            kind: 'file',
            revision,
            size: byteLength(text),
            mediaType: mediaTypeFor(path),
            hasBase: true,
            dirty: false,
            materializedAt: ts,
            lastUsedAt: ts,
          });
          note(path, 'materialized');
        } else {
          entry.revision = revision ?? entry.revision;
          entry.size = byteLength(text);
          entry.hasBase = true;
          entry.dirty = false;
          touch(entry);
        }
        dirtyStats.add(path);
        note(path, 'written');

        const state = opened.get(resource);
        if (state !== undefined) {
          // Буфер обязан догнать: модельный документ переразберёт его сам, и это ровно тот
          // обязательный повторный разбор, которого требует контракт слияния.
          state.handle.setText(text);
          state.handle.setDirty(false);
        }
        // Происхождение `external`: правку принёс источник, а не человек и не ассистент.
        // Различимость в журнале — половина ценности аудита, и здесь она бесплатна.
        await journalEdits(resource, diffText(previous ?? '', text), { origin: 'external' });
        await persist();
      });
    },

    async stat(resource) {
      await ready();
      const path = pathOf(resource);
      const entry = materialized.get(path);
      if (entry !== undefined) {
        return {
          kind: entry.kind,
          revision: entry.revision,
          size: entry.size,
          mediaType: entry.mediaType,
        };
      }
      const found = await source.stat(path);
      if (found === null) return null;
      return {
        kind: found.kind,
        revision: found.revision,
        size: found.size,
        mediaType: mediaTypeFor(path, found.mediaType),
      };
    },

    async list(dir) {
      await ready();
      const base = pathOf(dir);

      let entries: readonly SourceEntry[] = [];
      let missing: unknown;
      try {
        entries = await source.list(base);
      } catch (err) {
        if (!isSourceError(err, 'not-found')) throw err;
        missing = err;
      }

      const refs = new Map<string, ResourceRef>();
      for (const entry of entries) {
        const path = normalizePath(entry.path);
        refs.set(path, {
          id: idOf(path),
          sourceId: source.id,
          path,
          name: entry.name,
          kind: entry.kind,
          mediaType: mediaTypeFor(path),
        });
      }
      // Локально созданный файл обязан появиться в дереве до сохранения: иначе он есть
      // в рабочей копии, но его «нет» в интерфейсе, и пользователь правит невидимку.
      for (const entry of materialized.values()) {
        if (dirname(entry.path) !== base || refs.has(entry.path)) continue;
        refs.set(entry.path, refOf(entry));
      }

      // Каталога нет ни в источнике, ни локально — отказ источника уходит наверх как есть.
      if (missing !== undefined && refs.size === 0) throw missing;

      return [...refs.values()].sort((a, b) =>
        a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
      );
    },

    save(resource, options) {
      return batched(async () => {
        await ready();
        if (options?.expected !== undefined && resource === undefined) {
          // Ожидаемая ревизия относится к ОДНОМУ ресурсу. Применить её ко всему изменённому
          // значило бы записать чужую ревизию каждому файлу — то есть подменить проверку
          // конфликта на её видимость.
          throw new Error('ожидаемая ревизия задаётся только вместе с ресурсом');
        }
        const targets =
          resource === undefined
            ? [...materialized.values()].filter((entry) => entry.dirty).map((entry) => entry.path)
            : [pathOf(resource)];

        const saved: ResourceId[] = [];
        const conflicts: SaveConflict[] = [];
        const failures: SaveFailure[] = [];
        const write = source.write;

        for (const path of targets) {
          const entry = materialized.get(path);
          if (entry === undefined) {
            failures.push({
              id: idOf(path),
              kind: 'not-found',
              message: `ресурс не материализован: ${path}`,
            });
            continue;
          }
          // Явное сохранение неизменённого — не ошибка и не запись: писать нечего.
          // Исключение — разрешение расхождения (`expected` задан): там «не изменён
          // относительно BASE» не значит «совпадает с источником», см. {@link SaveOptions}.
          if (!entry.dirty && options?.expected === undefined) continue;

          if (write === undefined) {
            failures.push({
              id: idOf(path),
              kind: 'unsupported',
              message: 'источник не поддерживает запись',
            });
            continue;
          }

          const text = await store.readText('files', path);
          if (text === null) {
            failures.push({
              id: idOf(path),
              kind: 'not-found',
              message: `рабочая копия недоступна: ${path}`,
            });
            continue;
          }

          const expected = options?.expected ?? entry.revision;
          try {
            // Каталог под НОВЫЙ файл создаёт рабочая область, а не тот, кто её позвал.
            //
            // `Source.write` пишет файл, а не путь: у файлового источника он требует готовый
            // каталог и отвечает `not-found`, если каталога нет. Материализовать файл по
            // адресу внутри ещё не существующего каталога при этом законно и обычно — так
            // создаётся ЛЮБОЙ новый модуль (форма по шаблону, вывод кодогена). Без этого
            // хода такая запись живёт только в рабочей копии: операция сообщает об успехе,
            // на диске не появляется ничего, и «файл есть, но его нет» человек обнаруживает
            // на перезагрузке страницы.
            //
            // Только для записи без BASE: у файла, который уже был в источнике, каталог
            // заведомо есть, и обращение к файловой системе на каждое сохранение — плата
            // ни за что.
            if (!entry.hasBase && source.mkdir !== undefined) {
              const dir = dirname(path);
              // Отказ создания не отменяет попытку записи: если каталог всё же есть,
              // писать можно, а если нет — об этом честнее скажет сама запись.
              if (dir !== '') await source.mkdir(dir).catch(() => undefined);
            }
            const written = await write.call(source, path, text, expected);
            // Новый BASE — ровно то, что ушло в источник: следующая правка меряется от него.
            await store.writeText('base', path, text);
            entry.revision = written.revision ?? entry.revision;
            entry.hasBase = true;
            entry.dirty = false;
            entry.size = byteLength(text);
            touch(entry);
            note(path, 'saved');
            opened.get(idOf(path))?.handle.setDirty(false);
            saved.push(idOf(path));
          } catch (err) {
            if (isSourceError(err, 'conflict')) {
              // BASE и `dirty` НЕ трогаем: на них держится трёхстороннее слияние, а тихо
              // выбранная сторона — это потеря работы, которую заметят через день.
              conflicts.push({
                id: idOf(path),
                expected,
                actual: conflictRevision(err),
              });
              continue;
            }
            if (isSourceError(err)) {
              failures.push({ id: idOf(path), kind: err.kind, message: err.message });
              continue;
            }
            // Не отказ источника — это ошибка в нас, и глотать её нельзя.
            throw err;
          }
        }

        await persist();
        return {
          ok: conflicts.length === 0 && failures.length === 0,
          saved,
          conflicts,
          failures,
        };
      });
    },

    revert(resource) {
      return batched(async () => {
        await ready();
        const path = pathOf(resource);
        const entry = materialized.get(path);
        if (entry === undefined) return;

        if (!entry.hasBase) {
          // Файла в источнике никогда не было: возвращать не к чему, откат — это исчезновение.
          await store.removePair(path);
          materialized.delete(path);
          dirtyStats.delete(path);
          droppedStats.add(path);
          opened.get(resource)?.handle.setText('');
          note(path, 'removed');
          await persist();
          return;
        }

        const base = await store.readText('base', path);
        if (base === null) {
          throw new Error(`BASE потерян, откат невозможен: ${path}`);
        }
        // Откат — такая же правка буфера, как набор текста, и в журнале он обязан быть:
        // без него воспроизведение потока дало бы текст, который человек только что отменил.
        // Пометки происхождения у `revert` нет и не нужно: откат к BASE заказывает человек,
        // а умолчание журнала — ровно `user`.
        const previous = await journalBase(path);
        await store.writeText('files', path, base);
        entry.size = byteLength(base);
        entry.dirty = false;
        touch(entry);
        note(path, 'written');

        const state = opened.get(resource);
        if (state !== undefined) {
          state.handle.setText(base);
          state.handle.setDirty(false);
        }
        await journalEdits(resource, diffText(previous ?? '', base));
        await persist();
      });
    },

    isDirty(resource) {
      if (resource === undefined) {
        for (const entry of materialized.values()) if (entry.dirty) return true;
        return false;
      }
      return materialized.get(pathOf(resource))?.dirty ?? false;
    },

    onDidChange(cb) {
      return bus.on(WorkspaceDidChange, cb);
    },
  };
}
