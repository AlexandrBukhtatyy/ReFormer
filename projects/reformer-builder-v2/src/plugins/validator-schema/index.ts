/**
 * Публичная поверхность валидатора схемы: то, что берёт композиция, и ничего больше.
 *
 * Разбор структуры, коды ошибок, поиск ближайшего узла и перевод сообщений — внутреннее.
 * Валидатор был первым потребителем `@/sdk`, и состав этого файла ровно поэтому короткий:
 * композиция только создаёт плагин, всё остальное он берёт из контекста сам.
 *
 * @module plugins/validator-schema/index
 */

export { createSchemaValidatorPlugin, SCHEMA_VALIDATOR_PLUGIN_ID } from './plugin';
export type { SchemaValidatorOptions } from './plugin';
