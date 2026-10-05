/**
 * Модели открытых документов — служба `reformer.workspace.models`, собранная из платформы.
 *
 * Ручку отдаёт ЛЮБОЙ модели с `unknown`: оболочка держит провайдеров разом несколько и ни об
 * одной модели ничего не знает, а сужает ручку сам плагин, сверив `providerId`. Раньше ручку
 * отдавал порт редактора схемы, и оболочка знала, какой провайдер чей.
 *
 * Два вопроса о составных документах — «чьей частью является файл» и «из чего документ собран» —
 * нужны тому, кто показывает ЧАСТЬ: файл шага своей модели не имеет и открыт текстом, а находки
 * и подсказки ему даёт документ, в который он входит.
 *
 * Сессия читается в момент вызова: проект закрывают и открывают заново, а служба
 * регистрируется один раз на запуск.
 *
 * @module shell/boot/ports/document-models
 */

import type { DocumentModelsService, ResourceId } from '@reformer/builder-plugin-api/internal';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface DocumentModelsDeps {
  readonly project: Pick<ProjectHost, 'get'>;
}

/** Пустой состав частей: одна ссылка вместо нового массива на каждый вопрос. */
const NO_PARTS: readonly ResourceId[] = Object.freeze([]);

export function createDocumentModelsService(deps: DocumentModelsDeps): DocumentModelsService {
  const models = () => deps.project.get()?.models;

  return {
    handleOf: (id) => models()?.handleOf(id) ?? null,

    // Файл части своей модели не имеет: его находит составной документ, перечисляющий части.
    ownerOf: (id) => {
      for (const [root, handle] of models()?.opened() ?? []) {
        if (handle.parts().includes(id)) return root;
      }
      return null;
    },

    partsOf: (id) => models()?.handleOf(id)?.parts() ?? NO_PARTS,
  };
}
