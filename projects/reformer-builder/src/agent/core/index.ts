/**
 * Слой `agent/core` — машиночитаемая поверхность операций редактора.
 *
 * Ядро чистое: не импортирует ни React, ни `store/`. Мост к редактору (применение набора изменений
 * через `editorActions.replaceSchema`) живёт выше и появляется этапом 3.
 *
 * @module reformer-builder/agent/core
 */

export * from './types';
export * from './node-ref';
export * from './outline';
export * from './catalog-digest';
export * from './changeset';
export * from './layout';
export * from './loop';
export * from './registry';
export { SYSTEM_PROMPT } from './prompt';
export { commitMutation, type OpDescription } from './gate';
export { insertSlotOf } from './slots';
export { similarNames } from './suggest';
export { ALL_TOOLS, READ_ONLY_TOOLS, WRITE_TOOLS } from './tools';

import { createToolRegistry, type ToolRegistry } from './registry';
import { ALL_TOOLS, READ_ONLY_TOOLS } from './tools';

/** Полная поверхность редактора: чтение и запись. */
export function createEditorToolRegistry(): ToolRegistry {
  return createToolRegistry(ALL_TOOLS);
}

/** Только чтение — для сценариев, где правки запрещены. */
export function createReadOnlyToolRegistry(): ToolRegistry {
  return createToolRegistry(READ_ONLY_TOOLS);
}
