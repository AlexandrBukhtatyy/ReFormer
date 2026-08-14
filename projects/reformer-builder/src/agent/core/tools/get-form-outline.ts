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
    // «Позови первым делом» отсюда убрано намеренно: карта формы на начало хода приходит вместе с
    // сообщением пользователя, и этот вызов нужен только чтобы перечитать форму после правок.
    'Map of the current form: one line per node — address, component name, model path and caption. ' +
    'Re-read the form only if you lost track of it. For the full JSON of one node use get_form_node.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  run(_params, ctx) {
    return ok(renderOutline(buildOutline(ctx.draft), TOOL_TEXT_BUDGET));
  },
};
