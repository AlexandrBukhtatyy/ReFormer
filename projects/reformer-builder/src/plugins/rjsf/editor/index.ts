/**
 * Редактор домена RJSF: провайдер модели, валидатор, редактор формы и команды.
 *
 * @module plugins/rjsf/editor
 */

import { createRjsfEditorPlugin } from './plugin';

export { createRjsfEditorPlugin, RJSF_EDITOR_PLUGIN_ID, RJSF_EDITOR_PRIORITY } from './plugin';
export {
  RJSF_ADD_FIELD_COMMAND_ID,
  RJSF_EDITOR_ID,
  RJSF_EXPORT_COMMAND_ID,
  RJSF_NEW_COMMAND_ID,
  RJSF_REDO_COMMAND_ID,
  RJSF_UNDO_COMMAND_ID,
  RJSF_VALIDATOR_ID,
} from './contract';
export { RJSF_EDITOR_MESSAGES } from './messages';
export type { ExportOutcome, RjsfServices } from './commands';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Портов оболочки плагину не нужно: всё он берёт возможностями в `activate`.
 */
export default function builtin() {
  return createRjsfEditorPlugin();
}
