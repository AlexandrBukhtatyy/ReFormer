/**
 * Инструменты режима файлов: модель правит файлы модуля формы напрямую.
 *
 * Четыре файловых инструмента и три из структурного набора, которым файлы ничего не заменяют:
 * словарь кита (`list_components`), свойства и скелет компонента (`describe_component` — скелет
 * здесь готовым JSON узла) и справка по библиотеке (`ask_reformer`). Без словаря модель
 * выдумывала бы имена компонентов, а без скелета — собирала бы составные компоненты по частям,
 * то есть ровно то, от чего структурный режим её защищал.
 *
 * Состав постоянен, как и у структурного набора: поверхность меряется храповиком
 * (`../tool-surface.test.ts`), и зависеть от состояния сборки она не должна.
 *
 * @module plugins/reformer/ai/tools/files
 */

import type { FormToolSlot } from '@reformer/builder-plugin-api';
import type { KnowledgeLoader } from '../../knowledge';
import type { FileToolContext } from '../../files/turn';
import type { AgentTool } from '../../model/types';
import { createDescribeComponentTool } from '../describe-component';
import { listComponentsTool } from '../list-components';
import { createReformerDocsTool } from '../reformer-docs';
import { createToolRegistry, type ToolRegistry } from '../registry';
import { editFileTool } from './edit-file';
import { listFilesTool } from './list-files';
import { readFileTool } from './read-file';
import { writeFileTool } from './write-file';

export { editFileTool, listFilesTool, readFileTool, writeFileTool };

/** Бюджет ответа `describe_component` в режиме файлов: JSON-скелет длиннее дайджеста. */
const DESCRIBE_BUDGET = 3000;

/** `describe_component` со скелетом готовым JSON узла. */
export const describeComponentFileTool = createDescribeComponentTool({
  skeleton: 'json',
  budget: DESCRIBE_BUDGET,
  inspect: 'read its node in the form document',
});

/** Полный набор режима файлов. */
export function fileModeTools(
  options: { knowledge?: KnowledgeLoader } = {}
): readonly AgentTool<never, FileToolContext>[] {
  return [
    listFilesTool,
    readFileTool,
    editFileTool,
    writeFileTool,
    listComponentsTool,
    describeComponentFileTool,
    createReformerDocsTool(options.knowledge),
  ];
}

/**
 * Инструменты режима файлов, как их видит модель, — по порядку: файловые и словарь кита, затем
 * инструменты ассистента по имени (см. `structuredSlots`).
 */
export function fileModeSlots(
  options: { knowledge?: KnowledgeLoader } = {}
): readonly FormToolSlot[] {
  return [...fileModeTools(options), 'ask_user', 'generate_code', 'create_form'];
}

/** Реестр режима файлов. */
export function createFileToolRegistry(
  options: { knowledge?: KnowledgeLoader } = {}
): ToolRegistry<FileToolContext> {
  return createToolRegistry<FileToolContext>(fileModeTools(options));
}
