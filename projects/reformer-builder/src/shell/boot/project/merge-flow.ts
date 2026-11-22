/**
 * Вопрос о расхождении: файл изменился в источнике, пока его правили здесь.
 *
 * ## Недостающее звено
 *
 * Части были написаны все: источник отвечает на запись отказом-конфликтом, наблюдение помнит
 * расхождение, слияние собирает три стороны, диалог их показывает. Не было того, кто их
 * соединяет. Сохранение упиралось в конфликт, строка состояния сообщала «файл изменён
 * снаружи» — и дальше дороги не было: ни переписать файл, ни взять его версию.
 *
 * Этот модуль — очередь вопросов без React и без диалога: что спросить, чем кончился ответ
 * и о чём спросить следом. Показывает вопрос `./MergeQuestionHost`.
 *
 * ## На сохранении спрашиваем всегда
 *
 * Сохранение наткнулось на расхождение — человек видит, что файл изменился, и выбирает:
 * переписать его своей версией, взять версию источника или сравнить и слить. Правки, которые
 * не пересеклись, молча не объединяются: человек, правивший файл руками в другом редакторе,
 * хочет знать, что с его правкой стало. Чистое слияние приходит в диалог готовым исходом —
 * одной кнопкой.
 *
 * Не спрашиваем в трёх случаях, и во всех выбирать не из чего:
 *
 * - **версии совпали посимвольно** — принимаем ревизию источника, в источник не пишем;
 * - **источник переписали тем же содержимым** — ревизия новая, текст прежний: чужой правки
 *   нет, и наша версия просто записывается;
 * - **здесь файл не правили** — берём версию источника. Иначе открытый документ показывал бы
 *   вчерашнее, а первая же правка в нём приводила бы к вопросу, которого могло не быть.
 *
 * ## Запись — та же дверь
 *
 * Исход уходит в источник тем же `save`, что и обычное сохранение (`applyMergeCommit`), —
 * с ревизией ПРОЧИТАННОЙ версии источника. Уехал источник ещё раз, пока человек думал, —
 * стороны читаются заново и вопрос задаётся снова, уже о новом расхождении.
 *
 * @module shell/boot/project/merge-flow
 */

import {
  basename,
  parseResourceId,
  toDisposable,
  type Disposable,
  type ResourceId,
} from '@reformer/builder-plugin-api/internal';
import type { DivergenceWatch } from '@/shell/platform/workspace/merge/divergence';
import {
  applyMergeCommit,
  commitFor,
  loadMergeSides,
  planMerge,
  type MergeChoice,
  type MergePlan,
  type MergeReader,
  type MergeSides,
  type MergeWriter,
  type VerifyText,
} from '@/shell/platform/workspace/merge/resolve';

/** Почему ответ не принят. Вопрос при этом остаётся открытым. */
export interface MergeProblem {
  /** `unparsable` — текст ручного слияния не разбирается; `failed` — запись не удалась. */
  readonly kind: 'unparsable' | 'failed';
  /** Сообщение разбора или источника: в нём код, не фраза. */
  readonly message: string;
}

/** Вопрос, на который ждём ответа человека. */
export interface MergeQuestion {
  readonly id: ResourceId;
  /** Имя файла — в заголовок. */
  readonly name: string;
  /** Путь от корня проекта — в подсказку заголовка. */
  readonly path: string;
  readonly sides: MergeSides;
  readonly plan: MergePlan;
  /** Чем кончилась прошлая попытка ответить. */
  readonly problem?: MergeProblem;
}

export interface MergeFlowDeps {
  readonly workspace: MergeReader & MergeWriter;
  readonly divergence: Pick<DivergenceWatch, 'get' | 'subscribe' | 'resolve' | 'noteConflicts'>;
  /** Правили ли ресурс здесь — вместе с частями его документа. */
  readonly isDirty: (id: ResourceId) => boolean;
  /**
   * Повторный разбор текста этого ресурса: у модельного документа — его провайдером,
   * у текстового разбирать нечем. Знание формата слиянию не принадлежит, поэтому внедряется.
   */
  readonly verifyOf: (id: ResourceId) => VerifyText;
  /** Куда уходит отказ чтения сторон. Без него — в консоль. */
  readonly onError?: (id: ResourceId, error: unknown) => void;
}

export interface MergeFlow extends Disposable {
  /** Вопрос, на который ждём ответа; `null` — спрашивать не о чем. */
  get(): MergeQuestion | null;
  subscribe(listener: () => void): Disposable;
  /** Сохранение наткнулось на расхождение этих ресурсов: спросить о каждом по очереди. */
  ask(ids: readonly ResourceId[]): Promise<void>;
  /** Ответ на текущий вопрос. Текст — только у ручного слияния. */
  answer(choice: MergeChoice, text?: string): Promise<void>;
  /** Закрыть, ничего не решив: расхождения остаются, а спросят о них на следующем сохранении. */
  cancel(): void;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function createMergeFlow(deps: MergeFlowDeps): MergeFlow {
  const { workspace, divergence } = deps;
  const reportError =
    deps.onError ??
    ((id: ResourceId, error: unknown): void => {
      console.error(`[workspace] расхождение «${id}» не разрешено`, error);
    });

  let current: MergeQuestion | null = null;
  const queue: ResourceId[] = [];
  const listeners = new Set<() => void>();
  /** Идёт чтение сторон или запись исхода: второй ход в это время не начинается. */
  let busy = false;
  let disposed = false;
  /** Ресурсы, чью версию источника принимаем прямо сейчас. */
  const adopting = new Set<ResourceId>();

  const publish = (next: MergeQuestion | null): void => {
    current = next;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Политика всех хранилищ оболочки: упавший подписчик не мешает остальным.
        console.error('[workspace] подписчик вопроса о расхождении упал', error);
      }
    }
  };

  /** Собирает вопрос о ресурсе. `null` — спрашивать не о чем: версии совпали. */
  const prepare = async (id: ResourceId): Promise<MergeQuestion | null> => {
    const sides = await loadMergeSides(workspace, id);
    if (sides.base !== null && sides.theirs === sides.base) {
      // Источник переписали ТЕМ ЖЕ содержимым — сохранение без правок в другом редакторе,
      // переключение ветки туда и обратно. Ревизия у файловой системы — время изменения,
      // поэтому она новая, а текст прежний: чужой правки нет, и спрашивать не о чем.
      const result = await applyMergeCommit(workspace, id, commitFor('ours', sides));
      if (result.status === 'done') {
        divergence.resolve(id);
        return null;
      }
      // Пока писали, источник всё-таки изменился — теперь это настоящее расхождение.
      if (result.status === 'conflict') return prepare(id);
      throw new Error(result.message);
    }
    const plan = planMerge(sides, deps.verifyOf(id));
    if (plan.kind === 'identical') {
      // Сторон, между которыми можно выбрать, нет: принимаем ревизию источника, чтобы
      // расхождение не всплывало снова, и в источник не пишем ничего.
      await workspace.acceptExternal(id, plan.text, plan.revision);
      divergence.resolve(id);
      return null;
    }
    const { path } = parseResourceId(id);
    return { id, name: basename(path), path, sides, plan };
  };

  const advance = async (): Promise<void> => {
    if (busy || current !== null || disposed) return;
    busy = true;
    try {
      while (queue.length > 0 && !disposed) {
        const id = queue.shift() as ResourceId;
        try {
          const question = await prepare(id);
          if (question !== null) {
            publish(question);
            return;
          }
        } catch (error) {
          reportError(id, error);
        }
      }
    } finally {
      busy = false;
    }
  };

  /**
   * Файл изменился в источнике, а здесь его не правили: берём версию источника.
   *
   * Терять нечего, поэтому и вопроса нет. Ресурс, о котором уже спрашивают, не трогаем:
   * его судьбу решает ответ.
   */
  const adoptUntouched = async (): Promise<void> => {
    for (const record of divergence.get().records) {
      const { id } = record;
      if (record.status !== 'diverged' || adopting.has(id) || deps.isDirty(id)) continue;
      if (current?.id === id || queue.includes(id)) continue;
      adopting.add(id);
      try {
        const theirs = await workspace.readSourceText(id);
        // Пока читали источник, файл могли начать править здесь — тогда это уже вопрос.
        if (theirs !== null && !deps.isDirty(id) && !disposed) {
          await workspace.acceptExternal(id, theirs.text, theirs.revision);
          divergence.resolve(id);
        }
      } catch (error) {
        reportError(id, error);
      } finally {
        adopting.delete(id);
      }
    }
  };

  const watching = divergence.subscribe(() => {
    void adoptUntouched();
  });

  return {
    get: () => current,

    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },

    ask(ids) {
      for (const id of ids) {
        if (current?.id !== id && !queue.includes(id)) queue.push(id);
      }
      return advance();
    },

    async answer(choice, text) {
      const question = current;
      if (question === null || busy) return;
      busy = true;
      try {
        if (choice === 'merged' && text !== undefined) {
          // Тот же повторный разбор, что после автослияния: слияние по строкам не знает
          // про запятые и скобки, и неразбираемый текст в источник уйти не должен.
          const verified = deps.verifyOf(question.id)(text);
          if (!verified.ok) {
            publish({ ...question, problem: { kind: 'unparsable', message: verified.message } });
            return;
          }
        }
        const result = await applyMergeCommit(
          workspace,
          question.id,
          commitFor(choice, question.sides, text)
        );
        if (result.status === 'failed') {
          publish({ ...question, problem: { kind: 'failed', message: result.message } });
          return;
        }
        if (result.status === 'conflict') {
          // Источник уехал ещё раз, пока человек думал: стороны читаются заново.
          divergence.noteConflicts([result.conflict]);
          queue.unshift(question.id);
        } else {
          divergence.resolve(question.id);
        }
        publish(null);
      } catch (error) {
        publish({ ...question, problem: { kind: 'failed', message: describe(error) } });
        return;
      } finally {
        busy = false;
      }
      await advance();
    },

    cancel() {
      if (current === null || busy) return;
      // Отмена — про всё сохранение, а не про один файл: закрывать диалоги по одному
      // незачем, а оставшиеся расхождения никуда не делись и спросятся при следующем.
      queue.length = 0;
      publish(null);
    },

    dispose() {
      disposed = true;
      watching.dispose();
      queue.length = 0;
      listeners.clear();
      current = null;
    },
  };
}
