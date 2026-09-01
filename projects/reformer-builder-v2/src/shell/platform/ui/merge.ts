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
 * @module host/ui/merge
 */

import type { AskReason, MergeChoice, MergePlan, MergeSides } from '../workspace/merge/resolve';
import { diffLines, diffStat, hasConflictMarkers } from '../workspace/merge/text-merge';

export type MergeColumnId = 'base' | 'ours' | 'theirs';

/** Одна колонка. Строки, а не текст: колонка рисуется построчно и нумеруется. */
export interface MergeColumn {
  readonly id: MergeColumnId;
  /** Есть ли что показывать. Ложно у основания, которого нет, и у исчезнувшего файла. */
  readonly available: boolean;
  readonly lines: readonly string[];
  /** Насколько эта сторона ушла от основания. У самого основания — нули. */
  readonly added: number;
  readonly removed: number;
}

export interface MergeDialogModel {
  readonly reason: AskReason;
  /** Всегда три и всегда в одном порядке: основание, наша, источника. */
  readonly columns: readonly MergeColumn[];
  /** Исходы, которые сейчас имеют смысл. Пусто не бывает: «оставить свою» есть всегда. */
  readonly choices: readonly MergeChoice[];
  readonly conflicts: number;
  /** Заготовка ручного слияния: слитый текст с разметкой, а при её отсутствии — наша версия. */
  readonly seed: string;
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

function column(id: MergeColumnId, text: string | null, base: string | null): MergeColumn {
  if (text === null) {
    return { id, available: false, lines: [], added: 0, removed: 0 };
  }
  if (id === 'base') {
    // Основание — точка отсчёта, и считать его отклонение от себя незачем.
    return { id, available: true, lines: text.split('\n'), added: 0, removed: 0 };
  }
  // Основания нет — сравнивать не с чем, и весь текст честно считается добавленным.
  const stat = diffStat(diffLines(base ?? '', text));
  return { id, available: true, lines: text.split('\n'), added: stat.added, removed: stat.removed };
}

/**
 * Собирает всё, что нужно диалогу.
 *
 * Принимает уже посчитанный план: считать его здесь значило бы звать разбор из отрисовки —
 * то есть делать работу, которая уже сделана, и делать её на каждую перерисовку.
 */
export function describeMergeDialog(sides: MergeSides, plan: MergePlan): MergeDialogModel {
  const reason: AskReason = plan.kind === 'ask' ? plan.reason : 'conflict';
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

  const merged = plan.kind === 'ask' ? plan.merged : undefined;
  return {
    reason,
    columns,
    choices,
    conflicts: merged?.conflicts ?? 0,
    seed: merged?.text ?? sides.ours,
    ...(plan.kind === 'ask' && plan.failure !== undefined ? { failure: plan.failure } : {}),
  };
}

/** Колонка по имени — чтобы отрисовка не искала её перебором на каждой строке. */
export function columnOf(model: MergeDialogModel, id: MergeColumnId): MergeColumn {
  const found = model.columns.find((item) => item.id === id);
  if (found === undefined) throw new Error(`колонки «${id}» нет в модели диалога`);
  return found;
}
