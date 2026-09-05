/**
 * Порт шаблонов форм, собранный из платформы.
 *
 * Отличие от порта генерации кода: шаблонам нужен **корень проекта и обход дерева**, потому что
 * проектные шаблоны лежат каталогом, а не одним файлом. Кит нужен обоим и по одной причине —
 * встроенные шаблоны печатает сам генератор, а он без дескриптора кита отказывается.
 *
 * @module shell/boot/ports/templates
 */

import { useSyncExternalStore } from 'react';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import {
  makeResourceId,
  type ResourceId,
  type ResourceRef,
} from '@/shell/platform/primitives/resource';
import type { ServiceRegistry } from '@/shell/platform/primitives/service';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useLocale } from '@/shell/platform/ui/chrome/usePanels';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { KitDescriptor } from '@/lib/kits/types';
import { KitsServiceToken } from '@/plugins/kits';
import { TEMPLATES_PLUGIN_ID } from '@/plugins/templates/contract';
import type { TemplatesHost, Translate } from '@/plugins/templates';
import { parentOf, resolve } from '@/shell/platform/primitives/resource-path';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface TemplatesHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  readonly services: ServiceRegistry;
}

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);
const NO_ENTRIES: readonly ResourceRef[] = Object.freeze([]);

function makeUseTranslate(i18n: RootI18nService): () => Translate {
  const view = i18n.forPlugin(TEMPLATES_PLUGIN_ID);
  function useTranslate(): Translate {
    useLocale(i18n);
    return (key, params) => view.t(key, params);
  }
  return useTranslate;
}

export function createTemplatesHost(deps: TemplatesHostDeps): TemplatesHost {
  const { project, i18n, services } = deps;

  function useActiveDocument(): ResourceId | null {
    return useSyncExternalStore(
      (cb) => {
        const session = project.get();
        if (session === null) return () => {};
        const off = session.documents.subscribe(cb);
        return () => {
          off.dispose();
        };
      },
      () => project.get()?.documents.get().activeId ?? null,
      () => null
    );
  }

  return {
    useTranslate: makeUseTranslate(i18n),
    useActiveDocument,

    refOf: (id: ResourceId): ResourceRef | null =>
      project.get()?.documents.documentOf(id)?.ref ?? null,

    // Корень источника, а не каталог открытого файла: шаблоны проекта лежат в одном месте
    // на весь проект, и зависеть от того, что сейчас открыто, они не должны.
    projectRoot: (): ResourceId | null => {
      const source = project.get()?.source;
      return source === undefined ? null : makeResourceId(source.id, '');
    },

    parentOf,
    resolve,

    async list(dir: ResourceId) {
      const session = project.get();
      if (session === null) return NO_ENTRIES;
      // Отсутствующий каталог — обычный ответ, а не авария: шаблонов в проекте может не быть,
      // и это не то же самое, что сломанный источник.
      return session.workspace.list(dir).catch(() => NO_ENTRIES);
    },

    async exists(id: ResourceId) {
      const session = project.get();
      if (session === null) return false;
      return (await session.workspace.stat(id).catch(() => null)) !== null;
    },

    async readText(id: ResourceId) {
      const session = project.get();
      if (session === null) return null;
      return session.workspace.readText(id).catch(() => null);
    },

    writeText(id: ResourceId, text: string) {
      const session = project.get();
      if (session === null) {
        return Promise.reject(new Error(`проект не открыт: писать некуда (${id})`));
      }
      return session.workspace.writeText(id, text);
    },

    sourceOf: (id: ResourceId) => {
      void id;
      const source = project.get()?.source;
      return source === undefined ? null : { write: source.capabilities?.write === true };
    },

    // Дерево читает уровни лениво и помнит прочитанное: каталог, созданный записью,
    // без этого хода в нём не появится. Тот же глагол, которым чинит себя дерево после
    // операций над записями, — `ResourceOperations.refresh`.
    async invalidate(dir: ResourceId) {
      await project.get()?.resources.refresh(dir);
    },

    async save(ids: readonly ResourceId[]) {
      const session = project.get();
      if (session === null) return false;
      const results = await Promise.all(ids.map((id) => session.workspace.save(id)));
      session.divergence.noteConflicts(results.flatMap((r) => r.conflicts ?? []));
      return results.every((r) => r.ok);
    },

    openResource(id: ResourceId) {
      const session = project.get();
      if (session === null) return;
      void session.documents.open(id, { preview: false }).catch((error: unknown) => {
        console.error(`[templates] открыть «${id}» не удалось`, error);
      });
    },

    catalog: () => services.get(KitsServiceToken)?.catalog() ?? NO_CATALOG,
    kit: (): KitDescriptor | null => services.get(KitsServiceToken)?.descriptor() ?? null,
    onDidChangeKit: (cb: () => void): Disposable =>
      services.get(KitsServiceToken)?.onDidChange(cb) ?? { dispose: () => {} },

    // `local` НЕ передаётся, и это осознанный отказ, а не пропуск. Единственное хранилище
    // плагинов сейчас — память сессии: постоянное является частью рабочей области и ещё
    // не написано. Подставь мы память — локальные шаблоны исчезали бы при перезагрузке
    // страницы БЕЗ ВСЯКОГО ПРИЗНАКА, а человек считал бы их сохранёнными. Отсутствие
    // хранилища плагин переживает: он не показывает раздел локальных шаблонов вовсе.
    //
    // `remove` тоже не передаётся: у рабочей области нет удаления ресурса — `Source.remove`
    // до неё не проброшен. Проектный шаблон поэтому нельзя удалить из панели.
  };
}
