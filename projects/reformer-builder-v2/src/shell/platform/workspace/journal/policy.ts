/**
 * Политика хранения журнала — чистые функции над указателем, без единого обращения к хранилищу.
 *
 * Четыре шага, и первый из них не про удаление:
 *
 * ```text
 * 0. опорные снимки   каждые ~200 записей или ~1 МБ патчей — полное содержимое ресурса
 * 1. схлопывание      соседние записи сливаются в одну
 * 2. возраст          записи старше ~30 дней — но не глубже ближайшего снимка
 * 3. объём            пока журнал больше ~32 МБ, уходят самые старые записи со снимками
 * ```
 *
 * **Инвариант, на котором держится всё остальное:** воспроизведение ведётся ОТ снимка,
 * поэтому удалять можно только то, после чего у каждого оставшегося в журнале ресурса
 * остаётся опорный снимок. Иначе в журнале останется хвост правок без основания — записи,
 * которые некуда применить.
 *
 * **Почему схлопывание идёт первым.** Оно не теряет содержимого — только промежуточные
 * нажатия, которые и так сжимаются почти в ничто. Удалять до него значит выбрасывать то,
 * что бесплатно уместилось бы.
 *
 * **Почему объём идёт последним.** Возраст — это предпочтение («история за месяц»), объём —
 * жёсткое ограничение хранилища. Жёсткое обязано стоять последним: после него ничего больше
 * не набегает, и потолок оказывается гарантией, а не пожеланием.
 *
 * ## Чего здесь нет и почему
 *
 * Схлопывание применяется на границе ЗАПИСИ (в хвост потока), а не проходом по журналу:
 * хранилище умеет удалять только префикс потока ({@link WorkspaceMetaStore.removeHistoryBefore}),
 * а слияние двух записей в середине потребовало бы удаления одной записи изнутри — то есть
 * перезаписи всего хвоста. Ничего при этом не теряется: схлопывать имеет смысл только соседние
 * по времени записи, а они все проходят через хвост. {@link collapse} остаётся чистой функцией
 * и проверяется отдельно от журнала — на ней же держится показ истории «шагами».
 *
 * @module host/workspace/journal/policy
 */

import type { ResourceId } from '@/shell/platform/primitives/resource';
import { composeTextEdits } from './compose';
import type { JournalIndexEntry, JournalRecord } from './record';

/** Пороги политики. Все — «порядок величины», а не точные числа: подбирать их нечем и незачем. */
export interface JournalPolicy {
  /** Окно схлопывания: за большей паузой человек видит два разных действия, а не одно. */
  readonly mergeWindowMs: number;
  /** Через сколько записей ресурса класть опорный снимок. */
  readonly snapshotEveryRecords: number;
  /** Через сколько байт патчей ресурса класть опорный снимок. */
  readonly snapshotEveryBytes: number;
  /** Возраст, после которого запись больше не нужна. */
  readonly maxAgeMs: number;
  /** Потолок журнала рабочей области. */
  readonly maxBytes: number;
}

/**
 * Умолчания.
 *
 * Потолок объёма — тот же, что у кэша схем в репозитории и у бюджета вытеснения
 * (`DEFAULT_EVICTION_BUDGET`): один порядок величины на одно хранилище, чтобы две политики
 * не тянули квоту в разные стороны.
 */
export const DEFAULT_JOURNAL_POLICY: JournalPolicy = Object.freeze({
  mergeWindowMs: 3_000,
  snapshotEveryRecords: 200,
  snapshotEveryBytes: 1024 * 1024,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
  maxBytes: 32 * 1024 * 1024,
});

/** Пороги с подставленными умолчаниями. */
export function journalPolicy(overrides?: Partial<JournalPolicy>): JournalPolicy {
  return overrides === undefined
    ? DEFAULT_JOURNAL_POLICY
    : { ...DEFAULT_JOURNAL_POLICY, ...overrides };
}

/**
 * Можно ли слить две соседние записи.
 *
 * Не сливаются НИКОГДА:
 *
 * - через границу `txId` — иначе ход ассистента перестанет быть одним шагом, и откатить его
 *   целиком станет нечем;
 * - при смене `origin` — правка человека и правка машины обязаны остаться различимыми,
 *   в этом половина ценности аудита;
 * - за пределами окна — иначе схлопнется то, что человек воспринимает как разные действия.
 *
 * Окно считается от ПАУЗЫ между записями, а не от начала первой: набор текста без остановки —
 * одно действие, сколько бы он ни длился, а вот пауза его заканчивает.
 *
 * Разные ресурсы не сливаются по определению: правка в другом файле — другое действие,
 * а `TextEdit` вообще имеет смысл только внутри одного текста.
 */
export function canMerge(
  previous: JournalRecord,
  next: JournalRecord,
  policy: JournalPolicy
): boolean {
  return (
    previous.resource === next.resource &&
    previous.origin === next.origin &&
    previous.txId === next.txId &&
    previous.payload.kind === next.payload.kind &&
    next.ts >= previous.ts &&
    next.ts - previous.ts <= policy.mergeWindowMs
  );
}

/**
 * Сливает две записи в одну.
 *
 * Место в потоке остаётся от первой (шаг начался там), время — от второй (шаг длился до неё,
 * и следующее окно схлопывания отсчитывается от последней правки).
 *
 * @throws если записи не сливаемы — проверять это обязан {@link canMerge}, а не вызывающий
 *   на глазок.
 */
export function mergeRecords(previous: JournalRecord, next: JournalRecord): JournalRecord {
  if (previous.payload.kind === 'text' && next.payload.kind === 'text') {
    return {
      ...previous,
      ts: next.ts,
      // Не склейка списков, а композиция: смещения второго пакета отсчитаны от текста ПОСЛЕ
      // первого, и список из двух пакетов подряд применился бы не туда.
      payload: {
        kind: 'text',
        edits: composeTextEdits(previous.payload.edits, next.payload.edits),
      },
    };
  }
  if (previous.payload.kind === 'model' && next.payload.kind === 'model') {
    // Операции над моделью самодостаточны и последовательны: пересчитывать в них нечего.
    return {
      ...previous,
      ts: next.ts,
      payload: { kind: 'model', ops: [...previous.payload.ops, ...next.payload.ops] },
    };
  }
  throw new Error('нельзя слить записи с разной начинкой: правку текста и операции над моделью');
}

/**
 * Схлопывает поток: соседние сливаемые записи становятся одной.
 *
 * Порядок — по `seq`: журнал один поток, и соседство определено в нём, а не внутри ресурса.
 */
export function collapse(
  records: readonly JournalRecord[],
  overrides?: Partial<JournalPolicy>
): readonly JournalRecord[] {
  const policy = journalPolicy(overrides);
  const result: JournalRecord[] = [];
  for (const record of [...records].sort((a, b) => a.seq - b.seq)) {
    const previous = result[result.length - 1];
    if (previous !== undefined && canMerge(previous, record, policy)) {
      result[result.length - 1] = mergeRecords(previous, record);
      continue;
    }
    result.push(record);
  }
  return result;
}

/** Итог проверки инварианта. */
export interface JournalIntegrity {
  readonly ok: boolean;
  /**
   * Ресурсы, у которых в журнале остались записи, а опорного снимка нет.
   *
   * Это и есть «хвост правок без основания»: применить их не к чему, и восстановить
   * состояние ресурса из журнала нельзя.
   */
  readonly unfounded: readonly ResourceId[];
}

/**
 * Держится ли инвариант опорного снимка.
 *
 * **Проверяемая форма инварианта.** Дословно контракт говорит «в журнале всегда есть опорный
 * снимок не позже самой старой сохранённой записи». В потоке, где `seq` монотонен по рабочей
 * области, а удаление вырезает только ПРЕФИКС потока, дословная форма недостижима: одна
 * граница удаления не может совпасть со снимком сразу всех ресурсов. Достижимая и равносильная
 * по смыслу форма — та, ради которой инвариант и вводился: **у каждого ресурса, оставшегося
 * в журнале, есть опорный снимок, и всё, что новее его, сохранено целиком.** Вторая половина
 * выполняется устройством удаления (вырезается префикс, значит хвост цел), поэтому проверять
 * остаётся первую.
 */
export function checkSnapshotInvariant(index: readonly JournalIndexEntry[]): JournalIntegrity {
  const withEntries = new Set<ResourceId>();
  const withSnapshot = new Set<ResourceId>();
  for (const entry of index) {
    if (entry.kind === 'snapshot') withSnapshot.add(entry.resource);
    else withEntries.add(entry.resource);
  }
  const unfounded = [...withEntries].filter((resource) => !withSnapshot.has(resource));
  return { ok: unfounded.length === 0, unfounded };
}

/** Что политика решила сделать с журналом. */
export interface CompactionPlan {
  /** Удаляются записи с `seq` меньше этой границы. `0` — удалять нечего. */
  readonly cutSeq: number;
  /** Сколько записей уйдёт. */
  readonly removed: number;
  /** Сколько байт останется. */
  readonly keptBytes: number;
  /**
   * Ресурсы, которым нужен свежий опорный снимок.
   *
   * Две причины, и обе — шаг 0 политики в действии: снимок кладётся ДО удаления, потому что
   * именно он делает удаление допустимым. Ресурс попадает сюда, если снимок держит границу
   * (иначе резать нечего — она упирается в самую старую его запись) или если снимка у него
   * нет вовсе, то есть инвариант уже нарушен и без всякого удаления.
   */
  readonly needSnapshot: readonly ResourceId[];
  /**
   * Потолок превышен, но резать глубже нельзя без потери воспроизведения.
   *
   * Законное состояние, а не ошибка — как и `retainedOverBudget` у вытеснения: инвариант
   * сильнее потолка. Вызывающему это нужно, чтобы сказать вслух, а не чтобы чинить молча.
   */
  readonly retainedOverBudget: boolean;
}

/** Пустой план: журнал пуст или трогать нечего. */
const NOTHING_TO_DO: CompactionPlan = Object.freeze({
  cutSeq: 0,
  removed: 0,
  keptBytes: 0,
  needSnapshot: [],
  retainedOverBudget: false,
});

export interface CompactionOptions {
  readonly now: number;
  readonly policy?: Partial<JournalPolicy>;
}

/**
 * Граница удаления по шагам 2 и 3, прижатая шагом 0.
 *
 * Порядок именно такой: сначала возраст (предпочтение), затем объём (жёсткое ограничение),
 * и только потом предохранитель по снимкам. Предохранитель последний, потому что он умеет
 * лишь поднимать границу назад — считать по нему возраст и объём означало бы считать их
 * дважды.
 */
export function planCompaction(
  index: readonly JournalIndexEntry[],
  options: CompactionOptions
): CompactionPlan {
  const entries = [...index].sort((a, b) => a.seq - b.seq);
  if (entries.length === 0) return NOTHING_TO_DO;
  const policy = journalPolicy(options.policy);

  // Шаг 2: возраст.
  const ageLimit = options.now - policy.maxAgeMs;
  let cut = 0;
  while (cut < entries.length && entries[cut].ts < ageLimit) cut += 1;

  // Шаг 3: объём. Потолок жёсткий, поэтому идёт после возраста — что бы ни оставил возраст,
  // объём доводит журнал до потолка.
  let keptBytes = 0;
  for (let i = cut; i < entries.length; i += 1) keptBytes += entries[i].bytes;
  while (cut < entries.length && keptBytes > policy.maxBytes) {
    keptBytes -= entries[cut].bytes;
    cut += 1;
  }

  const last = entries[entries.length - 1];
  const desired = cut >= entries.length ? last.seq + 1 : entries[cut].seq;

  // Шаг 0: предохранитель. Граница не смеет уйти глубже опорного снимка ресурса — если,
  // конечно, ресурс не уходит из журнала целиком: тогда воспроизводить нечего, и хвоста
  // без основания не остаётся.
  const newestSnapshot = new Map<ResourceId, number>();
  const newestRecord = new Map<ResourceId, number>();
  const oldestRecord = new Map<ResourceId, number>();
  for (const entry of entries) {
    newestRecord.set(entry.resource, entry.seq);
    if (!oldestRecord.has(entry.resource)) oldestRecord.set(entry.resource, entry.seq);
    if (entry.kind === 'snapshot') newestSnapshot.set(entry.resource, entry.seq);
  }

  const needSnapshot: ResourceId[] = [];
  let cutSeq = desired;
  for (const [resource, newest] of newestRecord) {
    if (desired > newest) continue;
    const snapshot = newestSnapshot.get(resource);
    const limit = snapshot ?? oldestRecord.get(resource) ?? 0;
    if (limit >= desired) continue;
    // Свежий снимок этого ресурса снял бы ограничение целиком: всё, что старше снимка,
    // становится удаляемым.
    needSnapshot.push(resource);
    cutSeq = Math.min(cutSeq, limit);
  }

  let removed = 0;
  let bytes = 0;
  const kept: JournalIndexEntry[] = [];
  for (const entry of entries) {
    if (entry.seq < cutSeq) {
      removed += 1;
      continue;
    }
    bytes += entry.bytes;
    kept.push(entry);
  }

  // Ресурс мог остаться без снимка и не из-за границы — например, снимок не удалось положить
  // при первой же записи. Инвариант от этого не перестаёт быть нарушенным, и план обязан
  // просить снимок, а не молчать.
  for (const resource of checkSnapshotInvariant(kept).unfounded) {
    if (!needSnapshot.includes(resource)) needSnapshot.push(resource);
  }

  return {
    cutSeq: removed === 0 ? 0 : cutSeq,
    removed,
    keptBytes: bytes,
    needSnapshot,
    retainedOverBudget: bytes > policy.maxBytes,
  };
}
