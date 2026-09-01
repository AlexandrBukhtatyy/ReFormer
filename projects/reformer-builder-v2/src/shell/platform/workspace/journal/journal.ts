/**
 * Журнал изменений рабочей области — владелец потока записей и политики его хранения.
 *
 * ```text
 *   record()   →  схлопывание в хвост  →  запись в history  →  опорный снимок по расписанию
 *                                                            →  уборка, когда журнал перерос потолок
 *   restore()  ←  снимок + проигрывание записей после него
 * ```
 *
 * **Журнал и отмена — разные вещи.** Отмена живёт в памяти документа (`model/history.ts`):
 * стек, переживать перезагрузку не обязан, отвечает на Ctrl+Z. Журнал — append-only поток
 * в IndexedDB: он отвечает на «что изменилось», «кто это сделал» и «восстанови после
 * перезагрузки». Общий у них формат правки, но не механика и не время жизни.
 *
 * ## Схлопывание — на границе записи
 *
 * Соседняя правка не добавляет запись, а ПЕРЕПИСЫВАЕТ хвостовую по тому же ключу
 * (`[workspaceId, resourceId, seq]` — `put` перезаписывает). Отсюда два следствия:
 *
 * - ничего не теряется при перезагрузке: запись уходит в хранилище сразу, а не ждёт конца
 *   окна схлопывания в памяти;
 * - схлопывать можно только хвост потока, и это ровно то, что нужно: соседство по времени
 *   и соседство в потоке — одно и то же.
 *
 * **Опорный снимок обрывает схлопывание.** Снимок описывает состояние после всего, что было
 * до него; дописать правку в запись, оставшуюся ПЕРЕД снимком, значит сделать снимок неверным.
 * Поэтому после снимка хвост считается закрытым.
 *
 * ## Инвариант опорного снимка
 *
 * Удаление вырезает префикс потока, поэтому граница — один `seq` на всю область. Она никогда
 * не уходит глубже, чем позволяет самый требовательный ресурс: у каждого, кто остаётся
 * в журнале, обязан остаться опорный снимок. Если снимка нет, а резать надо, снимок сначала
 * КЛАДЁТСЯ (шаг 0 политики) и только потом режется. Ресурс, уходящий из журнала целиком,
 * ничего не требует: хвоста без основания после него не остаётся.
 *
 * @module host/workspace/journal/journal
 */

import type { ResourceId } from '../../primitives/resource';
import { applyTextEdits, invertTextEdits } from '../model/history';
import type { EditOp } from '../model/provider';
import type { HistorySnapshotRecord, QuotaPressure, WorkspaceMetaStore } from '../storage/idb';
import {
  canMerge,
  journalPolicy,
  mergeRecords,
  planCompaction,
  type CompactionPlan,
  type JournalPolicy,
} from './policy';
import {
  contentBytes,
  fromStoredEntry,
  fromStoredSnapshot,
  indexOf,
  payloadBytes,
  toStoredEntry,
  toStoredSnapshot,
  type JournalContent,
  type JournalIndexEntry,
  type JournalOrigin,
  type JournalPayload,
  type JournalRecord,
  type JournalSnapshot,
} from './record';

/**
 * Та часть хранилища метаданных, которая нужна журналу.
 *
 * Сужение через `Pick`, а не свой интерфейс: список методов обязан оставаться подмножеством
 * настоящего хранилища, иначе он разъедется с ним при первой же правке — и разъезд обнаружится
 * не компилятором, а в рантайме.
 */
export type JournalStore = Pick<
  WorkspaceMetaStore,
  'appendHistory' | 'listHistory' | 'listWorkspaceHistory' | 'removeHistoryBefore'
>;

/**
 * Откуда журнал берёт содержимое для опорного снимка.
 *
 * Возвращает состояние ресурса НА СЕЙЧАС — снимок кладётся в хвост потока и описывает
 * состояние после всех предыдущих записей. `undefined` — содержимого нет (ресурс закрыт,
 * вытеснен, недоступен): снимок откладывается до следующего раза, а не выдумывается.
 */
export type JournalContentProvider = (
  resource: ResourceId
) => Promise<JournalContent | undefined> | JournalContent | undefined;

export interface JournalOptions {
  readonly store: JournalStore;
  readonly workspaceId: string;
  readonly content?: JournalContentProvider;
  readonly now?: () => number;
  readonly policy?: Partial<JournalPolicy>;
}

/** Что записывает вызывающий. `seq` и место в потоке выдаёт журнал. */
export interface JournalInput {
  readonly resource: ResourceId;
  readonly origin: JournalOrigin;
  /** Логический шаг: ход ассистента или мультикурсорная правка — одна запись. */
  readonly txId?: string;
  readonly payload: JournalPayload;
  /** Время правки; по умолчанию — часы журнала. */
  readonly ts?: number;
}

export interface RestoreOptions {
  /** Восстановить состояние на этот момент потока включительно. По умолчанию — на конец. */
  readonly through?: number;
  /**
   * Как применять операции над моделью.
   *
   * Host не знает их словаря — он принадлежит провайдеру модели (`lib/form-model` через
   * плагин). Поэтому проигрывание модельных записей требует applier'а от вызывающего;
   * без него журнал отказывает, а не делает вид, что восстановил.
   */
  readonly applyOps?: (content: string, ops: readonly EditOp[]) => string;
}

export interface CompactOptions {
  /**
   * Место уже кончилось: убирать надо не «до потолка», а с запасом.
   *
   * Причина в том, как хранилище обрабатывает квоту: повтор записи РОВНО один, и уборка,
   * освободившая ровно столько, чтобы влезла текущая запись, отправит следующую в тот же
   * отказ. Поэтому под давлением потолок временно вдвое ниже.
   */
  readonly urgent?: boolean;
}

export interface CompactionResult extends CompactionPlan {
  /** Ресурсы, которым перед удалением положили свежий опорный снимок (шаг 0 политики). */
  readonly snapshots: readonly ResourceId[];
}

export interface Journal {
  readonly workspaceId: string;
  /** Записывает правку. Схлопывает её в хвост, если сливать можно. */
  record(input: JournalInput): Promise<JournalRecord>;
  /** Кладёт опорный снимок вне расписания. `undefined` — содержимого не дали. */
  snapshot(resource: ResourceId): Promise<JournalSnapshot | undefined>;
  /** Записи одного ресурса в порядке потока; снимки не входят. */
  list(resource: ResourceId): Promise<readonly JournalRecord[]>;
  /** Указатель всей области — то, над чем работает политика. */
  index(): Promise<readonly JournalIndexEntry[]>;
  /** Восстановление: ближайший снимок плюс проигрывание записей после него. */
  restore(resource: ResourceId, options?: RestoreOptions): Promise<JournalContent | undefined>;
  /** Откат логического шага целиком: обратные правки всех записей хода, с конца. */
  undoTransaction(resource: ResourceId, txId: string, text: string): Promise<string>;
  /** Прогон политики хранения: снимки, затем возраст, затем объём. */
  compact(options?: CompactOptions): Promise<CompactionResult>;
  /** Обработчик давления на квоту — то, что передаётся в `onQuotaPressure` хранилища. */
  relieve(pressure: QuotaPressure): Promise<void>;
}

/** Во сколько раз ниже потолок под давлением квоты. */
const URGENT_DIVISOR = 2;

/** Через сколько новых записей повторять уборку, которая ничего не смогла сделать. */
const IDLE_RETRY_RECORDS = 50;

/** Пустой итог: уборка уже идёт или трогать нечего. */
const NO_COMPACTION: CompactionResult = Object.freeze({
  cutSeq: 0,
  removed: 0,
  keptBytes: 0,
  needSnapshot: [],
  retainedOverBudget: false,
  snapshots: [],
});

/** Счётчик «сколько накопилось с последнего снимка» — по нему срабатывает расписание снимков. */
interface SinceSnapshot {
  records: number;
  bytes: number;
}

export function createJournal(options: JournalOptions): Journal {
  const { store, workspaceId } = options;
  const now = options.now ?? (() => Date.now());
  const policy = journalPolicy(options.policy);

  /** Указатель всего журнала области, по возрастанию `seq`. Содержимого в нём нет. */
  const entries: JournalIndexEntry[] = [];
  const hasSnapshot = new Set<ResourceId>();
  const sinceSnapshot = new Map<ResourceId, SinceSnapshot>();
  let totalBytes = 0;
  let nextSeq = 1;
  /** Хвост потока — единственная запись, в которую можно схлопнуть следующую. */
  let tail: JournalRecord | null = null;
  let loaded: Promise<void> | null = null;
  let compacting = false;
  /** Сколько записей должно накопиться, прежде чем повторять бесплодную уборку. */
  let retryAfterRecords = 0;

  const counterOf = (resource: ResourceId): SinceSnapshot => {
    const existing = sinceSnapshot.get(resource);
    if (existing !== undefined) return existing;
    const created: SinceSnapshot = { records: 0, bytes: 0 };
    sinceSnapshot.set(resource, created);
    return created;
  };

  /** Пересчёт производного состояния по указателю: после загрузки и после удаления. */
  const rebuildState = (): void => {
    hasSnapshot.clear();
    sinceSnapshot.clear();
    totalBytes = 0;
    for (const entry of entries) {
      totalBytes += entry.bytes;
      if (entry.kind === 'snapshot') {
        hasSnapshot.add(entry.resource);
        sinceSnapshot.set(entry.resource, { records: 0, bytes: 0 });
        continue;
      }
      const counter = counterOf(entry.resource);
      counter.records += 1;
      counter.bytes += entry.bytes;
    }
  };

  const load = async (): Promise<void> => {
    const stored = await store.listWorkspaceHistory(workspaceId);
    entries.length = 0;
    entries.push(...indexOf(stored));
    nextSeq = (entries[entries.length - 1]?.seq ?? 0) + 1;
    rebuildState();
    // Хвост восстанавливаем, чтобы схлопывание работало и после перезагрузки — но только
    // если после него не легло снимка: снимок закрывает хвост (см. шапку модуля).
    const last = entries[entries.length - 1];
    const lastStored =
      last?.kind === 'entry' ? stored.find((record) => record.seq === last.seq) : undefined;
    tail = lastStored?.kind === 'entry' ? fromStoredEntry(lastStored) : null;
  };

  const ensureLoaded = (): Promise<void> => {
    if (loaded === null) {
      loaded = load().catch((err: unknown) => {
        // Неудачу не кэшируем: следующая операция обязана попробовать снова, иначе журнал
        // умрёт навсегда из-за одного отказа хранилища.
        loaded = null;
        throw err;
      });
    }
    return loaded;
  };

  /*
   * Очередь на запись.
   *
   * `seq` выдаётся по одному, и две записи, ушедшие в хранилище параллельно, могли бы
   * поменяться местами в потоке. Уборка через очередь НЕ идёт намеренно: она вызывается
   * из обработчика квоты, то есть изнутри незавершённой записи, и ожидание очереди
   * стало бы взаимной блокировкой.
   */
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  const resolveContent = async (resource: ResourceId): Promise<JournalContent | undefined> => {
    if (options.content === undefined) return undefined;
    return options.content(resource);
  };

  const writeSnapshot = async (resource: ResourceId): Promise<JournalSnapshot | undefined> => {
    const content = await resolveContent(resource);
    if (content === undefined) return undefined;
    const snapshot: JournalSnapshot = { seq: nextSeq, resource, ts: now(), content };
    nextSeq += 1;
    await store.appendHistory(toStoredSnapshot(workspaceId, snapshot));
    const bytes = contentBytes(content);
    entries.push({ seq: snapshot.seq, resource, ts: snapshot.ts, bytes, kind: 'snapshot' });
    totalBytes += bytes;
    hasSnapshot.add(resource);
    sinceSnapshot.set(resource, { records: 0, bytes: 0 });
    // Снимок описывает состояние после всего, что было до него: дописать правку в запись
    // ПЕРЕД снимком значит сделать снимок неверным.
    if (tail !== null && tail.resource === resource) tail = null;
    return snapshot;
  };

  /** Пора ли класть опорный снимок. Первый — сразу: без него ресурс невоспроизводим. */
  const snapshotDue = (resource: ResourceId): boolean => {
    if (!hasSnapshot.has(resource)) return true;
    const counter = counterOf(resource);
    return (
      counter.records >= policy.snapshotEveryRecords || counter.bytes >= policy.snapshotEveryBytes
    );
  };

  const dropBelow = (cutSeq: number): void => {
    const kept = entries.filter((entry) => entry.seq >= cutSeq);
    entries.length = 0;
    entries.push(...kept);
    rebuildState();
    if (tail !== null && tail.seq < cutSeq) tail = null;
  };

  const runCompaction = async (urgent: boolean): Promise<CompactionResult> => {
    // Уборка перезапускает запись в хранилище, а та умеет позвать уборку снова: без сторожа
    // это была бы рекурсия по отказу квоты.
    if (compacting) return NO_COMPACTION;
    compacting = true;
    try {
      await ensureLoaded();
      const limits: Partial<JournalPolicy> = urgent
        ? { ...policy, maxBytes: Math.floor(policy.maxBytes / URGENT_DIVISOR) }
        : policy;

      let plan = planCompaction(entries, { now: now(), policy: limits });
      const snapshots: ResourceId[] = [];
      // Шаг 0 идёт ДО удаления: снимок — это то, что делает удаление допустимым.
      for (const resource of plan.needSnapshot) {
        const snapshot = await writeSnapshot(resource);
        if (snapshot !== undefined) snapshots.push(resource);
      }
      if (snapshots.length > 0) plan = planCompaction(entries, { now: now(), policy: limits });

      if (plan.cutSeq > 0) {
        await store.removeHistoryBefore(workspaceId, plan.cutSeq);
        dropBelow(plan.cutSeq);
      }
      return { ...plan, snapshots };
    } finally {
      compacting = false;
    }
  };

  /** Дешёвая проверка «не пора ли убраться» — на каждой записи план строить незачем. */
  const compactIfNeeded = async (): Promise<void> => {
    // Уборка бывает бесплодной законно: содержимого для снимка не дали, а без снимка резать
    // нельзя. Повторять её на каждое нажатие незачем — план строится по всему указателю.
    if (entries.length < retryAfterRecords) return;
    const oldest = entries[0];
    const stale = oldest !== undefined && now() - oldest.ts > policy.maxAgeMs;
    if (totalBytes <= policy.maxBytes && !stale) return;
    const result = await runCompaction(false);
    const fruitless = result.removed === 0 && result.snapshots.length === 0;
    retryAfterRecords = fruitless ? entries.length + IDLE_RETRY_RECORDS : 0;
  };

  const listStored = (resource: ResourceId) => store.listHistory(workspaceId, resource);

  /**
   * Снимок в текст.
   *
   * Записи журнала — правки ТЕКСТА, и если они есть, ресурс текстовый: снимок, сохранённый
   * байтами (пришёл из источника как есть), декодируется, а не отвергается.
   */
  const asText = (content: JournalContent): string =>
    typeof content === 'string' ? content : new TextDecoder().decode(content);

  return {
    workspaceId,

    record(input) {
      return serial(async () => {
        await ensureLoaded();
        const ts = input.ts ?? now();
        const candidate: JournalRecord = {
          seq: nextSeq,
          resource: input.resource,
          ts,
          origin: input.origin,
          ...(input.txId === undefined ? {} : { txId: input.txId }),
          payload: input.payload,
        };

        let result: JournalRecord;
        if (tail !== null && canMerge(tail, candidate, policy)) {
          result = mergeRecords(tail, candidate);
          // Тот же ключ — `put` перезаписывает запись, а не добавляет вторую.
          await store.appendHistory(toStoredEntry(workspaceId, result));
          const bytes = payloadBytes(result.payload);
          // Схлопывать можно только хвост потока (снимок хвост закрывает), поэтому искать
          // строку указателя не нужно — она последняя.
          const at = entries.length - 1;
          const previous = entries[at];
          if (previous !== undefined && previous.seq === result.seq) {
            const counter = counterOf(result.resource);
            counter.bytes += bytes - previous.bytes;
            totalBytes += bytes - previous.bytes;
            entries[at] = { ...previous, ts: result.ts, bytes };
          }
        } else {
          result = candidate;
          nextSeq += 1;
          await store.appendHistory(toStoredEntry(workspaceId, result));
          const bytes = payloadBytes(result.payload);
          entries.push({
            seq: result.seq,
            resource: result.resource,
            ts: result.ts,
            bytes,
            kind: 'entry',
          });
          totalBytes += bytes;
          const counter = counterOf(result.resource);
          counter.records += 1;
          counter.bytes += bytes;
        }

        tail = result;
        if (snapshotDue(result.resource)) await writeSnapshot(result.resource);
        await compactIfNeeded();
        return result;
      });
    },

    snapshot(resource) {
      return serial(async () => {
        await ensureLoaded();
        return writeSnapshot(resource);
      });
    },

    async list(resource) {
      const stored = await listStored(resource);
      return stored
        .filter((record) => record.kind === 'entry')
        .map((record) => fromStoredEntry(record));
    },

    async index() {
      await ensureLoaded();
      return entries.map((entry) => ({ ...entry }));
    },

    async restore(resource, restoreOptions) {
      const stored = await listStored(resource);
      const through = restoreOptions?.through ?? Number.POSITIVE_INFINITY;

      let base: HistorySnapshotRecord | undefined;
      for (const record of stored) {
        if (record.kind === 'snapshot' && record.seq <= through) base = record;
      }
      // Без снимка воспроизводить не от чего — ровно то состояние, которое политика
      // обязана не допускать.
      if (base === undefined) return undefined;

      let content: JournalContent = fromStoredSnapshot(base).content;
      for (const record of stored) {
        if (record.kind !== 'entry' || record.seq <= base.seq || record.seq > through) continue;
        const entry = fromStoredEntry(record);
        if (entry.payload.kind === 'text') {
          content = applyTextEdits(asText(content), entry.payload.edits);
          continue;
        }
        if (restoreOptions?.applyOps === undefined) {
          throw new Error(
            'проигрывание операций над моделью требует applyOps: словарь операций знает ' +
              'провайдер модели, а не Host'
          );
        }
        content = restoreOptions.applyOps(asText(content), entry.payload.ops);
      }
      return content;
    },

    async undoTransaction(resource, txId, text) {
      const stored = await listStored(resource);
      const step = stored
        .filter((record) => record.kind === 'entry')
        .filter((record) => record.txId === txId)
        .map((record) => fromStoredEntry(record))
        .sort((a, b) => b.seq - a.seq);

      let result = text;
      for (const record of step) {
        if (record.payload.kind !== 'text') {
          throw new Error('откат операций над моделью делается провайдером, а не журналом');
        }
        // Обратные правки идут с конца хода: каждая применима к тексту ПОСЛЕ своей прямой.
        // Если поверх хода уже легли другие правки, `applyTextEdits` не найдёт основания
        // и откажет — это лучше, чем правдоподобно испорченный текст.
        result = applyTextEdits(result, invertTextEdits(record.payload.edits));
      }
      return result;
    },

    compact(compactOptions) {
      return runCompaction(compactOptions?.urgent === true);
    },

    async relieve(pressure) {
      // Хранилище одно на все области, а журнал — на одну: чужое давление не наше дело.
      if (pressure.workspaceId !== undefined && pressure.workspaceId !== workspaceId) return;
      try {
        await runCompaction(pressure.urgent);
      } catch {
        // Отказ уборки не должен подменять собой отказ записи: вызывающий ждёт ошибку
        // про квоту, а не про журнал.
      }
    },
  };
}

/**
 * Освобождение места для `onQuotaPressure` — политика журнала вместо грубого умолчания.
 *
 * Умолчание хранилища выбрасывает самые старые записи журнала, не глядя на снимки, и потому
 * нарушает инвариант: после него у ресурса может остаться хвост правок без основания.
 * Здесь вместо этого прогоняется полная политика: сначала снимки, потом возраст, потом объём.
 *
 * **Почему через `lookup`, а не журналом напрямую.** Хранилище создаётся раньше журналов
 * (журналу оно и нужно), поэтому передать готовый журнал в его настройки нельзя — это яйцо
 * и курица. Отложенный поиск разрывает цикл и заодно обслуживает несколько рабочих областей
 * над одним хранилищем.
 *
 * ```ts
 * const journals = new Map<string, Journal>();
 * const meta = createWorkspaceMetaStore({ onQuotaPressure: createJournalRelief((id) => journals.get(id)) });
 * journals.set(workspaceId, createJournal({ store: meta, workspaceId, content }));
 * ```
 */
export function createJournalRelief(
  lookup: (workspaceId: string) => Journal | undefined
): (pressure: QuotaPressure) => Promise<void> {
  return async (pressure) => {
    // Область неизвестна — значит, отказала операция, не привязанная к журналу; чей журнал
    // резать, наугад не выбирают.
    if (pressure.workspaceId === undefined) return;
    const journal = lookup(pressure.workspaceId);
    if (journal === undefined) return;
    await journal.relieve(pressure);
  };
}
