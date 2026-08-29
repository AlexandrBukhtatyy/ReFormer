/**
 * Инструменты редактора: чтение и запись.
 *
 * Write-инструменты 1:1 ложатся на `@/lib/form-model/mutate` и возвращают новую схему ЧЕРНОВИКА —
 * открытый документ они не трогают. Единственная их общая логика (гейт качества, журнал операций)
 * живёт в `core/gate`, а не размазана по файлам.
 *
 * ## Почему набор собирается функцией, а не лежит константой
 *
 * Ровно один инструмент зависит от того, чего у ядра нет: `ask_reformer` смотрит в корпус знаний,
 * а корпус читает файлы открытого проекта — знание Host'а. Остальные четырнадцать — чистые
 * функции над схемой и каталогом, и каталог им приходит контекстом вызова.
 *
 * Набор при этом ПОСТОЯНЕН по составу: `ask_reformer` в нём есть всегда, даже когда корпуса нет —
 * тогда он честно отвечает «справка недоступна». Иначе поверхность инструментов зависела бы от
 * состояния сборки, а храповик (`core/tool-surface.test.ts`) мерил бы разное в разных запусках.
 *
 * @module plugins/ai/core/tools
 */

import type { KnowledgeLoader } from '../../knowledge';
import type { AgentTool } from '../types';
import { describeComponentTool } from './describe-component';
import { duplicateNodeTool } from './duplicate-node';
import { getFormNode } from './get-form-node';
import { getFormOutline } from './get-form-outline';
import { groupNodesTool } from './group-nodes';
import { insertNodeTool } from './insert-node';
import { listComponentsTool } from './list-components';
import { createReformerDocsTool } from './reformer-docs';
import { moveNodeTool } from './move-node';
import { removeNodeTool } from './remove-node';
import { setFormRulesTool } from './set-form-rules';
import { setLayoutTool } from './set-layout';
import { setRenderRulesTool } from './set-render-rules';
import { setNodeModelTool } from './set-node-model';
import { setNodePropTool } from './set-node-prop';
import { validateForm } from './validate-form';

export {
  createReformerDocsTool,
  describeComponentTool,
  duplicateNodeTool,
  getFormNode,
  getFormOutline,
  groupNodesTool,
  insertNodeTool,
  listComponentsTool,
  moveNodeTool,
  removeNodeTool,
  setFormRulesTool,
  setLayoutTool,
  setNodeModelTool,
  setNodePropTool,
  setRenderRulesTool,
  validateForm,
};

/** Чем ядру приходится снабдить набор инструментов. */
export interface ToolsOptions {
  /** Корпус знаний о библиотеке; без него `ask_reformer` отвечает «недоступно». */
  knowledge?: KnowledgeLoader;
}

/** Инструменты, не меняющие схему. */
export function readOnlyTools(options: ToolsOptions = {}): readonly AgentTool[] {
  return [
    getFormOutline,
    getFormNode,
    listComponentsTool,
    describeComponentTool,
    validateForm,
    createReformerDocsTool(options.knowledge),
  ];
}

/** Инструменты, меняющие черновик схемы. */
export const WRITE_TOOLS: readonly AgentTool[] = [
  insertNodeTool,
  setNodePropTool,
  setNodeModelTool,
  removeNodeTool,
  moveNodeTool,
  duplicateNodeTool,
  groupNodesTool,
  setLayoutTool,
  setFormRulesTool,
  setRenderRulesTool,
];

/** Полная поверхность редактора. */
export function allTools(options: ToolsOptions = {}): readonly AgentTool[] {
  return [...readOnlyTools(options), ...WRITE_TOOLS];
}
