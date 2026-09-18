/**
 * Идентификаторы плагина демо-стека — листом без импортов значений: композиция берёт их,
 * не втягивая плагин в стартовый граф.
 *
 * @module plugins/plain/contract
 */

import manifest from './manifest.json';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const PLAIN_PLUGIN_ID = manifest.id;

/** Провайдер модели: по нему поверхность и валидатор узнают документ стека. */
export const PLAIN_PROVIDER_ID = 'plain.form';
export const PLAIN_SURFACE_ID = 'plain.native';
export const PLAIN_EDITOR_ID = 'plain.editor';
export const PLAIN_VALIDATOR_ID = 'plain.check';

export const PLAIN_NEW_COMMAND_ID = 'plain.new';
export const PLAIN_EXPORT_COMMAND_ID = 'plain.export';
export const PLAIN_ADD_FIELD_COMMAND_ID = 'plain.addField';

/** Имя файла новой формы и расширение, по которому её узнаёт дерево. */
export const PLAIN_FILE_SUFFIX = '.plain.json';
