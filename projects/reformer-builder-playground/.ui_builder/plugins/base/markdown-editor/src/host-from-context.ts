/**
 * Порт предпросмотра markdown из возможностей оболочки — то, что раньше собирала композиция.
 *
 * Порт ({@link MarkdownHost}) остался: предпросмотр, кэш картинок и команды пишутся против него,
 * и тест подставляет его целиком. Изменилось, КТО его собирает. Раньше — оболочка
 * (`shell/boot/ports/markdown`), и ради этого она импортировала плагин. Теперь плагин собирает
 * его сам из служб SDK:
 *
 * - активная вкладка, документ, переход по ссылке — `reformer.workspace`;
 * - байты картинки и адрес по пути от корня — `reformer.workspace.files`.
 *
 * Службы спрашиваются на КАЖДЫЙ вызов: проект закрывают и открывают заново, а порт живёт
 * с плагином.
 *
 * @module plugins/base/markdown-editor/host-from-context
 */

import {
  DocumentsServiceToken,
  WorkspaceFilesServiceToken,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import type { MarkdownHost } from './host';

export function markdownHostFromContext(ctx: Pick<PluginContext, 'services'>): MarkdownHost {
  const documents = () => ctx.services.get(DocumentsServiceToken);
  const files = () => ctx.services.get(WorkspaceFilesServiceToken);

  return {
    activeDocument: () => documents()?.activeResource() ?? null,

    documentOf: (id: ResourceId) => documents()?.documentOf(id) ?? null,

    // Картинки, которой нет, в чужом README сколько угодно: служба отвечает на это `null`,
    // а не отказом, — это состояние показа, а не сбой рабочей области.
    readBytes: (id: ResourceId) => files()?.readBytes(id) ?? Promise.resolve(null),

    // Путь считает плагин (правила markdown знает он), адрес собирает платформа: разбор
    // `ResourceId` — её дело, и вторая его реализация разошлась бы на первом же источнике
    // с другим идентификатором.
    resourceAt(document, projectPath) {
      const service = files();
      if (service === undefined) {
        // Собрать адрес нечем. Картинка тогда не покажется (кэш ловит отказ чтения), а ссылка
        // останется текстом: `openResource` без службы записей ниже не выдаётся.
        throw new Error(`записей рабочей области нет: адрес «${projectPath}» не собрать`);
      }
      return service.fromRoot(document.ref.id, projectPath);
    },

    // Переход по ссылке на соседний файл. Только там, где есть и вкладки, и адреса: иначе
    // ссылки внутри проекта остаются текстом — это видно на глаз, а не выглядит поломкой.
    ...(documents() === undefined || files() === undefined
      ? {}
      : {
          openResource(id: ResourceId) {
            // НЕ в режиме предпросмотра вкладки: человек перешёл по ссылке, чтобы читать дальше,
            // и следующий такой переход не должен занимать ту же вкладку.
            void documents()
              ?.open(id, { preview: false })
              .catch((error: unknown) => {
                console.error(`[markdown] переход по ссылке не удался: ${id}`, error);
              });
          },
        }),
  };
}
