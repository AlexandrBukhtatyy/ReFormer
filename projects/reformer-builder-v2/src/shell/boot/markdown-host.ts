/**
 * Порт предпросмотра markdown, собранный из платформы.
 *
 * Тот же шов, что у портов файлов и Monaco: структурные типы плагина встречаются с настоящими
 * вещами Host ровно здесь, и компиляция этого модуля — проверка, что копии не разошлись.
 *
 * ## Редактор кода одалживается у соседнего плагина — и это делает композиция
 *
 * Режиму «рядом» нужен исходник, а рисовать его умеет плагин Monaco. Плагины друг друга
 * не импортируют, поэтому тело редактора собирается ЗДЕСЬ (`monacoEditorContribution(...).Body`)
 * и отдаётся markdown как обычный компонент. Реестры фокуса и снимков вида передаются те же,
 * что у обычной code-вкладки: иначе позиция курсора терялась бы при каждом переключении
 * режима, а «в фокусе ли редактор» имело бы два разных ответа — и ход ассистента затирал бы
 * набранное на полуслове.
 *
 * @module app/markdown-host
 */

import { makeResourceId, type ResourceId } from '@/shell/platform/primitives/resource';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useLocale } from '@/shell/platform/ui/usePanels';
import { monacoEditorContribution, type MonacoFocusRegistry } from '@/plugins/editor-monaco';
import type { ViewStateRegistry } from '@/plugins/editor-monaco';
import type { MonacoHost } from '@/plugins/editor-monaco/host';
import { MARKDOWN_PLUGIN_ID } from '@/plugins/editor-markdown';
import type { MarkdownDocument, MarkdownHost, Translate } from '@/plugins/editor-markdown/host';
import type { ProjectHost } from './project';

export interface MarkdownHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  /**
   * Порт Monaco и его реестры — ровно те же, что у самого плагина Monaco.
   *
   * Необязательны: без них markdown работает, но показывает только рендер. Это законная
   * сборка (Monaco выключен плагином-каталогом), а не поломка, и человек видит её как
   * отсутствие кнопки «рядом», а не как пустую половину экрана.
   */
  readonly monaco?: {
    readonly host: MonacoHost;
    readonly focus: MonacoFocusRegistry;
    readonly viewStates: ViewStateRegistry;
  };
}

/** Реактивный перевод в пространстве имён плагина (именованная функция — ради правил хуков). */
function makeUseTranslate(i18n: RootI18nService): () => Translate {
  const view = i18n.forPlugin(MARKDOWN_PLUGIN_ID);
  function useTranslate(): Translate {
    useLocale(i18n);
    return (key, params) => view.t(key, params);
  }
  return useTranslate;
}

export function createMarkdownHost(deps: MarkdownHostDeps): MarkdownHost {
  const { project, i18n, monaco } = deps;

  // Тело редактора берётся один раз, и это не оптимизация: React сравнивает тип элемента
  // по ссылке, поэтому новая функция на каждой отрисовке — это размонтирование Monaco
  // и монтирование заново, то есть потеря курсора и набранного. Здесь стояла обёртка,
  // создававшая `Body` внутри себя на каждый вызов, — она это и делала.
  const TextEditor =
    monaco === undefined
      ? undefined
      : monacoEditorContribution({
          host: monaco.host,
          focus: monaco.focus,
          viewStates: monaco.viewStates,
        }).Body;

  return {
    useTranslate: makeUseTranslate(i18n),

    activeDocument: () => project.get()?.documents.get().activeId ?? null,

    documentOf(id: ResourceId): MarkdownDocument | null {
      return project.get()?.documents.documentOf(id) ?? null;
    },

    async readBytes(id: ResourceId): Promise<Uint8Array | null> {
      const session = project.get();
      if (session === null) return null;
      try {
        return await session.workspace.readBytes(id);
      } catch {
        // Картинки, которой нет, в чужом README сколько угодно: это состояние показа,
        // а не сбой рабочей области.
        return null;
      }
    },

    // Путь считает плагин (правила markdown знает он), адрес собирает платформа: разбор
    // `ResourceId` — её дело, и вторая его реализация разошлась бы на первом же источнике
    // с другим идентификатором.
    resourceAt: (document, projectPath) => makeResourceId(document.ref.sourceId, projectPath),

    openResource(id: ResourceId) {
      const session = project.get();
      if (session === null) return;
      // НЕ в режиме предпросмотра вкладки: человек перешёл по ссылке, чтобы читать дальше,
      // и следующий такой переход не должен занимать ту же вкладку.
      void session.documents.open(id, { preview: false }).catch((error: unknown) => {
        console.error(`[markdown] переход по ссылке не удался: ${id}`, error);
      });
    },

    TextEditor,
  };
}
