/**
 * Реестр инструментов ассистента — реализация в `@reformer/builder-toolkit/registry`, здесь он
 * назван типами инструментов ReFormer: контекст вызова — черновик схемы, ответ несёт схему и
 * правила.
 *
 * ## Реестры стека — для тестов и замеров, и только отсюда
 *
 * Реестр в работе строит ассистент (`forms/ai`) из слотов стека; стеку свой реестр нужен лишь
 * тестам и замерам, которые зовут инструменты без ассистента. Поэтому фабрики живут здесь, а не
 * рядом с наборами (`./index`, `./files`): рабочий граф стека этот модуль не импортирует, и в его
 * сборку не едет ни реестр, ни отложенная загрузка ajv, которую реестр несёт.
 *
 * @module plugins/reformer/ai/tools/registry
 */

import type {
  ToolRegistry as GenericToolRegistry,
  ToolRegistryOptions,
} from '@reformer/builder-toolkit';
import { createToolRegistry as createGenericRegistry } from '@reformer/builder-toolkit/registry';
import type { ResolveLibraryReference } from '../reference';
import type { FileToolContext } from '../files/turn';
import type { AgentTool, ToolContext, ToolOutcome } from '../model/types';
import { allTools, readOnlyTools, type ToolsOptions } from './index';
import { fileModeTools } from './files/index';

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

/** Реестр структурного режима: чтение и запись. */
export function createEditorToolRegistry(options: ToolsOptions = {}): ToolRegistry {
  return createToolRegistry(allTools(options));
}

/** Только чтение — для сценариев, где правки запрещены. */
export function createReadOnlyToolRegistry(options: ToolsOptions = {}): ToolRegistry {
  return createToolRegistry(readOnlyTools(options));
}

/** Реестр режима файлов. */
export function createFileToolRegistry(
  options: { reference?: ResolveLibraryReference } = {}
): ToolRegistry<FileToolContext> {
  return createToolRegistry<FileToolContext>(fileModeTools(options));
}
