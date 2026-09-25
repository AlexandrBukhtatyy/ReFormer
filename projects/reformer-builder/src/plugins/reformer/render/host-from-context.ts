/**
 * Порт превью из возможностей оболочки — то, что раньше собирала композиция.
 *
 * Порт ({@link PreviewHost}) остался: поверхности и панель модели пишутся против него, и тест
 * подставляет его целиком. Изменилось, КТО его собирает. Раньше — оболочка, и ради этого она
 * знала о ките, загрузчике модулей и словаре плагина превью, то есть знала стек ReFormer. Теперь
 * плагин собирает порт сам, из служб, которые оболочка отдаёт любому плагину:
 *
 * - документы и активная вкладка — `DocumentsService`;
 * - соседи, текст, путь от корня, права источника, правки файлов — `WorkspaceFilesService`;
 * - загрузчик модулей — `ModuleLoaderCapability`;
 * - кит — служба плагина китов, по структурной копии ({@link KitCapability}).
 *
 * Службы спрашиваются на КАЖДЫЙ вызов, а не при сборке: кит и превью выключаемы на ходу, а без
 * проекта служба рабочей области отвечает пусто — и порт честно отвечает так же.
 *
 * @module plugins/reformer/render/host-from-context
 */

import {
  defineCapability,
  DocumentModelsCapability,
  DocumentsServiceToken,
  ModuleLoaderCapability,
  useActiveDocument,
  useTranslate,
  WorkspaceFilesServiceToken,
  type Disposable,
  type DocumentsService,
  type PluginContext,
  type ResourceId,
  type ResourceRef,
} from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '@reformer/builder-stack-reformer/catalog';
import type { KitDescriptor, KitNamespace } from '@reformer/builder-stack-reformer/kits';
import type { PreviewDocument, PreviewHost, Translate } from './host';

/**
 * Служба китов в объёме превью — структурная копия `KitsService` плагина китов.
 *
 * Копия, а не импорт: плагины друг друга не импортируют, а реестр служб ключуется строкой,
 * поэтому копия находит ту же службу. Пространство имён необязательно: версия службы ниже 1.1
 * его не отдаёт, и превью тогда рисует подписанные заглушки.
 */
export interface KitReader {
  catalog(): readonly CatalogEntry[];
  descriptor(): KitDescriptor;
  onDidChange(cb: () => void): Disposable;
  namespace?(): KitNamespace | null;
  onDidLoadNamespace?(cb: () => void): Disposable;
}

/** Та же возможность, что объявляет плагин китов; версия — та, против которой писана копия. */
export const KitCapability = defineCapability<KitReader>({
  id: 'reformer.kit.catalog',
  version: '1.1.0',
});

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);
const NO_SIBLINGS: readonly ResourceRef[] = Object.freeze([]);
const NOOP: Disposable = Object.freeze({ dispose: () => {} });

/** Пустая служба документов: ответ «проекта нет», чтобы хук активной вкладки жил без службы. */
const NO_DOCUMENTS: Pick<DocumentsService, 'activeResource' | 'onDidChange'> = Object.freeze({
  activeResource: () => null,
  onDidChange: () => NOOP,
});

export function previewHostFromContext(ctx: Pick<PluginContext, 'services' | 'i18n'>): PreviewHost {
  const documents = () => ctx.services.get(DocumentsServiceToken);
  const files = () => ctx.services.get(WorkspaceFilesServiceToken);
  const kit = () => ctx.services.get(KitCapability);
  const modules = ctx.services.get(ModuleLoaderCapability);

  // Именованные функции: правила хуков опознают хук по имени объявления.
  function usePreviewTranslate(): Translate {
    return useTranslate(ctx.i18n);
  }
  function usePreviewActiveDocument(): ResourceId | null {
    return useActiveDocument(documents() ?? NO_DOCUMENTS);
  }

  return {
    useTranslate: usePreviewTranslate,
    useActiveDocument: usePreviewActiveDocument,

    documentOf(id: ResourceId): PreviewDocument | null {
      const document = documents()?.documentOf(id) ?? null;
      if (document === null) return null;
      const handle = ctx.services.get(DocumentModelsCapability)?.handleOf(id) ?? null;
      return {
        id: document.id,
        ref: document.ref,
        kind: document.kind,
        ...(handle !== null ? { providerId: handle.document.providerId } : {}),
        getText: () => document.getText(),
        // Модель — только согласованная с буфером: устаревшая показала бы форму, которой
        // в тексте перед человеком уже нет.
        model: () =>
          handle !== null && handle.document.getSyncState() === 'synced'
            ? handle.document.getModel()
            : undefined,
        onDidChangeContent: (cb) => document.onDidChangeContent(cb),
      };
    },

    sourceOf: (id: ResourceId) => {
      const service = files();
      return service === undefined ? null : { executesCode: service.executesCode(id) };
    },

    catalog: () => kit()?.catalog() ?? NO_CATALOG,
    kit: () => kit()?.descriptor() ?? null,
    kitNamespace: () => kit()?.namespace?.() ?? null,

    // Два события, и оба означают «пересоберись»: сменился активный кит и догрузилось его
    // пространство имён. Подпишись только на первое — и форма, собранная до загрузки кита,
    // осталась бы в заглушках навсегда.
    onDidChangeKit(cb: () => void): Disposable {
      const reader = kit();
      const onKit = reader?.onDidChange(cb) ?? NOOP;
      const onLoad = reader?.onDidLoadNamespace?.(cb) ?? NOOP;
      return {
        dispose(): void {
          onKit.dispose();
          onLoad.dispose();
        },
      };
    },

    // Соседи формы — её сайдкары. Арифметика путей — у службы: разбирать адрес самому нельзя.
    siblings: async (id: ResourceId) => {
      const service = files();
      return service === undefined ? NO_SIBLINGS : service.list(service.parentOf(id));
    },

    // Обход каталога формы вглубь (папки шагов визарда) — та же служба, по уровню за вызов.
    list: async (dir: ResourceId) => {
      const service = files();
      return service === undefined ? NO_SIBLINGS : service.list(dir);
    },

    parentOf: (id: ResourceId) => {
      const service = files();
      if (service === undefined) throw new Error(`рабочей области нет: ${id}`);
      return service.parentOf(id);
    },

    readText: async (id: ResourceId) => {
      const text = (await files()?.readText(id)) ?? null;
      if (text === null) throw new Error(`не читается: ${id}`);
      return text;
    },

    resolveFromRoot: (anchor: ResourceId, path: string) => {
      const service = files();
      if (service === undefined) throw new Error(`рабочей области нет: ${path}`);
      return service.fromRoot(anchor, path);
    },

    onDidChangeFiles: (cb) => files()?.onDidChange(cb) ?? NOOP,

    ...(modules !== undefined ? { modules } : {}),
  };
}
