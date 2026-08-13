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
    'Map of the current form: one line per node — JSON Pointer (the address other tools take), ' +
    'component name, model path and caption. Call this FIRST when working with an existing form. ' +
    'For the full JSON of a single node use get_form_node.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  run(_params, ctx) {
    return ok(renderOutline(buildOutline(ctx.draft), TOOL_TEXT_BUDGET));
  },
};
