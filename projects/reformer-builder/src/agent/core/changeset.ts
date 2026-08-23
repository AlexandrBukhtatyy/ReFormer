/**
 * Набор изменений хода агента.
 *
 * Ход правит ЧЕРНОВИК, а не активную вкладку. Отсюда два следствия, ради которых слой и введён:
 *  - пользователь видит предпросмотр и решает, применять ли (Preview → Apply);
 *  - применение — один `editorActions.replaceSchema(draft)`, то есть ровно одна запись undo,
 *    без транзакционного механизма в сторе (`coalesceKey` умеет схлопывать только подряд идущие
 *    правки одного ключа и сбрасывается любым undo — для хода агента этого не хватило бы).
 *
 * @module reformer-builder/agent/core/changeset
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptyRules, type FormRules } from '../../model/rules';
import type { ChangeOp, ToolOutcome } from './types';

/** Черновик хода вместе с журналом операций. */
export interface ChangeSet {
  /** Схема на начало хода. */
  readonly base: JsonFormSchema;
  /** Правила на начало хода. */
  readonly baseRules: FormRules;
  /** Текущее состояние черновика. */
  readonly draft: JsonFormSchema;
  /** Текущее состояние правил. */
  readonly draftRules: FormRules;
  /** Применённые операции в порядке выполнения. */
  readonly ops: readonly ChangeOp[];
}

/** Пустой набор изменений от базовой схемы. */
export function createChangeSet(
  base: JsonFormSchema,
  baseRules: FormRules = emptyRules()
): ChangeSet {
  return { base, baseRules, draft: base, draftRules: baseRules, ops: [] };
}

/**
 * Учесть результат инструмента. Read-only вызовы и ошибки набор не меняют — журнал операций
 * описывает только то, что реально произошло со схемой.
 */
export function withOutcome(set: ChangeSet, outcome: ToolOutcome): ChangeSet {
  // Инструмент правит ЛИБО схему, либо правила — но набор изменений копит оба, потому что
  // применяется он одной записью истории: иначе Ctrl+Z откатывал бы половину хода.
  if (!outcome.ok || (!outcome.schema && !outcome.rules)) return set;
  return {
    base: set.base,
    baseRules: set.baseRules,
    draft: outcome.schema ?? set.draft,
    draftRules: outcome.rules ?? set.draftRules,
    ops: outcome.ops?.length ? [...set.ops, ...outcome.ops] : set.ops,
  };
}

/** Есть ли что применять. Сравнение по ссылке — мутации иммутабельны и с structural sharing. */
export function hasChanges(set: ChangeSet): boolean {
  return set.draft !== set.base || set.draftRules !== set.baseRules;
}

/** Маркер операции для списка изменений. */
const MARKER: Record<ChangeOp['kind'], string> = {
  add: '+',
  update: '~',
  remove: '−',
  move: '→',
};

/** Список изменений для предпросмотра: по строке на операцию. */
export function describeChangeSet(set: ChangeSet): string[] {
  return set.ops.map((op) => `${MARKER[op.kind]} ${op.summary}`);
}
