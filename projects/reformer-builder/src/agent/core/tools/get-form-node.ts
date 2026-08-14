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
import { REF_PROP } from './params';

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
    'Full JSON of a single node. Child nodes are not included — their addresses are in the form map.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
    },
    required: ['ref'],
    additionalProperties: false,
  },
  readOnly: true,
  run(params, ctx) {
    const found = resolveRef(ctx.draft, params.ref);
    if (!isResolved(found)) return found;
    // Без отступов: они стоят четверть символов ответа, а бюджет здесь тесный — на них приходится
    // ровно та часть узла, которую пришлось бы обрезать. Модель разбирает JSON одинаково в обоих
    // видах, читать его глазами тут некому.
    const json = JSON.stringify(withoutChildren(found.node));
    return ok(`${params.ref}:\n${json}${childrenNote(found.node, found.path)}`);
  },
};
