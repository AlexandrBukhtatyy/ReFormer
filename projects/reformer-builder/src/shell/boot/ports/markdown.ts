/**
 * Порт предпросмотра markdown, собранный из платформы.
 *
 * Тот же шов, что у портов файлов и Monaco: структурные типы плагина встречаются с настоящими
 * вещами Host ровно здесь, и компиляция этого модуля — проверка, что копии не разошлись.
 *
 * ## Редактор кода одалживается у соседнего плагина — но уже НЕ через композицию
 *
 * Режиму «рядом» нужен исходник, а рисовать его умеет плагин Monaco. Тела редактора здесь
 * больше нет: markdown берёт его возможностью `reformer.editor` у того, кто её даёт, и в его
 * манифесте она записана необязательным требованием — выключенный Monaco убирает режимы
 * «рядом» и «исходник», а не оставляет пустую половину экрана.
 *
 * Раньше вклад редактора собирала композиция и передавала `Body` параметром — и вкладов
 * получалось ДВА, с разными телами: React сравнивает тип элемента по ссылке, поэтому «тот же
 * редактор» держалось лишь на том, что это разные вкладки.
 *
 * @module shell/boot/ports/markdown
 */

import { makeResourceId, type ResourceId } from '@reformer/builder-plugin-api/internal';
import type { MarkdownDocument, MarkdownHost } from '@/plugins/base/editor-markdown';
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
