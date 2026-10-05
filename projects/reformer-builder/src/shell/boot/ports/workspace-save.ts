/**
 * Сохранение рабочей копии в источник — служба `reformer.workspace.save`, собранная из платформы.
 *
 * Все остальные пути записи упираются в рабочую копию: до источника мимо сохранения
 * не дотянуться физически, и потому они безопасны по построению. Сохранение — единственная
 * дверь наружу, поэтому служба привилегированная: кому она видна, решает право
 * `workspace.save` в манифесте, а не этот модуль.
 *
 * Реализация одна на всех, кто сохраняет (команды «Сохранить», генерация кода, шаблоны),
 * потому что операция у них буквально одна и та же: сохранить и не потерять расхождения. Копии
 * разошлись бы на первой же правке — например, забыв про `noteConflicts`, и тогда диалог
 * слияния перестал бы открываться после сохранения из одной панели, но продолжал из другой.
 *
 * Сессия читается в момент вызова: проект закрывают и открывают заново, а служба
 * регистрируется один раз на запуск.
 *
 * @module shell/boot/ports/workspace-save
 */

import type { ResourceId, WorkspaceSaveService } from '@reformer/builder-plugin-api/internal';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface WorkspaceSaveDeps {
  /** Держатель проекта в объёме одной операции: только снимок. */
  readonly project: Pick<ProjectHost, 'get'>;
}

export function createWorkspaceSaveService(deps: WorkspaceSaveDeps): WorkspaceSaveService {
  return {
    async save(ids: readonly ResourceId[]) {
      const session = deps.project.get();
      if (session === null) return false;
      const results = await Promise.all(ids.map((id) => session.saving.save(id)));
      // Расхождения с источником — не отказ сохранения, а состояние рабочей области: их
      // показывает диалог слияния, и знать о них обязан тот, кто его открывает.
      session.divergence.noteConflicts(results.flatMap((r) => r.conflicts ?? []));
      return results.every((r) => r.ok);
    },

    // Отказ-конфликт виден ТОЛЬКО тому, кто позвал сохранение: `SaveResult` не событие,
    // а возврат. Значит каждое место вызова обязано провести отказ в наблюдение само —
    // иначе найденное источником расхождение никуда не попадёт и счётчик останется нулём.
    async saveAll() {
      const session = deps.project.get();
      if (session === null) return false;
      const result = await session.saving.save();
      session.divergence.noteConflicts(result.conflicts ?? []);
      return result.ok;
    },

    isDirty: () => deps.project.get()?.workspace.isDirty() ?? false,
  };
}
