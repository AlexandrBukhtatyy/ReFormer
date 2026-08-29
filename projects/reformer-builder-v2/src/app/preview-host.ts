/**
 * Порт превью, собранный из платформы.
 *
 * Самый широкий из портов, и это не разрастание, а состав задачи: превью — единственная часть
 * билдера, которой нужен КИТ ЦЕЛИКОМ, а не сведения о нём. Каталог говорит, какие компоненты
 * бывают; дескриптор — что с ними можно; а нарисовать их можно только имея сами компоненты.
 *
 * Отсюда `kitNamespace()`, которого больше нет ни у кого: `lib/kits` намеренно не тянет
 * React-адаптеры, поэтому пространство имён собирает композиция — и **лениво**, потому что это
 * единственное место, тянущее кит целиком. Пока чанк в пути, поверхность рисует подписанные
 * заглушки: не отказ, а честное «компонент ещё едет».
 *
 * @module app/preview-host
 */

import { useSyncExternalStore } from 'react';
import type { ResourceId, ResourceRef } from '../host/primitives/resource';
import type { Disposable } from '../host/primitives/disposable';
import type { ServiceRegistry } from '../host/primitives/service';
import type { RootI18nService } from '../host/services/i18n/i18n';
import { useLocale } from '../host/ui/usePanels';
import type { CatalogEntry } from '../lib/catalog/types';
import type { KitDescriptor, KitNamespace } from '../lib/kits/types';
import { KitsServiceToken } from '../plugins/kits/service';
import { PREVIEW_PLUGIN_ID } from '../plugins/preview';
import type {
  PreviewDocument,
  PreviewHost,
  PreviewModules,
  PreviewSourceCapabilities,
  Translate,
} from '../plugins/preview';
import type { ProjectHost } from './project';

export interface PreviewHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  readonly services: ServiceRegistry;
  /** Загрузчик модулей и прогрев транспилятора — те же, что у загрузчика плагинов. */
  readonly modules?: PreviewModules;
}

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);
const NO_SIBLINGS: readonly ResourceRef[] = Object.freeze([]);

/** Реактивный перевод (именованная функция — ради правил хуков). */
function makeUseTranslate(i18n: RootI18nService): () => Translate {
  const view = i18n.forPlugin(PREVIEW_PLUGIN_ID);
  function useTranslate(): Translate {
    useLocale(i18n);
    return (key, params) => view.t(key, params);
  }
  return useTranslate;
}

/**
 * Пространство имён кита: загружается один раз и запоминается.
 *
 * Промис держим, а не только результат: два одновременных обращения не должны заводить двух
 * загрузок. Отказ **не запоминаем** — иначе один сетевой сбой навсегда лишал бы человека живого
 * превью, а перезагрузка страницы не должна быть единственным лечением сетевой икоты.
 */
function createKitNamespaceLoader(): { get: () => KitNamespace | null } {
  let loaded: KitNamespace | null = null;
  let loading: Promise<void> | null = null;

  return {
    get: () => {
      if (loaded === null && loading === null) {
        loading = import('@reformer/ui-kit')
          .then((ns) => {
            loaded = ns as unknown as KitNamespace;
          })
          .catch((err: unknown) => {
            console.error('[preview] кит не загрузился: рисуем заглушки', err);
          })
          .finally(() => {
            loading = null;
          });
      }
      return loaded;
    },
  };
}

export function createPreviewHost(deps: PreviewHostDeps): PreviewHost {
  const { project, i18n, services, modules } = deps;
  const namespace = createKitNamespaceLoader();

  /**
   * Активная вкладка как внешнее состояние.
   *
   * Именованная функция: правила хуков опознают хук по имени объявления, а метод в литерале
   * для них — обычная функция.
   */
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

    documentOf: (id: ResourceId): PreviewDocument | null =>
      (project.get()?.documents.documentOf(id) as PreviewDocument | null) ?? null,

    // Право на исполнение объявляет ИСТОЧНИК, а не настройка билдера: сайдкары формы —
    // это код, и он придёт оттуда же, откуда схема. Источника нет — исполнять нечего,
    // и `null` поверхность трактует как отказ.
    sourceOf: (id: ResourceId): PreviewSourceCapabilities | null => {
      void id;
      const source = project.get()?.source;
      return source === undefined
        ? null
        : { executesCode: source.capabilities?.executesCode === true };
    },

    catalog: () => services.get(KitsServiceToken)?.catalog() ?? NO_CATALOG,
    kit: (): KitDescriptor | null => services.get(KitsServiceToken)?.descriptor() ?? null,
    kitNamespace: namespace.get,

    onDidChangeKit: (cb: () => void): Disposable =>
      services.get(KitsServiceToken)?.onDidChange(cb) ?? { dispose: () => {} },

    // Соседи формы — её сайдкары: компилирующей поверхности нужен каталог, а не один файл.
    siblings: async (id: ResourceId) => {
      const session = project.get();
      if (session === null) return NO_SIBLINGS;
      const dir = id.slice(0, id.lastIndexOf('/'));
      return session.workspace.list(dir as ResourceId);
    },

    readText: async (id: ResourceId) => {
      const session = project.get();
      if (session === null) throw new Error(`проект не открыт: читать нечего (${id})`);
      return session.workspace.readText(id);
    },

    onDidChangeFiles: (cb: () => void): Disposable => {
      const session = project.get();
      return session === null ? { dispose: () => {} } : session.workspace.onDidChange(cb);
    },

    modules,
  };
}
