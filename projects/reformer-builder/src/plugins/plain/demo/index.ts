/**
 * Демо-стек: плагин, который доказывает, что билдер принимает стек не-ReFormer.
 *
 * @module plugins/plain/demo
 */

import { createPlainPlugin } from './plugin';

export { createPlainPlugin, PLAIN_EDITOR_PRIORITY, PLAIN_PLUGIN_ID } from './plugin';
export {
  PLAIN_ADD_FIELD_COMMAND_ID,
  PLAIN_EDITOR_ID,
  PLAIN_EXPORT_COMMAND_ID,
  PLAIN_NEW_COMMAND_ID,
  PLAIN_PROVIDER_ID,
  PLAIN_REDO_COMMAND_ID,
  PLAIN_SURFACE_ID,
  PLAIN_UNDO_COMMAND_ID,
  PLAIN_VALIDATOR_ID,
} from './contract';
export { PLAIN_MESSAGES } from './messages';
export type { ExportOutcome, PlainServices } from './commands';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Портов оболочки плагину не нужно: всё он берёт возможностями в `activate`.
 */
export default function builtin() {
  return createPlainPlugin();
}
