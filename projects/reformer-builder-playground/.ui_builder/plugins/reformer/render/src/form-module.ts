/**
 * Место модуля формы ReFormer — вклад стека в точку `FormModulePoint`.
 *
 * Где лежит модуль, знает раскладка домена (`moduleRootOfDocument`): документ в `<модуль>/schema/`
 * — модуль в родителе папки, документ с каноническим именем в корне модуля — модуль в его
 * каталоге, документ со свободным именем (`forms/credit.schema.json`) — подкаталог по имени
 * документа (`forms/credit/`), куда модуль печатает кодоген. По этому ответу модуль ищут общие
 * плагины, которые стека не знают: жизнь состояния превью (`forms/preview`) и превью приложением
 * (`base/app-preview`). Своим правилом «каталог документа» они нашли бы у свободно названного
 * документа каталог, где лежат модули других форм.
 *
 * Вклад здесь, а не в кодогене: превью читает модуль по тому же правилу (`./compiling/read`), и
 * ответ нужен ровно там, где есть превью формы, — даже если кодоген выключен, а модуль написан
 * руками по той же раскладке.
 *
 * @module plugins/reformer/render/form-module
 */

import type {
  FormModuleLocator,
  ResourceId,
  WorkspaceFilesService,
} from '@reformer/builder-plugin-api';
import { moduleRootOfDocument } from '../../core/codegen';
import { isFormSchemaDocument } from '../../core/form-model';

/** Адресная арифметика рабочей области — в объёме правила. */
export type FormModuleFiles = Pick<WorkspaceFilesService, 'parentOf' | 'resolve'>;

/**
 * Вклад стека в точку мест модулей. За документ берётся, только если его разобрал провайдер модели
 * формы ReFormer: `.json` бывает схемой любого стека.
 *
 * @param files - Служба адресов; спрашивается в момент вопроса — без рабочей области документов нет.
 */
export function createFormModuleLocator(
  files: () => FormModuleFiles | undefined
): FormModuleLocator {
  return {
    moduleOf(doc): ResourceId | null {
      if (!isFormSchemaDocument(doc)) return null;
      const port = files();
      return port === undefined ? null : moduleRootOfDocument(port, doc.id, doc.ref.path);
    },
  };
}
