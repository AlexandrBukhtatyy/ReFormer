/**
 * Правила диалога слияния: что показать в трёх колонках и какие исходы предложить.
 *
 * Отрисовка — в `./MergeDialog`, здесь — то, что можно проверить без браузера. Разделение
 * то же, что у вкладок (`./tabs` и `./DocumentTabs`) и у строки состояния, и по той же
 * причине: окружение тестов — `node`, и всё, что осталось внутри компонента, проверить нечем.
 *
 * ## Три колонки, а не две
 *
 * Колонка «версия источника» существует ровно потому, что отказ-конфликт несёт текущую ревизию
 * источника, а по ревизии можно сходить и прочитать содержимое. Это записано отдельным
 * требованием в контракте Э3 («без неё диалогу слияния нечего показать в колонке „версия
 * источника“»), и здесь оно становится проверяемым: {@link MergeColumn.available} у колонки
 * ложно, когда данных нет, и исход «взять версию источника» тогда не предлагается вовсе —
 * вместо кнопки, которая не сработает.
 *
 * ## Молчаливого исхода нет
 *
 * Диалог не выбирает сторону сам ни в каком случае и не имеет исхода по умолчанию. Отсюда же
 * запрет на подтверждение ручного слияния с оставшейся разметкой ({@link validateManualMerge}):
 * текст с маркерами — это не решение, а незаконченная работа, и записать его в источник значит
 * сломать файл молча.
 *
 * @module shell/platform/ui/dialogs/merge
 */

import type {
  AskReason,
  MergeChoice,
  MergePlan,
  MergeSides,
} from '@/shell/platform/workspace/merge/resolve';
import {
  diffLines,
  diffStat,
  hasConflictMarkers,
} from '@/shell/platform/workspace/merge/text-merge';

export type MergeColumnId = 'base' | 'ours' | 'theirs';

/** Одна колонка. Строки, а не текст: колонка рисуется построчно и нумеруется. */
export interface MergeColumn {
  readonly id: MergeColumnId;
  /** Есть ли что показывать. Ложно у основания, которого нет, и у исчезнувшего файла. */
  readonly available: boolean;
  readonly lines: readonly string[];
  /**
   * Номера строк (с нуля), которых нет в основании, — то, что эта сторона добавила или
   * изменила. По ним колонка показывает, ГДЕ правка: файл в сотню строк ради одной изменённой
   * человек читать не станет. У основания и у стороны без основания — пусто.
   */
  readonly changed: readonly number[];
  /** Насколько эта сторона ушла от основания. У самого основания — нули. */
  readonly added: number;
  readonly removed: number;
}

/**
 * Почему диалог открыт.
 *
 * `mergeable` — правки не пересеклись и результат разобрался: слияние готово, и человеку
 * остаётся его подтвердить. Спросить всё равно надо: он правил файл руками в другом месте
 * и вправе знать, что с этой правкой стало, — а заодно вправе от неё отказаться.
 */
export type MergeDialogReason = AskReason | 'mergeable';

export interface MergeDialogModel {
  readonly reason: MergeDialogReason;
  /** Всегда три и всегда в одном порядке: основание, наша, источника. */
  readonly columns: readonly MergeColumn[];
  /** Исходы, которые сейчас имеют смысл. Пусто не бывает: «оставить свою» есть всегда. */
  readonly choices: readonly MergeChoice[];
  readonly conflicts: number;
  /** Заготовка ручного слияния: слитый текст с разметкой, а при её отсутствии — наша версия. */
  readonly seed: string;
  /**
   * Готовое слияние: правки обеих сторон без спорных участков, разобранное обратно. Есть
   * только при {@link MergeDialogReason} `mergeable` — его можно принять одной кнопкой.
   */
  readonly mergedText?: string;
  /** Сообщение повторного разбора — только когда слияние не разобралось. */
  readonly failure?: string;
}

/** Почему ручное слияние нельзя принять. `ok` — можно. */
export type ManualMergeCheck = 'ok' | 'markers';

/**
 * Проверяет текст ручного слияния перед записью.
 *
 * Разметка конфликта в тексте означает, что человек до конца не дошёл: нажать «готово»,
 * пролистав спорный участок, легко, и цена этого — заведомо сломанный файл в источнике.
 * Проверка синтаксиса формата сюда НЕ входит: она делается тем же повторным разбором, что
 * и после автослияния, и живёт там же, где разбор.
 */
export function validateManualMerge(text: string): ManualMergeCheck {
  return hasConflictMarkers(text) ? 'markers' : 'ok';
}

/** Номера строк нового текста, которых нет в прежнем. */
function addedLines(ops: readonly { readonly type: 'same' | 'add' | 'del' }[]): number[] {
  const added: number[] = [];
  let line = 0;
  for (const op of ops) {
    if (op.type === 'del') continue;
    if (op.type === 'add') added.push(line);
    line += 1;
  }
  return added;
}

function column(id: MergeColumnId, text: string | null, base: string | null): MergeColumn {
  if (text === null) {
    return { id, available: false, lines: [], changed: [], added: 0, removed: 0 };
  }
  if (id === 'base') {
    // Основание — точка отсчёта, и считать его отклонение от себя незачем.
    return { id, available: true, lines: text.split('\n'), changed: [], added: 0, removed: 0 };
  }
  // Основания нет — сравнивать не с чем, и весь текст честно считается добавленным.
  const ops = diffLines(base ?? '', text);
  const stat = diffStat(ops);
  return {
    id,
    available: true,
    lines: text.split('\n'),
    // Без основания «изменено всё» — правда, но подсвеченная целиком колонка ничего не говорит.
    changed: base === null ? [] : addedLines(ops),
    added: stat.added,
    removed: stat.removed,
  };
}

/**
 * Собирает всё, что нужно диалогу.
 *
 * Принимает уже посчитанный план: считать его здесь значило бы звать разбор из отрисовки —
 * то есть делать работу, которая уже сделана, и делать её на каждую перерисовку.
 */
export function describeMergeDialog(sides: MergeSides, plan: MergePlan): MergeDialogModel {
  // Готовое слияние — свой повод: назвать его «правки пересеклись» было бы неправдой.
  const reason: MergeDialogReason =
    plan.kind === 'ask' ? plan.reason : plan.kind === 'auto' ? 'mergeable' : 'conflict';
  const columns: readonly MergeColumn[] = [
    column('base', sides.base, sides.base),
    column('ours', sides.ours, sides.base),
    column('theirs', sides.theirs, sides.base),
  ];

  const choices: MergeChoice[] = ['ours'];
  if (sides.theirs !== null) {
    choices.push('theirs');
    // Ручное слияние без второй стороны бессмысленно: сливать не с чем, и «слить вручную»
    // выродилось бы в «править свою версию», для чего диалог не нужен.
    choices.push('merged');
  }

  const merged = plan.kind === 'identical' ? undefined : plan.merged;
  return {
    reason,
    columns,
    choices,
    conflicts: merged?.conflicts ?? 0,
    seed: merged?.text ?? sides.ours,
    ...(plan.kind === 'auto' ? { mergedText: plan.text } : {}),
    ...(plan.kind === 'ask' && plan.failure !== undefined ? { failure: plan.failure } : {}),
  };
}

/** Колонка по имени — чтобы отрисовка не искала её перебором на каждой строке. */
export function columnOf(model: MergeDialogModel, id: MergeColumnId): MergeColumn {
  const found = model.columns.find((item) => item.id === id);
  if (found === undefined) throw new Error(`колонки «${id}» нет в модели диалога`);
  return found;
}
