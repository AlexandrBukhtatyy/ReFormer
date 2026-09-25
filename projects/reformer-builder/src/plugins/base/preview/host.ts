/**
 * Порт платформы для превью-хоста: ровно то, чем он пользуется, и ничего сверх.
 *
 * Хосту от документа нужен только АДРЕС — вид, ссылка и провайдер модели, — чтобы спросить
 * поверхности, берутся ли они за него. Текст, модель, кит и загрузчик модулей нужны тому, кто
 * рисует, то есть поверхностям стеков, и приходят к ним их собственными путями.
 *
 * Порт собирается из ВОЗМОЖНОСТЕЙ оболочки ({@link hostFromServices}): документы, записи рабочей
 * области и модели документов. Раньше его собирала композиция, и оболочка знала о превью ровно
 * столько, сколько нужно, чтобы его запустить. Теперь не знает ничего; параметром порт приходит
 * только в тестах.
 *
 * @module plugins/base/preview/host
 */

import type {
  Disposable,
  DocumentKind,
  DocumentModelsService,
  DocumentsService,
  ResourceId,
  ResourceRef,
  WorkspaceFilesService,
} from '@reformer/builder-plugin-api';

/** Открытый документ — в объёме, нужном выбору поверхности. */
export interface LiveDocument {
  readonly id: ResourceId;
  readonly ref: ResourceRef;
  readonly kind: DocumentKind;
  /** Провайдер модели, который взялся за документ; есть только у модельного. */
  readonly providerId?: string;
}

/**
 * Возможности источника — в объёме одного вопроса: можно ли исполнять его код. Ширина порта
 * равна ширине принимаемого решения, поэтому «а можно ли ещё вот это» здесь не выразимо.
 */
export interface PreviewSourceCapabilities {
  readonly executesCode: boolean;
}

export interface PreviewHostPort {
  /** Открытый документ по адресу; `null` — такого нет или проект не открыт. */
  documentOf(id: ResourceId): LiveDocument | null;
  /** Права источника документа; `null` — источник неизвестен (проект не открыт). */
  sourceOf(id: ResourceId): PreviewSourceCapabilities | null;
  /**
   * Файлы рабочей области изменились: их находки сборки устарели. Необязателен — без него
   * находки живут до следующей сборки, как и раньше.
   */
  onDidChangeFiles?(cb: (changed: readonly ResourceId[]) => void): Disposable;
}

/** Возможности, из которых собирается порт. Функции: службы спрашиваются в момент вопроса. */
export interface PreviewHostServices {
  readonly documents: () => Pick<DocumentsService, 'documentOf'> | undefined;
  readonly files: () => Pick<WorkspaceFilesService, 'executesCode' | 'onDidChange'> | undefined;
  readonly models: () => Pick<DocumentModelsService, 'handleOf'> | undefined;
}

/**
 * Порт из возможностей оболочки.
 *
 * Провайдер модели берётся у ручки модельного документа: у текстового документа ручки нет, и
 * провайдера у него нет тоже — поверхности стеков за такой документ не берутся.
 */
export function hostFromServices(services: PreviewHostServices): PreviewHostPort {
  return {
    documentOf(id: ResourceId): LiveDocument | null {
      const document = services.documents()?.documentOf(id) ?? null;
      if (document === null) return null;
      const providerId = services.models()?.handleOf(id)?.document.providerId;
      return {
        id: document.id,
        ref: document.ref,
        kind: document.kind,
        ...(providerId !== undefined ? { providerId } : {}),
      };
    },
    sourceOf(id: ResourceId): PreviewSourceCapabilities | null {
      const files = services.files();
      return files === undefined ? null : { executesCode: files.executesCode(id) };
    },
    onDidChangeFiles(cb: (changed: readonly ResourceId[]) => void): Disposable {
      return services.files()?.onDidChange(cb) ?? { dispose: () => {} };
    },
  };
}
