/**
 * Демо-стек: плагин, который доказывает, что билдер принимает стек не-ReFormer.
 *
 * @module plugins/plain
 */

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
