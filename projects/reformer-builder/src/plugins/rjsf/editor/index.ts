/**
 * Редактор домена RJSF: провайдер модели, валидатор, редактор формы и команды.
 *
 * @module plugins/rjsf/editor
 */

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
