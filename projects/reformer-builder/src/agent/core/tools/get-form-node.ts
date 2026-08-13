/**
 * `get_form_node` — полный JSON одного узла, когда дайджеста недостаточно.
 *
 * Поддеревья детей намеренно НЕ включаются: они уже видны в `get_form_outline`, а их вложение
 * сюда превращало бы точечный запрос в выгрузку всей формы — ровно то, ради ухода от чего
 * дайджест и существует.
 *
 * @module reformer-builder/agent/core/tools/get-form-node
 */

import type { JsonNode } from '@reformer/renderer-json';
import { childSlots, type JsonPath } from '../../../model';
import { isResolved, resolveRef } from '../node-ref';
import { ok, type AgentTool } from '../types';

/** Копия узла без дочерних поддеревьев (`children` / `steps` / `item` / `wrapper`). */
function withoutChildren(node: JsonNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'children' || key === 'wrapper' || key === 'item') continue;
    if (key === 'componentProps' && value !== null && typeof value === 'object') {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(value as Record<string, unknown>)) {
        if (pk !== 'steps') props[pk] = pv;
      }
      out[key] = props;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Сводка по опущенным слотам, чтобы модель знала, что дети есть. */
function childrenNote(node: JsonNode, path: JsonPath): string {
  const slots = childSlots(node, path);
  if (!slots.length) return '';
  const parts = slots.map((s) => `${s.kind}: ${s.entries.length}`);
  return `\nChild nodes (omitted from the JSON above, see get_form_outline for their addresses) — ${parts.join(', ')}.`;
}

/** Параметры вызова. */
interface Params {
  ref: string;
}

export const getFormNode: AgentTool<Params> = {
  name: 'get_form_node',
  description:
    'Full JSON of a single node by its address (JSON Pointer from get_form_outline). ' +
    'Child nodes are not included — their addresses are in the form map.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: { type: 'string', description: 'JSON Pointer of the node, e.g. /root/children/0' },
    },
    required: ['ref'],
    additionalProperties: false,
  },
  readOnly: true,
  run(params, ctx) {
    const found = resolveRef(ctx.draft, params.ref);
    if (!isResolved(found)) return found;
    const json = JSON.stringify(withoutChildren(found.node), null, 2);
    return ok(`${params.ref}:\n${json}${childrenNote(found.node, found.path)}`);
  },
};
