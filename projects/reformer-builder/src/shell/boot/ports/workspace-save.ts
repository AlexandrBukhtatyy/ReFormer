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

import {
  isInside,
  parseResourceId,
  type ResourceId,
  type WorkspaceSaveService,
} from '@reformer/builder-plugin-api/internal';
import type { ProjectHost } from '@/shell/boot/project/project';
import type { WorkspaceSession } from '@/shell/boot/project/workspace-session';

export interface WorkspaceSaveDeps {
  /** Держатель проекта в объёме одной операции: только снимок. */
  readonly project: Pick<ProjectHost, 'get'>;
}

/**
 * Несохранённое внутри ресурсов (`WorkspaceSaveOptions.nested`): сам ресурс, если он изменён,
 * и все изменённые файлы под ним.
 *
 * Каталог отличается от файла не запросом к источнику, а тем, что под ним что-то лежит: у файла
 * «под ним» пусто, а изменённость самого каталога — всегда `false`, его нет в рабочей копии.
 * Сам ресурс спрашивается у сохранения документов, а не у рабочей области: составной документ
 * изменён и тогда, когда изменена одна его часть.
 */
function unsavedWithin(
  session: Pick<WorkspaceSession, 'saving' | 'workspace'>,
  ids: readonly ResourceId[]
): readonly ResourceId[] {
  const dirty = session.workspace.dirtyResources().map((id) => ({ id, ...parseResourceId(id) }));
  const out = new Set<ResourceId>();
  for (const id of ids) {
    if (session.saving.isDirty(id)) out.add(id);
    const { sourceId, path } = parseResourceId(id);
    for (const one of dirty) {
      if (one.sourceId === sourceId && isInside(one.path, path)) out.add(one.id);
    }
  }
  return [...out];
}

export function createWorkspaceSaveService(deps: WorkspaceSaveDeps): WorkspaceSaveService {
  return {
    async save(ids: readonly ResourceId[], options) {
      const session = deps.project.get();
      if (session === null) return false;
      const targets = options?.nested === true ? unsavedWithin(session, ids) : ids;
      // По одному, а не разом: среди названного бывают корень составного документа и его же
      // часть. Сохранение корня пишет и части, и параллельная запись той же части второй раз
      // упёрлась бы в ревизию, которую первая только что сменила, — ложное расхождение.
      const results = [];
      for (const id of targets) results.push(await session.saving.save(id, options));
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

    isDirty: (ids) => {
      const session = deps.project.get();
      if (session === null) return false;
      return ids === undefined
        ? session.workspace.isDirty()
        : unsavedWithin(session, ids).length > 0;
    },
  };
}
