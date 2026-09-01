/**
 * Конверт журнала: одна запись на текстовую правку и на операцию над моделью.
 *
 * **Почему конверт один.** Потребитель истории или аудита читает ОДИН поток, а не два: иначе
 * «покажи, что изменилось» пришлось бы собирать из двух источников с разными правилами
 * упорядочивания, и первый же вопрос «что было раньше — правка текста или ход ассистента?»
 * остался бы без ответа. Начинка при этом разная, и это нормально: общее у записей — время,
 * происхождение и место в потоке, а не форма правки.
 *
 * **`seq` монотонен по РАБОЧЕЙ ОБЛАСТИ, а не по ресурсу.** Это прямое следствие «журнал —
 * один поток»: старшинство обязано быть определено между записями о разных файлах. Отсюда же
 * форма ключа хранилища (`[workspaceId, resourceId, seq]`) и вся арифметика удаления —
 * граница удаления это ОДИН `seq` на всю область, а не по одному на ресурс.
 *
 * **Смещения — в кодовых единицах UTF-16.** Названо здесь ещё раз намеренно (то же написано
 * у {@link TextEdit}): потребитель, решивший, что это байты или кодовые точки, сломается
 * на первом же эмодзи — суррогатная пара занимает две единицы, и правка после неё стоит
 * не там, где её ждёт наивный счёт по символам.
 *
 * @module host/workspace/journal/record
 */

import type { ResourceId } from '../../primitives/resource';
import type { TextEdit } from '../model/history';
import type { EditOp } from '../model/provider';
import type { HistoryEntryRecord, HistoryRecord, HistorySnapshotRecord } from '../storage/idb';

/**
 * Кто породил правку.
 *
 * Различие несущее: половина ценности аудита в том, что правку человека и правку машины
 * видно порознь. Поэтому же записи с разным происхождением никогда не схлопываются.
 */
export type JournalOrigin = 'user' | 'agent' | 'external';

/** Начинка записи: правка текста или операции над моделью. */
export type JournalPayload =
  | { readonly kind: 'text'; readonly edits: readonly TextEdit[] }
  | { readonly kind: 'model'; readonly ops: readonly EditOp[] };

/** Запись журнала. */
export interface JournalRecord {
  /** Место в потоке. Монотонен в пределах рабочей области. */
  readonly seq: number;
  readonly resource: ResourceId;
  /** Время последней правки, вошедшей в запись: схлопывание сдвигает его вперёд. */
  readonly ts: number;
  readonly origin: JournalOrigin;
  /** Логический шаг: ход ассистента или мультикурсорная правка — одна запись. */
  readonly txId?: string;
  readonly payload: JournalPayload;
}

/** Содержимое опорного снимка. Текст — строкой, всё остальное — байтами. */
export type JournalContent = string | Uint8Array;

/**
 * Опорный снимок: точка, ОТ которой журнал проигрывается вперёд.
 *
 * Лежит в том же потоке и в том же порядке, что и записи: снимок с `seq` = S означает
 * «состояние ресурса после всего, что было до S», и воспроизведение — это снимок плюс
 * записи того же ресурса с `seq` больше S.
 */
export interface JournalSnapshot {
  readonly seq: number;
  readonly resource: ResourceId;
  readonly ts: number;
  readonly content: JournalContent;
}

/**
 * Строка указателя: всё, что нужно политике хранения, и ничего из содержимого.
 *
 * Политика считает возраст, объём и наличие снимков — для этого тела записей не нужны,
 * а указатель на журнал в 32 МБ занимает единицы сотен килобайт и живёт в памяти.
 */
export interface JournalIndexEntry {
  readonly seq: number;
  readonly resource: ResourceId;
  readonly ts: number;
  /** Оценка объёма записи. По ней считается потолок журнала. */
  readonly bytes: number;
  readonly kind: 'entry' | 'snapshot';
}

/** Байт на кодовую единицу UTF-16 — множитель оценки объёма. */
const BYTES_PER_UNIT = 2;

/**
 * Накладные расходы на запись: ключ, время, происхождение, обёртки формата.
 *
 * Оценка, а не измерение: точный размер записи знает только движок хранилища, а нужна она
 * для порога в десятки мегабайт — там ошибка в полсотни байт на запись ничего не решает.
 * Важнее, чтобы оценка была ДЕТЕРМИНИРОВАННОЙ: политика, считающая объём по-разному
 * до и после перезагрузки, вела бы себя необъяснимо.
 */
const RECORD_OVERHEAD_BYTES = 64;

/** Оценка объёма начинки. */
export function payloadBytes(payload: JournalPayload): number {
  if (payload.kind === 'text') {
    let units = 0;
    for (const edit of payload.edits) units += edit.removed.length + edit.inserted.length;
    return RECORD_OVERHEAD_BYTES + units * BYTES_PER_UNIT;
  }
  let units = 0;
  for (const op of payload.ops) {
    // Операции — данные (это записано контрактом `EditOp`), но `params` приходят снаружи,
    // и циклическая ссылка в них уронила бы подсчёт объёма. Отказ сериализации — не авария:
    // оценка деградирует до фиксированной, а запись всё равно уходит в журнал.
    try {
      units += JSON.stringify(op)?.length ?? 0;
    } catch {
      units += RECORD_OVERHEAD_BYTES;
    }
  }
  return RECORD_OVERHEAD_BYTES + units * BYTES_PER_UNIT;
}

/** Оценка объёма снимка. */
export function contentBytes(content: JournalContent): number {
  return (
    RECORD_OVERHEAD_BYTES +
    (typeof content === 'string' ? content.length * BYTES_PER_UNIT : content.byteLength)
  );
}

/** Запись журнала в форме хранилища. */
export function toStoredEntry(workspaceId: string, record: JournalRecord): HistoryEntryRecord {
  return {
    kind: 'entry',
    workspaceId,
    resourceId: record.resource,
    seq: record.seq,
    ts: record.ts,
    bytes: payloadBytes(record.payload),
    origin: record.origin,
    ...(record.txId === undefined ? {} : { txId: record.txId }),
    payload: record.payload,
  };
}

/** Снимок в форме хранилища. */
export function toStoredSnapshot(
  workspaceId: string,
  snapshot: JournalSnapshot
): HistorySnapshotRecord {
  return {
    kind: 'snapshot',
    workspaceId,
    resourceId: snapshot.resource,
    seq: snapshot.seq,
    ts: snapshot.ts,
    bytes: contentBytes(snapshot.content),
    content: snapshot.content,
  };
}

/**
 * Запись хранилища обратно в конверт журнала.
 *
 * Операции над моделью хранятся как `unknown[]`: их словарь принадлежит предметному слою,
 * а Host его не знает — это граница слоя, а не лень. Приведение локализовано здесь, ровно
 * в одном месте, чтобы не расползлось по потребителям.
 */
export function fromStoredEntry(record: HistoryEntryRecord): JournalRecord {
  const payload: JournalPayload =
    record.payload.kind === 'text'
      ? { kind: 'text', edits: record.payload.edits }
      : { kind: 'model', ops: record.payload.ops as readonly EditOp[] };
  return {
    seq: record.seq,
    resource: record.resourceId,
    ts: record.ts,
    origin: record.origin,
    ...(record.txId === undefined ? {} : { txId: record.txId }),
    payload,
  };
}

/** Снимок хранилища обратно в конверт журнала. */
export function fromStoredSnapshot(record: HistorySnapshotRecord): JournalSnapshot {
  return {
    seq: record.seq,
    resource: record.resourceId,
    ts: record.ts,
    content: record.content,
  };
}

/** Указатель по записям хранилища, в порядке потока. */
export function indexOf(records: readonly HistoryRecord[]): readonly JournalIndexEntry[] {
  return records
    .map((record) => ({
      seq: record.seq,
      resource: record.resourceId,
      ts: record.ts,
      bytes: record.bytes,
      kind: record.kind,
    }))
    .sort((a, b) => a.seq - b.seq);
}
