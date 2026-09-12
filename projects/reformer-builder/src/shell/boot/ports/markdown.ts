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
 * Тела редактора здесь больше НЕТ: режим «рядом» берёт его возможностью `editor.text`
 * у того, кто его даёт (плагин Monaco). Раньше композиция собирала вклад редактора сама
 * и передавала `Body` параметром — и вкладов получалось два, с разными телами.
 *
 * @module shell/boot/ports/markdown
 */

import { makeResourceId, type ResourceId } from '@/shell/platform/primitives/resource';
import type { MarkdownDocument, MarkdownHost } from '@/plugins/editor-markdown';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface MarkdownHostDeps {
  readonly project: ProjectHost;
}

export function createMarkdownHost(deps: MarkdownHostDeps): MarkdownHost {
  const { project } = deps;

  return {
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
  };
}
