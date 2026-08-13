/**
 * `remove_node` — удалить узел вместе с поддеревом.
 *
 * @module reformer-builder/agent/core/tools/remove-node
 */

import { removeNode } from '../../../model';
import { buildOutline } from '../outline';
import { commitMutation } from '../gate';
import { componentOf, isResolved, labelOf, refToPath, resolveRef } from '../node-ref';
import type { AgentTool } from '../types';
import { EXPECT_PROP, REF_PROP, type RefParams } from './params';

export const removeNodeTool: AgentTool<RefParams> = {
  name: 'remove_node',
  description:
    'Удалить узел вместе со всем, что внутри него. Для необратимых правок обязательно передавай ' +
    'expect — так удаление не уйдёт в чужой узел, если адрес устарел.',
  inputSchema: {
    type: 'object',
    properties: { ref: REF_PROP, expect: EXPECT_PROP },
    required: ['ref'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const found = resolveRef(ctx.draft, params.ref, params.expect);
    if (!isResolved(found)) return found;

    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    // Считаем поддерево ДО удаления: пользователю в предпросмотре важно, что уходит не только узел.
    const prefix = params.ref;
    const nested = buildOutline(ctx.draft).filter(
      (e) => e.ref.startsWith(`${prefix}/`) && refToPath(e.ref).length > found.path.length
    ).length;

    const result = removeNode(ctx.draft, found.path);
    return commitMutation(ctx, result, () => ({
      kind: 'remove',
      summary: nested > 0 ? `${name} и вложенные узлы (${nested})` : String(name),
    }));
  },
};
