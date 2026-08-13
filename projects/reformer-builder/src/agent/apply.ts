/**
 * Применение набора изменений к активной вкладке.
 *
 * Здесь сходятся два решения архитектуры:
 *  - применение — ОДИН `replaceSchema`, поэтому весь ход агента отменяется одним Ctrl+Z
 *    (`replaceSchema` уходит в `pushHistory` без `coalesceKey`, то есть даёт ровно одну запись);
 *  - строгий гейт — барьер: ни один выход агента не попадает в схему, минуя его. Гейт на каждой
 *    правке (`agent/core/gate`) существует ради обратной связи модели, но полагаться на него как
 *    на единственную защиту нельзя — набор мог быть собран раньше, чем вкладку переключили.
 *
 * @module reformer-builder/agent/apply
 */

import { validateSchema } from '../io/validate';
import { activeTab, editorActions, editorStore } from '../store';
import type { ChangeSet } from './core/changeset';
import { hasChanges } from './core/changeset';

/** Исход применения. */
export type ApplyOutcome =
  | { status: 'applied' }
  /** Применять нечего. */
  | { status: 'empty' }
  /** Нет открытой формы (вкладку закрыли или переключили на код). */
  | { status: 'no-form' }
  /** Форму правили руками во время хода: база разошлась с активной вкладкой. */
  | { status: 'conflict' }
  /** Набор не проходит строгий гейт. */
  | { status: 'invalid'; errors: string[] };

/** Настройки применения. */
export interface ApplyOptions {
  /** Применить, несмотря на расхождение с активной вкладкой (осознанный выбор пользователя). */
  force?: boolean;
}

/**
 * Применить набор изменений к активной вкладке.
 *
 * Конфликт определяется сравнением ССЫЛОК на объект схемы — ровно так же, как `isDirty`
 * определяет несохранённость. Отдельный счётчик ревизий для этого не нужен: схема иммутабельна,
 * поэтому любая правка меняет ссылку.
 */
export function applyChangeSet(set: ChangeSet, opts: ApplyOptions = {}): ApplyOutcome {
  if (!hasChanges(set)) return { status: 'empty' };

  const tab = activeTab(editorStore.getState());
  if (!tab || tab.kind !== 'form') return { status: 'no-form' };
  if (tab.schema !== set.base && !opts.force) return { status: 'conflict' };

  const { valid, errors } = validateSchema(set.draft, { strict: true, baseline: set.base });
  if (!valid) return { status: 'invalid', errors };

  editorActions.replaceSchema(set.draft);
  return { status: 'applied' };
}

/** Разошлась ли активная вкладка с базой хода. */
export function isStale(set: ChangeSet): boolean {
  const tab = activeTab(editorStore.getState());
  return !tab || tab.kind !== 'form' || tab.schema !== set.base;
}
