/**
 * Публичная поверхность валидатора схемы: то, что берёт композиция, и ничего больше.
 *
 * Разбор структуры, коды ошибок, поиск ближайшего узла и перевод сообщений — внутреннее.
 * Валидатор был первым потребителем `@reformer/builder-plugin-api`, и состав этого файла ровно поэтому короткий:
 * композиция только создаёт плагин, всё остальное он берёт из контекста сам.
 *
 * @module plugins/reformer/validator/index
 */

import { createSchemaValidatorPlugin } from './plugin';

export { createSchemaValidatorPlugin, SCHEMA_VALIDATOR_PLUGIN_ID } from './plugin';
export type { SchemaValidatorOptions } from './plugin';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Портов оболочки плагину не нужно: всё он берёт возможностями в `activate`.
 */
export default function builtin() {
  return createSchemaValidatorPlugin({});
}
