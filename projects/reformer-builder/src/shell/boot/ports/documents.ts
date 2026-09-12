/**
 * Служба документов, собранная из платформы: адаптер над держателем проекта.
 *
 * Тот же шов, что у портов встроенных плагинов (`./monaco`, `./ai`, `./files`), с одним
 * отличием — на другом конце не плагин композиции, а реестр служб, то есть ЛЮБОЙ плагин,
 * включая внешний из каталога проекта. Поэтому здесь нет ни перевода, ни диагностик, ни
 * чего-либо ещё, что порты добавляют «по знакомству»: только рабочая область в объёме
 * `DocumentsService`.
 *
 * ## Сессия читается на КАЖДЫЙ вызов
 *
 * Захватывать `project.get()` в замыкание нельзя: проект закрывают и открывают заново,
 * а служба регистрируется один раз на запуск — захваченная сессия означала бы «записать»
 * в область, которой больше нет (`./files`, «Все методы читают ТЕКУЩУЮ сессию»).
 *
 * ## Подписка перевешивается, а не заводится по одной на сессию
 *
 * Уведомление «что-то изменилось» складывается из двух источников с разным временем жизни:
 * держатель проекта живёт столько же, сколько служба, а хранилище вкладок умирает вместе
 * с сессией. Поэтому подписка на держателя одна и навсегда, а подписка на вкладки
 * перевешивается при каждой смене проекта — тот же приём, что у проверки источника
 * по фокусу окна в `boot.ts` (`rebindFocusChecks`). Освобождаются обе в `dispose`.
 *
 * @module shell/boot/ports/documents
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { DocumentsService, OpenDocumentOptions } from '@/shell/platform/services/documents';
import type { Document } from '@/shell/platform/workspace/document';
import type { WriteOptions } from '@/shell/platform/workspace/workspace';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface DocumentsServiceDeps {
  /** Держатель проекта в объёме, которым пользуется служба: снимок и подписка. */
  readonly project: Pick<ProjectHost, 'get' | 'subscribe'>;
}

/** Пустой список открытых вкладок: одна замороженная ссылка вместо нового массива на вызов. */
const NO_DOCUMENTS: readonly ResourceId[] = Object.freeze([]);

/** Отказ без проекта — тот же текст, что у портов: правка в никуда не должна выглядеть удачей. */
function noProject(id: ResourceId): Promise<never> {
  return Promise.reject(new Error(`проект не открыт: писать некуда (${id})`));
}

export function createDocumentsService(deps: DocumentsServiceDeps): DocumentsService & Disposable {
  const { project } = deps;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    // Копия набора и терпимость к падению подписчика — политика всех хранилищ оболочки:
    // упавший плагин не должен лишать уведомления остальных.
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[documents] подписчик службы документов упал', error);
      }
    }
  };

  // Подписка на вкладки ТЕКУЩЕЙ сессии. Перевешивается на смену проекта; `null` — проекта нет.
  let tabs: Disposable | null = null;
  const rebind = (): void => {
    tabs?.dispose();
    const session = project.get();
    tabs = session === null ? null : session.documents.subscribe(notify);
    // Смена проекта — сама по себе изменение: активный ресурс и набор документов другие.
    notify();
  };
  const projectSubscription = project.subscribe(rebind);
  // Первое связывание молча: служба создаётся до подписчиков, уведомлять некого.
  const initial = project.get();
  tabs = initial === null ? null : initial.documents.subscribe(notify);

  return {
    hasProject: () => project.get() !== null,

    activeResource: () => project.get()?.documents.get().activeId ?? null,

    // Снимок вкладок, а не хранимый список: вкладки переживают службу ровно наоборот —
    // хранилище умирает вместе с сессией, а служба живёт весь запуск.
    openDocuments: () =>
      project
        .get()
        ?.documents.get()
        .tabs.map((tab) => tab.ref.id) ?? NO_DOCUMENTS,

    documentOf: (id: ResourceId): Document | null =>
      project.get()?.documents.documentOf(id) ?? null,

    // Третий аргумент обязателен к пробросу, и компилятор потерю НЕ ловит: реализация
    // с меньшим числом параметров присваивается функции с бо́льшим (см. `./ai`). Без него
    // ход ассистента через эту службу лёг бы в журнал как правка человека.
    writeText(id: ResourceId, text: string, options?: WriteOptions) {
      const session = project.get();
      if (session === null) return noProject(id);
      return session.workspace.writeText(id, text, options);
    },

    open(id: ResourceId, options?: OpenDocumentOptions) {
      const session = project.get();
      if (session === null) return noProject(id);
      return session.documents.open(id, options);
    },

    // Тот же глагол и та же ручка, что у порта Monaco (`./monaco`): пока порты не переехали
    // на службу (Фаза 5 плана), оба зовут одно и то же. У текстового документа ручки нет,
    // и `undefined` здесь означает «отложенного не было».
    flush: (id: ResourceId) => project.get()?.models.handleOf(id)?.flush(),

    onDidChange(cb) {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },

    dispose() {
      projectSubscription.dispose();
      tabs?.dispose();
      tabs = null;
      listeners.clear();
    },
  };
}
