/**
 * Сохранение и «изменён ли» с учётом документов из нескольких файлов.
 *
 * Составной документ (корень + части, `workspace/model/model-document`) для человека — одна
 * вкладка. Значит и звёздочка на ней, и Ctrl+S обязаны касаться ВСЕХ его файлов: правка шага
 * в канвасе пишет файл шага, а не корень, и без этого вкладка корня выглядела бы чистой, а
 * сохранение корня оставляло бы шаг несохранённым.
 *
 * Удаление выпавших частей — тоже здесь, а не в документе: оно идёт мимо рабочей копии прямо в
 * источник, и до сохранения его откладывают ровно затем, чтобы отмена возвращала часть без следа.
 *
 * @module shell/boot/project/document-save
 */

import {
  toDisposable,
  type Disposable,
  type ResourceId,
} from '@reformer/builder-plugin-api/internal';
import type { ResourceOperations } from '@/shell/platform/workspace/resource-ops';
import type { SaveResult, Workspace } from '@/shell/platform/workspace/workspace';
import type { DocumentModels } from './document-models';

export interface DocumentSaveDeps {
  readonly workspace: Pick<Workspace, 'save' | 'isDirty' | 'readBase' | 'revert' | 'forget'>;
  readonly models: Pick<DocumentModels, 'handleOf' | 'opened'>;
  readonly resources: Pick<ResourceOperations, 'remove'>;
}

export interface DocumentSave {
  /** Сохранить ресурс вместе с частями его документа; без аргумента — всё изменённое. */
  save(id?: ResourceId): Promise<SaveResult>;
  /** Изменён ли ресурс — вместе с частями и с частями, ждущими удаления. */
  isDirty(id: ResourceId): boolean;
  /**
   * Удаление частей документа закончено: его изменённость поменялась без единой записи рабочей
   * области, и вкладка иначе так и осталась бы со звёздочкой.
   */
  onDidSave(cb: (root: ResourceId) => void): Disposable;
}

function merged(results: readonly SaveResult[]): SaveResult {
  return {
    ok: results.every((result) => result.ok),
    saved: results.flatMap((result) => result.saved),
    conflicts: results.flatMap((result) => result.conflicts),
    failures: results.flatMap((result) => result.failures),
  };
}

export function createDocumentSave(deps: DocumentSaveDeps): DocumentSave {
  const { workspace, models, resources } = deps;
  const listeners = new Set<(root: ResourceId) => void>();

  /**
   * Удалить части, выпавшие из документа. Локально созданная и не сохранённая ни разу часть
   * в источнике не существует — её достаточно откатить в рабочей копии.
   */
  const removeParts = async (root: ResourceId): Promise<void> => {
    const handle = models.handleOf(root);
    const gone = handle?.removedParts() ?? [];
    if (handle === null || gone.length === 0) return;
    const done: ResourceId[] = [];
    const inSource: ResourceId[] = [];
    for (const id of gone) {
      const base = await workspace.readBase(id).catch(() => null);
      if (base === null) {
        await workspace.revert(id).catch(() => undefined);
        done.push(id);
      } else {
        inSource.push(id);
      }
    }
    if (inSource.length > 0) {
      const result = await resources.remove(inSource);
      done.push(...result.done);
      for (const failure of result.failed) {
        // Файла в источнике уже нет — удалять нечего; остаётся забыть рабочую копию.
        if ((failure.error as { kind?: unknown } | null)?.kind === 'not-found') {
          await workspace.forget(failure.id).catch(() => undefined);
          done.push(failure.id);
          continue;
        }
        console.error(`[workspace] часть «${failure.id}» не удалена`, failure.error);
      }
    }
    handle.forgetRemoved(done);
    for (const cb of [...listeners]) cb(root);
  };

  return {
    async save(id) {
      if (id === undefined) {
        const result = await workspace.save();
        for (const root of [...models.opened().keys()]) await removeParts(root);
        return result;
      }
      const parts = models.handleOf(id)?.parts() ?? [];
      const results: SaveResult[] = [];
      for (const one of [id, ...parts]) results.push(await workspace.save(one));
      await removeParts(id);
      return merged(results);
    },

    isDirty(id) {
      if (workspace.isDirty(id)) return true;
      const handle = models.handleOf(id);
      if (handle === null) return false;
      return (
        handle.removedParts().length > 0 || handle.parts().some((part) => workspace.isDirty(part))
      );
    },

    onDidSave(cb) {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },
  };
}
