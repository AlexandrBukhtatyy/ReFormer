/**
 * Сохранение рабочей копии в источник — ОДНА операция, которую нельзя отдать службой.
 *
 * Все остальные пути записи упираются в рабочую копию: до источника мимо сохранения
 * не дотянуться физически, и потому они безопасны по построению. `save` — единственное
 * исключение, и отдать его через реестр служб значит открыть плагину из каталога проекта
 * вторую дверь, которую придётся охранять политикой прав. Политики прав нет, поэтому
 * сохранение остаётся у композиции — у того, кого пользователь уже впустил.
 *
 * Общая реализация на двоих (генерация кода и шаблоны), потому что операция у них
 * буквально одна и та же: сохранить набор адресов и не потерять расхождения. Две копии
 * разошлись бы на первой же правке — например, забыв про `noteConflicts`, и тогда диалог
 * слияния перестал бы открываться после сохранения из одной панели, но продолжал из другой.
 *
 * @module shell/boot/ports/workspace-save
 */

import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface WorkspaceSaveDeps {
  /** Держатель проекта в объёме одной операции: только снимок. */
  readonly project: Pick<ProjectHost, 'get'>;
}

/** Сохранить набор ресурсов. `false` — проекта нет или хотя бы один не сохранился. */
export type WorkspaceSave = (ids: readonly ResourceId[]) => Promise<boolean>;

export function createWorkspaceSave(deps: WorkspaceSaveDeps): WorkspaceSave {
  return async (ids: readonly ResourceId[]) => {
    const session = deps.project.get();
    if (session === null) return false;
    const results = await Promise.all(ids.map((id) => session.workspace.save(id)));
    // Расхождения с источником — не отказ сохранения, а состояние рабочей области: их
    // показывает диалог слияния, и знать о них обязан тот, кто его открывает.
    session.divergence.noteConflicts(results.flatMap((r) => r.conflicts ?? []));
    return results.every((r) => r.ok);
  };
}
