/**
 * Инструменты редактора: чтение и запись.
 *
 * Write-инструменты 1:1 ложатся на `model/mutate` и возвращают новую схему ЧЕРНОВИКА — активную
 * вкладку они не трогают. Единственная их общая логика (гейт качества, журнал операций) живёт в
 * `agent/core/gate`, а не размазана по файлам.
 *
 * @module reformer-builder/agent/core/tools
 */

import type { AgentTool } from '../types';
import { describeComponentTool } from './describe-component';
import { duplicateNodeTool } from './duplicate-node';
import { getFormNode } from './get-form-node';
import { getFormOutline } from './get-form-outline';
import { groupNodesTool } from './group-nodes';
import { insertNodeTool } from './insert-node';
import { listComponentsTool } from './list-components';
import { reformerDocsTool } from './reformer-docs';
import { moveNodeTool } from './move-node';
import { removeNodeTool } from './remove-node';
import { setFormRulesTool } from './set-form-rules';
import { setLayoutTool } from './set-layout';
import { setRenderRulesTool } from './set-render-rules';
import { setNodeModelTool } from './set-node-model';
import { setNodePropTool } from './set-node-prop';
import { validateForm } from './validate-form';

export {
  describeComponentTool,
  duplicateNodeTool,
  getFormNode,
  getFormOutline,
  groupNodesTool,
  insertNodeTool,
  listComponentsTool,
  moveNodeTool,
  reformerDocsTool,
  removeNodeTool,
  setFormRulesTool,
  setLayoutTool,
  setNodeModelTool,
  setNodePropTool,
  setRenderRulesTool,
  validateForm,
};

/** Инструменты, не меняющие схему. */
export const READ_ONLY_TOOLS: readonly AgentTool[] = [
  getFormOutline,
  getFormNode,
  listComponentsTool,
  describeComponentTool,
  validateForm,
  reformerDocsTool,
];

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
export const ALL_TOOLS: readonly AgentTool[] = [...READ_ONLY_TOOLS, ...WRITE_TOOLS];
