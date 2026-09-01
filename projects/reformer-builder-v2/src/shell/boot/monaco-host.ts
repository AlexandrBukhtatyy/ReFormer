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
 * @module app/monaco-host
 */

import { isTextMediaType, type ResourceId } from '@/shell/platform/primitives/resource';
import type { DiagnosticsService } from '@/shell/platform/diagnostics/service';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useLocale } from '@/shell/platform/ui/usePanels';
import type { MonacoDocument, MonacoHost, Translate } from '@/plugins/editor-monaco/host';
import { MONACO_PLUGIN_ID } from '@/plugins/editor-monaco';
import type { ProjectHost } from './project';

export interface MonacoHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  readonly diagnostics: DiagnosticsService;
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
 * Перевод кода диагностики словарём Host. Приставка `errors.` — здесь, а не в плагине.
 *
 * Экспортируется и переиспользуется тремя портами (Monaco, редактор схемы, дерево файлов):
 * одна и та же ошибка обязана выглядеть одинаково в подчёркивании, на узле канваса,
 * значком в дереве и строкой в панели проблем. Скопируй эту функцию в каждый порт —
 * и приставка разъедется на первой же правке раскладки словаря.
 */
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

export function makeUseDiagnosticMessage(i18n: RootI18nService): () => Translate {
  function useDiagnosticMessage(): Translate {
    useLocale(i18n);
    return (code, params) => i18n.t(`errors.${code}`, params);
  }
  return useDiagnosticMessage;
}

export function createMonacoHost(deps: MonacoHostDeps): MonacoHost {
  const { project, i18n, diagnostics } = deps;

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

    // Свод диагностик платформы отдаётся плагину напрямую: `MonacoDiagnostics` — это в точности
    // читающая половина `DiagnosticsService`, и оборачивать её значило бы завести второй канал.
    diagnostics,

    // Уход фокуса из редактора — момент, когда откладывать перерисовку буфера по модели больше
    // не из-за чего. У текстового документа ручки нет, и `undefined` здесь означает «отложенного
    // не было»: `flush?.()` в плагине уже написан на этот случай.
    flush: (id) => project.get()?.models.handleOf(id)?.flush(),
  };
}
