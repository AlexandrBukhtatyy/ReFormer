/**
 * Служба записей рабочей области, собранная из платформы: адаптер над держателем проекта.
 *
 * Тот же шов, что у соседней службы документов (`./documents`), и с той же оговоркой: сессия
 * читается на КАЖДЫЙ вызов. Захватить `project.get()` в замыкание нельзя — проект закрывают
 * и открывают заново, а служба регистрируется один раз на запуск.
 *
 * Отказы источника здесь не пробрасываются наружу, и это решение, а не небрежность. Все три
 * вопроса службы задаются, чтобы РЕШИТЬ, что делать дальше: «файл уже есть — не затирать»,
 * «в каталоге есть схема — предложить её», «текст прочитался — разобрать». Исключение в ответ
 * на любой из них означало бы, что вызывающий обязан отличать «нет» от «источник не ответил»
 * там, где различать нечем: в обоих случаях продолжать нельзя.
 *
 * @module shell/boot/ports/workspace-files
 */

import {
  makeResourceId,
  type ResourceId,
  type ResourceRef,
} from '@reformer/builder-plugin-api/internal';
import { fromRoot, parentOf, resolve } from '@/shell/platform/primitives/resource-path';
import type { WorkspaceFilesService } from '@reformer/builder-plugin-api/internal';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface WorkspaceFilesServiceDeps {
  /** Держатель проекта в объёме, которым пользуется служба: только снимок. */
  readonly project: Pick<ProjectHost, 'get'>;
}

/** Пустой листинг: одна замороженная ссылка вместо нового массива на каждый отказ. */
const NOTHING: readonly ResourceRef[] = Object.freeze([]);

export function createWorkspaceFilesService(
  deps: WorkspaceFilesServiceDeps
): WorkspaceFilesService {
  const { project } = deps;

  return {
    // Путевая арифметика проекта не спрашивает вовсе: ответ выводится из самого адреса
    // и не зависит от того, открыт ли ресурс и существует ли он.
    parentOf,
    resolve,
    fromRoot,

    // Корень ИСТОЧНИКА, а не каталог активного файла: «где корень проекта» — один ответ
    // на весь проект, и зависеть от того, что сейчас открыто, он не может.
    projectRoot: (): ResourceId | null => {
      const source = project.get()?.source;
      return source === undefined ? null : makeResourceId(source.id, '');
    },

    async exists(id: ResourceId) {
      const session = project.get();
      if (session === null) return false;
      return (await session.workspace.stat(id).catch(() => null)) !== null;
    },

    async list(dir: ResourceId) {
      const session = project.get();
      if (session === null) return NOTHING;
      return session.workspace.list(dir).catch(() => NOTHING);
    },

    async readText(id: ResourceId) {
      const session = project.get();
      if (session === null) return null;
      return session.workspace.readText(id).catch(() => null);
    },

    async refresh(dir: ResourceId) {
      // Тот же глагол, которым чинит себя дерево после операций над записями.
      await project.get()?.resources.refresh(dir);
    },

    // Источник у проекта пока один, и `id` в ответе не участвует. Параметр всё равно есть:
    // право на запись принадлежит ИСТОЧНИКУ, а не приложению, и когда источников станет
    // несколько, менять придётся реализацию, а не всех вызывающих.
    canWrite: (id: ResourceId): boolean => {
      void id;
      return project.get()?.source.capabilities?.write === true;
    },
  };
}
