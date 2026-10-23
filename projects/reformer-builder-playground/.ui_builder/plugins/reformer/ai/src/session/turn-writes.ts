/**
 * Дверь записи хода для инструментов плагинов — то, что делает их запись частью хода.
 *
 * Запись идёт тем же портом файлов, что у хода режима файлов, и с той же пометкой
 * `{ origin: 'agent', txId }`: в журнале рабочей области она — правка ассистента в этом ходе.
 * Здесь же запоминается, чем файл был до хода: из этого мост собирает отмену хода, и запись
 * плагина откатывается вместе с правками самой модели.
 *
 * ## Чего дверь не пропускает
 *
 * - **Только читающему инструменту** — запись: объявленное «только читаю» должно быть правдой.
 * - **Документ формы и его шаги** — их ход правит своим механизмом (набором изменений или гейтом
 *   записи режима файлов), и вторая дверь к ним разошлась бы с первой.
 * - **После конца хода** — запись утёкшего промиса принадлежала бы ходу, который уже закрыт.
 *
 * Отказ — значение, а не исключение: инструмент решает, что сказать модели.
 *
 * @module plugins/reformer/ai/session/turn-writes
 */

import type { ResourceId, FormTurnWriteResult } from '@reformer/builder-plugin-api';
import type { AiFiles, WriteMark } from '../host';
import type { FileJournal } from '@reformer/builder-toolkit';
import { changedLines } from '@reformer/builder-toolkit';

/** Файл, записанный дверью мимо журнала модуля: чем был и чем стал. */
export interface WrittenFile {
  /** Текст до первой записи хода; `null` — файл ход создал. */
  readonly before: string | null;
  readonly after: string;
}

export interface TurnWritesOptions {
  /** Порт файлов; без него писать некуда — отказ `unavailable`. */
  readonly files: AiFiles | undefined;
  /** Пометка записей хода. */
  readonly mark: WriteMark;
  /** Почему ход не отдаёт этот ресурс инструменту (фраза для модели); `null` — отдаёт. */
  readonly refuse: (id: ResourceId) => string | null;
  /**
   * Журнал хода режима файлов. Запись файла МОДУЛЯ учитывается в нём — тогда её видят листинг
   * модуля, проверка «модель видела этот текст» и отмена хода; `relOf` — путь от корня модуля
   * или `null`, если файл вне модуля.
   */
  readonly module?: {
    readonly journal: FileJournal;
    relOf(id: ResourceId): string | null;
  };
}

export interface TurnWrites {
  write(
    id: ResourceId,
    text: string,
    caller: { readonly readOnly: boolean }
  ): Promise<FormTurnWriteResult>;
  /** Ход кончился: дальше дверь отказывает. */
  close(): void;
  /** Записи мимо журнала модуля, в порядке первого касания. */
  entries(): ReadonlyMap<ResourceId, WrittenFile>;
  /** Сколько записей прошло дверью — и в журнал модуля, и мимо него. */
  readonly count: number;
}

export function createTurnWrites(options: TurnWritesOptions): TurnWrites {
  const { files, mark, refuse, module } = options;
  const own = new Map<ResourceId, WrittenFile>();
  let closed = false;
  let count = 0;
  // Записи идут по одной: две записи одного файла иначе прочли бы один и тот же `before`.
  let queue: Promise<unknown> = Promise.resolve();

  const refusal = (
    code: Extract<FormTurnWriteResult, { ok: false }>['code'],
    message: string
  ): FormTurnWriteResult => ({ ok: false, code, message });

  const commit = async (
    id: ResourceId,
    text: string,
    port: AiFiles
  ): Promise<FormTurnWriteResult> => {
    if (closed) return refusal('turn-ended', 'The assistant turn has already ended.');
    let before: string | null;
    try {
      before = await port.read(id);
      await port.write(id, text, mark);
    } catch (error) {
      return refusal('failed', error instanceof Error ? error.message : String(error));
    }
    count += 1;
    const rel = module?.relOf(id) ?? null;
    if (module !== undefined && rel !== null) {
      module.journal.record(id, rel, before, text);
    } else {
      const known = own.get(id);
      own.set(id, { before: known ? known.before : before, after: text });
    }
    const path = port.pathOf(id);
    const changed = changedLines(before ?? '', text);
    return {
      ok: true,
      op: {
        kind: before === null ? 'add' : 'update',
        ref: path,
        summary: `${path} (+${changed.added} −${changed.removed})`,
      },
    };
  };

  return {
    write(id, text, caller) {
      if (closed)
        return Promise.resolve(refusal('turn-ended', 'The assistant turn has already ended.'));
      if (caller.readOnly) {
        return Promise.resolve(refusal('read-only', 'A read-only tool cannot write.'));
      }
      const reason = refuse(id);
      if (reason !== null) return Promise.resolve(refusal('refused', reason));
      if (files === undefined) {
        return Promise.resolve(refusal('unavailable', 'No project is open to write to.'));
      }
      const started = queue.then(() => commit(id, text, files));
      queue = started.catch(() => undefined);
      return started;
    },
    close() {
      closed = true;
    },
    entries: () => own,
    get count() {
      return count;
    },
  };
}
