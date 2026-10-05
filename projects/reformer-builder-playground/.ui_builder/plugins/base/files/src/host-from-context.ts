/**
 * Порт плагина файлов из возможностей оболочки — то, что раньше собирала композиция.
 *
 * Порт ({@link FilesHost}) остался: панель проблем, текстовый редактор и операции над записями
 * пишутся против него, и тест подставляет его целиком. Изменилось, КТО его собирает. Раньше —
 * оболочка (`shell/boot/ports/files`), и ради этого она импортировала плагин; внешнему плагину
 * такой порт не собрал бы никто. Теперь плагин собирает его сам из служб SDK:
 *
 * - тело панели дерева и выделение в нём — `reformer.workspace.tree`;
 * - вкладки, документы и запись в рабочую копию — `reformer.workspace`;
 * - корень проекта — `reformer.workspace.files`;
 * - перевод кодов находок и заголовков исправлений — словарь оболочки (`reformer.host.messages`).
 *
 * Службы спрашиваются на КАЖДЫЙ вызов: проект закрывают и открывают заново, а порт живёт
 * с плагином. Исключение — тело панели дерева: ссылка на компонент обязана быть стабильной,
 * и читается она один раз.
 *
 * @module plugins/base/files/host-from-context
 */

import {
  DocumentsServiceToken,
  HostMessagesCapability,
  isTextMediaType,
  resourceNameOf,
  useTranslate,
  WorkspaceFilesServiceToken,
  WorkspaceTreeCapability,
  type Disposable,
  type HostMessagesService,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import type { FilesHost, Translate } from './host';

const NOOP: Disposable = Object.freeze({ dispose: () => {} });

/** Словаря оболочки нет — показывают сам ключ: читаемо для разработчика, и ничего не падает. */
const NO_MESSAGES: HostMessagesService = Object.freeze({
  locale: '',
  t: (key: string) => key,
  diagnosticMessage: (code: string) => code,
  onDidChangeLocale: () => NOOP,
});

export function filesHostFromContext(ctx: Pick<PluginContext, 'services' | 'i18n'>): FilesHost {
  const documents = () => ctx.services.get(DocumentsServiceToken);
  const messages = () => ctx.services.get(HostMessagesCapability) ?? NO_MESSAGES;
  const tree = () => ctx.services.get(WorkspaceTreeCapability);

  // Именованные функции: правила хуков опознают хук по имени объявления.
  function useFilesTranslate(): Translate {
    return useTranslate(ctx.i18n);
  }

  // Коды находок переводит словарь ВЛАДЕЛЬЦА кода, а не плагина файлов: одна ошибка обязана
  // звучать одинаково в панели проблем, в подчёркивании редактора кода и на узле канваса.
  // Чей словарь и какая приставка — знает служба; сюда приходит голый код.
  function useDiagnosticMessage(): Translate {
    const source = messages();
    // Подписка на смену локали: значение нужно не переводу, а перерисовке.
    useTranslate(source);
    return (code, params) => source.diagnosticMessage(code, params);
  }

  // Заголовок исправления — ГОТОВЫЙ ключ словаря оболочки, без приставки: у исправления нет кода.
  function useQuickFixTitle(): Translate {
    return useTranslate(messages());
  }

  return {
    ResourceTreePanel: tree()?.Panel,
    useTranslate: useFilesTranslate,
    useDiagnosticMessage,
    useQuickFixTitle,

    hasProject: () => documents()?.hasProject() ?? false,

    // Без этого строки панели проблем — список, а не навигация. Открываем НЕ в режиме
    // предпросмотра: человек пришёл чинить находку, а не посмотреть, и вкладка обязана
    // остаться после следующего щелчка.
    openResource(id: ResourceId) {
      void documents()
        ?.open(id, { preview: false })
        .catch((error: unknown) => {
          console.error(`[files] переход к «${id}» не удался`, error);
        });
    },

    documentOf: (id: ResourceId) => documents()?.documentOf(id) ?? null,

    // Имя закрытого ресурса — разбором адреса платформой: панель проблем показывает и находки
    // сайдкара, вкладки которого нет, и подписывать их сырым адресом было бы нечитаемо.
    nameOf: (id: ResourceId) => {
      try {
        return resourceNameOf(id);
      } catch {
        // Адрес, который платформа не разобрала, остаётся подписан самим собой.
        return null;
      }
    },

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
