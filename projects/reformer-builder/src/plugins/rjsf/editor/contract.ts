/**
 * Идентификаторы редактора RJSF — листом без импортов значений: композиция берёт их, не втягивая
 * плагин в стартовый граф.
 *
 * Провайдер модели (`rjsf.form`) объявлен ядром домена: по нему документ узнают и редактор,
 * и поверхность превью другого плагина.
 *
 * @module plugins/rjsf/editor/contract
 */

import manifest from './manifest.json';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const RJSF_EDITOR_PLUGIN_ID = manifest.id;

export const RJSF_EDITOR_ID = 'rjsf.editor';
export const RJSF_VALIDATOR_ID = 'rjsf.check';

export const RJSF_NEW_COMMAND_ID = 'rjsf.new';
export const RJSF_ADD_FIELD_COMMAND_ID = 'rjsf.addField';
export const RJSF_UNDO_COMMAND_ID = 'rjsf.undo';
export const RJSF_REDO_COMMAND_ID = 'rjsf.redo';
export const RJSF_EXPORT_COMMAND_ID = 'rjsf.export';

/** Имя файла новой формы и расширение, по которому её узнаёт дерево. */
export const RJSF_FILE_SUFFIX = '.rjsf.json';
