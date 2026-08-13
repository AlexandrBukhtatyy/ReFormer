/**
 * `get_form_outline` — карта открытой формы. Основной способ «увидеть» схему.
 *
 * @module reformer-builder/agent/core/tools/get-form-outline
 */

import { buildOutline, renderOutline } from '../outline';
import { ok, TOOL_TEXT_BUDGET, type AgentTool } from '../types';

/** Карта формы: по строке на узел — адрес, компонент, модель, подпись. */
export const getFormOutline: AgentTool = {
  name: 'get_form_outline',
  description:
    'Карта текущей формы: по строке на узел — JSON Pointer (адрес для остальных инструментов), ' +
    'имя компонента, путь модели и подпись. Вызывай ПЕРВЫМ при работе с существующей формой. ' +
    'Полный JSON отдельного узла запрашивай через get_form_node.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  run(_params, ctx) {
    return ok(renderOutline(buildOutline(ctx.draft), TOOL_TEXT_BUDGET));
  },
};
