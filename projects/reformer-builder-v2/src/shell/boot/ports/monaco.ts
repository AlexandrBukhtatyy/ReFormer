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

import type { JsonFormSchema } from '@reformer/renderer-json';
import { isTextMediaType, type ResourceId } from '@/shell/platform/primitives/resource';
import type { DiagnosticsService } from '@/shell/platform/services/diagnostics/service';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useLocale } from '@/shell/platform/ui/chrome/usePanels';
import type { JsonPath } from '@/lib/form-model/paths';
import { indexNodePaths } from '@/lib/form-model/query';
import type { MonacoDocument, MonacoHost, Translate } from '@/plugins/editor-monaco';
import { MONACO_PLUGIN_ID } from '@/plugins/editor-monaco';
import { SCHEMA_MODEL_PROVIDER_ID } from '@/plugins/editor-schema';
import type { ProjectHost } from '@/shell/boot/project/project';

/**
 * Указатель «узел → путь» по модели, запомненный по самой модели.
 *
 * `WeakMap`, а не поле порта: модель — замороженный объект со structural sharing, и новая
 * ссылка означает новую правку; та же ссылка — тот же указатель. Разметка спрашивает пути
 * на каждое нажатие клавиши и на каждую публикацию, а обход схемы ради одного и того же
 * ответа стоил бы столько же, сколько сам показ.
 */
const nodePathsCache = new WeakMap<object, ReadonlyMap<string, JsonPath>>();

function nodePathsOf(model: JsonFormSchema): ReadonlyMap<string, JsonPath> {
  let paths = nodePathsCache.get(model);
  if (paths === undefined) {
    paths = indexNodePaths(model);
    nodePathsCache.set(model, paths);
  }
  return paths;
}

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

    // Пути узлов — только по модели, которую разобрал провайдер схемы формы: та же проверка
    // идентификатора провайдера, что в порту редактора схемы, и по той же причине — чужая
    // модель под видом схемы дала бы пути, которых в тексте нет. Расходящаяся модель
    // не отдаётся вовсе: её пути описывают текст, который человек уже переписал.
    locateNodes: (id) => {
      const handle = project.get()?.models.handleOf(id) ?? null;
      if (handle === null || handle.document.providerId !== SCHEMA_MODEL_PROVIDER_ID) return null;
      if (handle.document.getSyncState() !== 'synced') return null;
      return nodePathsOf(handle.document.getModel() as JsonFormSchema);
    },

    // Уход фокуса из редактора — момент, когда откладывать перерисовку буфера по модели больше
    // не из-за чего. У текстового документа ручки нет, и `undefined` здесь означает «отложенного
    // не было»: `flush?.()` в плагине уже написан на этот случай.
    flush: (id) => project.get()?.models.handleOf(id)?.flush(),
  };
}
