/**
 * Порт плагина файлов из возможностей оболочки — то, что раньше собирала композиция.
 *
 * Порт ({@link FilesHost}) остался: текстовый редактор и операции над записями пишутся против
 * него, и тест подставляет его целиком. Изменилось, КТО его собирает. Раньше — оболочка
 * (`shell/boot/ports/files`), и ради этого она импортировала плагин; внешнему плагину такой
 * порт не собрал бы никто. Теперь плагин собирает его сам из служб SDK:
 *
 * - тело панели дерева и выделение в нём — `reformer.workspace.tree`;
 * - вкладки, документы и запись в рабочую копию — `reformer.workspace`;
 * - корень проекта — `reformer.workspace.files`.
 *
 * Перевод кодов находок и переход к ресурсу ушли вместе со списком находок в журнал
 * (`base/journal`).
 *
 * Службы спрашиваются на КАЖДЫЙ вызов: проект закрывают и открывают заново, а порт живёт
 * с плагином. Исключение — тело панели дерева: ссылка на компонент обязана быть стабильной,
 * и читается она один раз.
 *
 * @module plugins/base/files/host-from-context
 */

import {
  DocumentsServiceToken,
  isTextMediaType,
  useTranslate,
  WorkspaceFilesServiceToken,
  WorkspaceTreeCapability,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import type { FilesHost, Translate } from './host';

export function filesHostFromContext(ctx: Pick<PluginContext, 'services' | 'i18n'>): FilesHost {
  const documents = () => ctx.services.get(DocumentsServiceToken);
  const tree = () => ctx.services.get(WorkspaceTreeCapability);

  // Именованная функция: правила хуков опознают хук по имени объявления.
  function useFilesTranslate(): Translate {
    return useTranslate(ctx.i18n);
  }

  return {
    ResourceTreePanel: tree()?.Panel,
    useTranslate: useFilesTranslate,

    hasProject: () => documents()?.hasProject() ?? false,

    documentOf: (id: ResourceId) => documents()?.documentOf(id) ?? null,

    writeText(id: ResourceId, text: string) {
      const service = documents();
      // Отказ, а не тишина: правка, ушедшая в никуда, выглядит как сохранённая.
      if (service === undefined) {
        return Promise.reject(new Error(`рабочей области нет: писать некуда (${id})`));
      }
      return service.writeText(id, text);
    },

    isTextual: (mediaType: string) => isTextMediaType(mediaType),

    treeSelection: () => tree()?.selection() ?? [],

    treeRoot: () => ctx.services.get(WorkspaceFilesServiceToken)?.projectRoot() ?? null,
  };
}
