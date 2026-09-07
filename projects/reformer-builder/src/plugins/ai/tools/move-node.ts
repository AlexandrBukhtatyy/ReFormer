/**
 * `move_node` — перенести узел в другой контейнер или на другую позицию.
 *
 * @module plugins/ai/tools/move-node
 */

import { moveNode } from '@/lib/form-model/mutate';
import { kindOf } from '@/lib/form-model/node-kind';
import { isPrefix } from '@/lib/form-model/paths';
import { commitMutation } from '../loop/gate';
import { componentOf, isResolved, labelOf, resolveRef } from '../model/node-ref';
import { insertSlotOf } from '../model/slots';
import { fail, type AgentTool } from '../model/types';
import { EXPECT_PROP, REF_PROP, type RefParams } from './params';

/** Параметры вызова. */
interface Params extends RefParams {
  parent: string;
  index?: number;
}

export const moveNodeTool: AgentTool<Params> = {
  name: 'move_node',
  description:
    'Move a node into container parent at position index (appended by default). The same call ' +
    'reorders within the current container — pass that same container as parent.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      parent: { type: 'string', description: 'Address of the destination container' },
      index: {
        type: 'integer',
        minimum: 0,
        description: 'Position among the children; appended by default',
      },
      expect: EXPECT_PROP,
    },
    required: ['ref', 'parent'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const found = resolveRef(ctx.draft, params.ref, params.expect);
    if (!isResolved(found)) return found;
    const parent = resolveRef(ctx.draft, params.parent);
    if (!isResolved(parent)) return parent;

    // Узел нельзя положить внутрь самого себя — получилось бы потерянное поддерево.
    if (isPrefix(found.path, parent.path)) {
      return fail('INVALID_PARENT', `Cannot move ${params.ref} inside itself.`);
    }

    const slot = insertSlotOf(parent.node, parent.path);
    if (!slot) {
      return fail('INVALID_PARENT', `Node ${params.parent} does not accept children.`);
    }

    // Тот же запрет, что у insert_node: в слоте мастера живут шаги-контейнеры, а не поля.
    if (slot.kind === 'steps' && kindOf(found.node) !== 'container') {
      return fail(
        'INVALID_PARENT',
        `A wizard holds steps only. Move ${params.ref} inside one of the steps of ${params.parent}.`
      );
    }

    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    const index = params.index ?? Number.MAX_SAFE_INTEGER;
    const result = moveNode(ctx.draft, found.path, slot.path, index);
    return commitMutation(ctx, result, (ref) => ({
      kind: 'move',
      summary: `${name} → ${ref}`,
      report: `${name} → ${ref}`,
    }));
  },
};
