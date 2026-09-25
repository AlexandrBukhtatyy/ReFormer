/**
 * Порт редактора Monaco, собранный из платформы.
 *
 * Тот же шов, что у `./files-host`: структурные типы плагина встречаются с настоящими вещами
 * Host ровно здесь, и компиляция этого модуля — проверка, что копии не разошлись.
 *
 * Отличие от порта файлов одно, и оно содержательное: **два разных перевода**. Заголовки
 * и подсказки редактора живут в его собственном пространстве имён, а тексты диагностик —
 * в словаре Host, потому что одна и та же ошибка обязана выглядеть одинаково в редакторе,
 * в панели проблем и в дереве. Приставку `errors.` ставит эта функция: плагин передаёт
 * голый код и о раскладке чужого словаря не знает.
 *
 * @module shell/boot/ports/monaco
 */

import {
  DocumentModelPoint,
  isTextMediaType,
  splitDiagnosticCode,
  type ExtensionRegistry,
  type ResourceId,
} from '@reformer/builder-plugin-api/internal';
import type { DiagnosticsService } from '@reformer/builder-plugin-api/internal';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useLocale } from '@reformer/builder-plugin-api/internal';
import type { MonacoDocument, MonacoHost, Translate } from '@/plugins/base/editor-monaco';
import { MONACO_PLUGIN_ID } from '@/plugins/base/editor-monaco/contract';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface MonacoHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  readonly diagnostics: DiagnosticsService;
  /** Реестр вкладов: провайдер модели документа отвечает, где в тексте его узлы. */
  readonly extensions: Pick<ExtensionRegistry, 'get'>;
}

/** Реактивный перевод в пространстве имён плагина (именованная функция — ради правил хуков). */
function makeUseTranslate(i18n: RootI18nService): () => Translate {
  const view = i18n.forPlugin(MONACO_PLUGIN_ID);
  function useTranslate(): Translate {
    useLocale(i18n);
    return (key, params) => view.t(key, params);
  }
  return useTranslate;
}

/**
 * Перевод ключа словарём Host БЕЗ приставки.
 *
 * Близнец {@link makeUseDiagnosticMessage}, и разница между ними содержательная:
 * у диагностики есть КОД, который приставка `errors.` превращает в ключ, — а у заголовка
 * быстрого исправления кода нет, есть готовый ключ. Склей мы их в одну функцию,
 * потребителю пришлось бы знать, приставляет она что-нибудь или нет.
 */
export function makeUseHostMessage(i18n: RootI18nService): () => Translate {
  function useHostMessage(): Translate {
    useLocale(i18n);
    return (key, params) => i18n.t(key, params);
  }
  return useHostMessage;
}

/**
 * Перевод кода диагностики словарём Host. Приставка `errors.` — здесь, а не в плагине.
 *
 * Экспортируется и переиспользуется тремя портами (Monaco, редактор схемы, дерево файлов):
 * одна и та же ошибка обязана выглядеть одинаково в подчёркивании, на узле канваса,
 * значком в дереве и строкой в панели проблем. Скопируй эту функцию в каждый порт —
 * и приставка разъедется на первой же правке раскладки словаря.
 */
export function makeUseDiagnosticMessage(i18n: RootI18nService): () => Translate {
  function useDiagnosticMessage(): Translate {
    useLocale(i18n);
    return (code, params) => {
      // Код с владельцем (`<plugin-id>:<code>`) переводит словарь владельца: стек, пришедший
      // плагином, в словарь оболочки не пишет, и оболочка его ошибок не знает.
      const owned = splitDiagnosticCode(code);
      return owned.pluginId === null
        ? i18n.t(`errors.${owned.code}`, params)
        : i18n.forPlugin(owned.pluginId).t(`errors.${owned.code}`, params);
    };
  }
  return useDiagnosticMessage;
}

/** Идентификаторы узлов, записанные в текст: `"$nodeId": "…"` с любыми пробелами. */
function writtenNodeIds(text: string): ReadonlySet<string> {
  return new Set([...text.matchAll(/"\$nodeId"\s*:\s*"([^"]+)"/g)].map((match) => match[1]));
}

export function createMonacoHost(deps: MonacoHostDeps): MonacoHost {
  const { project, i18n, diagnostics, extensions } = deps;

  /**
   * Ручка модели документа и провайдер, который его разобрал.
   *
   * Один поиск на все вопросы о формате: где узлы, какая схема, что подсказать. Разойдись он
   * в двух местах — подчёркивание и подсказка спрашивали бы разных провайдеров.
   */
  const modelOf = (id: ResourceId) => {
    const handle = project.get()?.models.handleOf(id) ?? null;
    if (handle === null) return null;
    const providerId = handle.document.providerId;
    const provider = extensions
      .get(DocumentModelPoint)
      .find((contribution) => contribution.value.id === providerId)?.value;
    return provider === undefined ? null : { handle, provider };
  };

  /** Составной документ, частью которого является ресурс. */
  const ownerRootOf = (id: ResourceId): ResourceId | null => {
    const opened = project.get()?.models.opened();
    if (opened === undefined) return null;
    for (const [root, handle] of opened) {
      if (handle.parts().includes(id)) return root;
    }
    return null;
  };

  const ownerOf = (id: ResourceId) => {
    const root = ownerRootOf(id);
    return root === null ? null : modelOf(root);
  };

  /**
   * Находки ресурса — вместе с находками его составного документа по узлам, лежащим в этой части.
   *
   * Валидатор проверяет СОБРАННУЮ форму и публикует находки на корень: у файла шага своей модели
   * нет, он открыт текстом. Но идентификаторы узлов записаны в текст части, и место находки
   * редактор найдёт сам — ему нужно только её увидеть. Отбор по тексту, а не по модели: вкладка
   * части показывает ровно то, что в её тексте.
   */
  const diagnosticsOf = (id: ResourceId) => {
    const own = diagnostics.get(id);
    const root = ownerRootOf(id);
    if (root === null) return own;
    const written = writtenNodeIds(project.get()?.documents.documentOf(id)?.getText() ?? '');
    const borrowed = diagnostics
      .get(root)
      .filter((item) => item.target.kind === 'node' && written.has(item.target.nodeId));
    return borrowed.length === 0 ? own : [...own, ...borrowed];
  };

  return {
    useTranslate: makeUseTranslate(i18n),
    useDiagnosticMessage: makeUseDiagnosticMessage(i18n),

    documentOf: (id: ResourceId): MonacoDocument | null =>
      project.get()?.documents.documentOf(id) ?? null,

    writeText(id: ResourceId, text: string) {
      const session = project.get();
      // Отказ, а не тишина: правка, ушедшая в никуда, выглядит как сохранённая.
      if (session === null) {
        return Promise.reject(new Error(`проект не открыт: писать некуда (${id})`));
      }
      return session.workspace.writeText(id, text);
    },

    isTextual: (mediaType: string) => isTextMediaType(mediaType),

    // Свод диагностик платформы — с одним дополнением: файл части составного документа видит
    // находки документа по своим узлам (`diagnosticsOf`). Смена находок корня — повод
    // перечитать и его части.
    diagnostics: {
      get: diagnosticsOf,
      onDidChange: (cb) =>
        diagnostics.onDidChange((resource) => {
          cb(resource);
          for (const part of project.get()?.models.handleOf(resource)?.parts() ?? []) cb(part);
        }),
    },

    // Пути узлов спрашиваются у ТОГО провайдера, который разобрал документ: путь узла —
    // знание о формате, и у оболочки его нет. Провайдер без `nodePaths` — штатный ответ
    // «не знаю». Расходящаяся модель не отдаётся вовсе: её пути описывают текст, который
    // человек уже переписал.
    locateNodes: (id) => {
      const found = modelOf(id);
      if (found === null || found.handle.document.getSyncState() !== 'synced') return null;
      return found.provider.nodePaths?.(found.handle.document.getModel()) ?? null;
    },

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
      (modelOf(id) ?? ownerOf(id))?.provider.onDidChangeJsonSchema?.(cb) ?? { dispose() {} },

    completeString: (id, site) => {
      const found = modelOf(id);
      if (found === null) return [];
      return found.provider.completeString?.(found.handle.document.getModel(), site) ?? [];
    },

    // Уход фокуса из редактора — момент, когда откладывать перерисовку буфера по модели больше
    // не из-за чего. У текстового документа ручки нет, и `undefined` здесь означает «отложенного
    // не было»: `flush?.()` в плагине уже написан на этот случай.
    flush: (id) => project.get()?.models.handleOf(id)?.flush(),
  };
}
