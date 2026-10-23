/**
 * Реестр инструментов ассистента — реализация в `@reformer/builder-toolkit`, здесь он назван типами
 * инструментов ReFormer: контекст вызова — черновик схемы, ответ несёт схему и правила.
 *
 * @module plugins/reformer/ai/tools/registry
 */

import {
  createToolRegistry as createGenericRegistry,
  type ToolRegistry as GenericToolRegistry,
  type ToolRegistryOptions,
} from '@reformer/builder-toolkit';
import type { AgentTool, ToolContext, ToolOutcome } from '../model/types';

export type { ToolRegistryOptions };

/** Реестр инструментов ReFormer. */
export type ToolRegistry<C extends ToolContext = ToolContext> = GenericToolRegistry<C, ToolOutcome>;

/** Собрать реестр инструментов ReFormer. */
export function createToolRegistry<C extends ToolContext = ToolContext>(
  tools: readonly AgentTool<never, C>[],
  options: ToolRegistryOptions = {}
): ToolRegistry<C> {
  return createGenericRegistry<C, ToolOutcome>(tools, options);
}
