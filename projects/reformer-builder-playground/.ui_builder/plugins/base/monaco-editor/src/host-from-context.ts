/**
 * Порт редактора Monaco из возможностей оболочки — то, что раньше собирала композиция.
 *
 * Порт ({@link MonacoHost}) остался: тело редактора пишется против него, и тест подставляет его
 * целиком. Изменилось, КТО его собирает. Раньше — оболочка (`shell/boot/ports/monaco`), и ради
 * этого она импортировала плагин; внешнему редактору такой порт не собрал бы никто. Теперь
 * плагин собирает его сам:
 *
 * - документ вкладки, запись в рабочую копию, отложенная перерисовка — `reformer.workspace`;
 * - свод находок — служба диагностик;
 * - ручка модели и «чьей частью является файл» — `reformer.workspace.models`;
 * - знание формата (пути узлов, ключи узла, схема, подсказки) — провайдер модели документа,
 *   вклад в точку `DocumentModelPoint`;
 * - перевод кодов находок — словарь оболочки (`reformer.host.messages`).
 *
 * Службы спрашиваются на КАЖДЫЙ вызов: проект закрывают и открывают заново, провайдер модели
 * приносит плагин, который могут выключить, а порт живёт с редактором.
 *
 * @module plugins/base/monaco-editor/host-from-context
 */

import {
  DiagnosticsServiceToken,
  DocumentModelPoint,
  DocumentModelsCapability,
  DocumentsServiceToken,
  HostMessagesCapability,
  isTextMediaType,
  useTranslate,
  type Diagnostic,
  type Disposable,
  type HostMessagesService,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { indexTextNodes } from './diagnostics/node-ranges';
import type { MonacoHost, Translate } from './host';

const NOOP: Disposable = Object.freeze({ dispose: () => {} });
const NO_DIAGNOSTICS: readonly Diagnostic[] = Object.freeze([]);

/** Словаря оболочки нет — показывают сам код: читаемо для разработчика, и ничего не падает. */
const NO_MESSAGES: HostMessagesService = Object.freeze({
  locale: '',
  t: (key: string) => key,
  diagnosticMessage: (code: string) => code,
  onDidChangeLocale: () => NOOP,
});

export function monacoHostFromContext(
  ctx: Pick<PluginContext, 'services' | 'extensions' | 'i18n'>
): MonacoHost {
  const documents = () => ctx.services.get(DocumentsServiceToken);
  const models = () => ctx.services.get(DocumentModelsCapability);
  const diagnostics = () => ctx.services.get(DiagnosticsServiceToken);
  const messages = () => ctx.services.get(HostMessagesCapability) ?? NO_MESSAGES;

  /**
   * Ручка модели документа и провайдер, который его разобрал.
   *
   * Один поиск на все вопросы о формате: где узлы, какая схема, что подсказать. Разойдись он
   * в двух местах — подчёркивание и подсказка спрашивали бы разных провайдеров.
   */
  const modelOf = (id: ResourceId) => {
    const handle = models()?.handleOf(id) ?? null;
    if (handle === null) return null;
    const providerId = handle.document.providerId;
    const provider = ctx.extensions
      .get(DocumentModelPoint)
      .find((contribution) => contribution.value.id === providerId)?.value;
    return provider === undefined ? null : { handle, provider };
  };

  /** Составной документ, частью которого является ресурс, — вместе со своим провайдером. */
  const ownerOf = (id: ResourceId) => {
    const root = models()?.ownerOf(id) ?? null;
    return root === null ? null : modelOf(root);
  };

  const nodeAnchorFor = (id: ResourceId) =>
    (modelOf(id) ?? ownerOf(id))?.provider.nodeAnchor ?? null;

  /**
   * Находки ресурса — вместе с находками его составного документа по узлам, лежащим в этой части.
   *
   * Валидатор проверяет СОБРАННУЮ форму и публикует находки на корень: у файла шага своей модели
   * нет, он открыт текстом. Но идентификаторы узлов записаны в текст части, и место находки
   * редактор найдёт сам — ему нужно только её увидеть. Отбор по тексту, а не по модели: вкладка
   * части показывает ровно то, что в её тексте. Каким ключом идентификатор записан — говорит
   * провайдер документа-владельца; без его слова заимствовать нечего.
   */
  const diagnosticsOf = (id: ResourceId): readonly Diagnostic[] => {
    const service = diagnostics();
    if (service === undefined) return NO_DIAGNOSTICS;
    const own = service.get(id);
    const root = models()?.ownerOf(id) ?? null;
    if (root === null) return own;
    const anchor = modelOf(root)?.provider.nodeAnchor ?? null;
    if (anchor === null) return own;
    const text = documents()?.documentOf(id)?.getText() ?? '';
    const written = indexTextNodes(text, anchor).byId;
    const borrowed = service
      .get(root)
      .filter((item) => item.target.kind === 'node' && written.has(item.target.nodeId));
    return borrowed.length === 0 ? own : [...own, ...borrowed];
  };

  // Именованные функции: правила хуков опознают хук по имени объявления.
  function useMonacoTranslate(): Translate {
    return useTranslate(ctx.i18n);
  }

  // Коды находок переводит словарь ВЛАДЕЛЬЦА кода, а не редактора: одна ошибка обязана
  // выглядеть одинаково в подчёркивании, в панели проблем и на узле канваса. Чей словарь
  // и какая приставка — знает служба; редактор передаёт голый код.
  function useDiagnosticMessage(): Translate {
    const source = messages();
    // Подписка на смену локали: значение нужно не переводу, а перерисовке.
    useTranslate(source);
    return (code, params) => source.diagnosticMessage(code, params);
  }

  return {
    useTranslate: useMonacoTranslate,
    useDiagnosticMessage,

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

    // Свод диагностик платформы — с одним дополнением: файл части составного документа видит
    // находки документа по своим узлам (`diagnosticsOf`). Смена находок корня — повод
    // перечитать и его части.
    diagnostics: {
      get: diagnosticsOf,
      onDidChange: (cb) =>
        diagnostics()?.onDidChange((resource) => {
          cb(resource);
          for (const part of models()?.partsOf(resource) ?? []) cb(part);
        }) ?? NOOP,
    },

    // Пути узлов спрашиваются у ТОГО провайдера, который разобрал документ: путь узла —
    // знание о формате, и у редактора его нет. Провайдер без `nodePaths` — штатный ответ
    // «не знаю». Расходящаяся модель не отдаётся вовсе: её пути описывают текст, который
    // человек уже переписал.
    locateNodes: (id) => {
      const found = modelOf(id);
      if (found === null || found.handle.document.getSyncState() !== 'synced') return null;
      return found.provider.nodePaths?.(found.handle.document.getModel()) ?? null;
    },

    nodeAnchorFor,

    // Подсказки — у того же провайдера. Расхождение модели здесь НЕ отказ, в отличие от путей
    // узлов: подсказка нужна ровно пока человек печатает, а пути модели из последнего удачного
    // разбора годятся и для недописанного текста.
    // Файл части (шаг разбитой формы) своей модели не имеет — открыт текстом, — и подсказку
    // ему даёт провайдер документа, частью которого он является.
    jsonSchemaFor: (id) => {
      const own = modelOf(id);
      if (own !== null) return own.provider.jsonSchema?.() ?? null;
      return ownerOf(id)?.provider.composition?.partJsonSchema?.() ?? null;
    },

    onDidChangeJsonSchema: (id, cb) =>
      (modelOf(id) ?? ownerOf(id))?.provider.onDidChangeJsonSchema?.(cb) ?? NOOP,

    completeString: (id, site) => {
      const found = modelOf(id);
      if (found === null) return [];
      return found.provider.completeString?.(found.handle.document.getModel(), site) ?? [];
    },

    // Уход фокуса из редактора — момент, когда откладывать перерисовку буфера по модели больше
    // не из-за чего. У текстового документа откладывать нечего, и служба на это отвечает сама.
    flush: (id) => documents()?.flush(id),
  };
}
