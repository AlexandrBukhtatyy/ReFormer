/**
 * Ядро ассистента — машиночитаемая поверхность операций редактора.
 *
 * Ядро чистое: не импортирует ни React, ни состояние приложения. Всё, чего у него нет —
 * каталог активного кита, корпус знаний, канал к модели, — приходит входом. Мост к рабочей
 * области и командам живёт выше и в этот слой не заглядывает.
 *
 * @module plugins/ai/core
 */

export * from './types';
export * from './node-ref';
export * from './outline';
export * from './catalog-digest';
export * from './changeset';
export * from './layout';
export * from './loop';
export * from './registry';
export { systemPrompt } from './prompt';
export { commitMutation, type OpDescription } from './gate';
export { insertSlotOf } from './slots';
export { similarNames } from './suggest';
export {
  validateSchema,
  type LoadValidateForm,
  type ValidateFormSchema,
  type ValidationResult,
  type ValidateOptions,
} from './validate';
export { allTools, readOnlyTools, WRITE_TOOLS, type ToolsOptions } from './tools';

import { createToolRegistry, type ToolRegistry } from './registry';
import { allTools, readOnlyTools, type ToolsOptions } from './tools';

/** Полная поверхность редактора: чтение и запись. */
export function createEditorToolRegistry(options: ToolsOptions = {}): ToolRegistry {
  return createToolRegistry(allTools(options));
}

/** Только чтение — для сценариев, где правки запрещены. */
export function createReadOnlyToolRegistry(options: ToolsOptions = {}): ToolRegistry {
  return createToolRegistry(readOnlyTools(options));
}
