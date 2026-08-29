/**
 * `duplicate_node` — копия узла сразу после оригинала.
 *
 * @module plugins/ai/core/tools/duplicate-node
 */

import { duplicateNode } from '@/lib/form-model/mutate';
import { commitMutation } from '../gate';
import { componentOf, isResolved, labelOf, resolveRef } from '../node-ref';
import { fail, type AgentTool } from '../types';
import { EXPECT_PROP, REF_PROP, type RefParams } from './params';

export const duplicateNodeTool: AgentTool<RefParams> = {
  name: 'duplicate_node',
  description:
    'Create a copy of a node (with everything inside) right after it. Only for nodes among ' +
    'a container children.',
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

    const result = duplicateNode(ctx.draft, found.path);
    // `duplicateNode` — no-op, если узел не в массиве-слоте (шаблон массива, обёртка поля).
    if (result.schema === ctx.draft) {
      return fail(
        'INVALID_PARENT',
        `Node ${params.ref} cannot be duplicated: it does not sit among the children of a container.`
      );
    }

    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    return commitMutation(ctx, result, () => ({
      kind: 'add',
      summary: `копия: ${name}`,
      report: `copy of ${name}`,
    }));
  },
};
