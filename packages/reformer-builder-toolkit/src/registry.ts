/**
 * Вход `@reformer/builder-toolkit/registry`: реестр инструментов модели.
 *
 * Отдельно от главного входа: реестр грузит ajv отложенным импортом, а сборщик плагина выносит
 * такой импорт в чанк каждому, кто импортирует модуль с ним. Здесь его берут только те, кто реестр
 * действительно строит, — ассистент и тесты инструментов стека.
 *
 * @module @reformer/builder-toolkit/registry
 */

export {
  createToolRegistry,
  TOOL_TEXT_BUDGET,
  type RegistryOutcome,
  type RegistryTool,
  type ToolRegistry,
  type ToolRegistryOptions,
} from './assistant/registry';
