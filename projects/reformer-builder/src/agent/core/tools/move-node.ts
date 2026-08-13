/**
 * `move_node` — перенести узел в другой контейнер или на другую позицию.
 *
 * @module reformer-builder/agent/core/tools/move-node
 */

import { isPrefix, moveNode } from '../../../model';
import { commitMutation } from '../gate';
import { componentOf, isResolved, labelOf, resolveRef } from '../node-ref';
import { insertSlotOf } from '../slots';
import { fail, type AgentTool } from '../types';
import { EXPECT_PROP, REF_PROP, type RefParams } from './params';

/** Параметры вызова. */
interface Params extends RefParams {
  parent: string;
  index?: number;
}

export const moveNodeTool: AgentTool<Params> = {
  name: 'move_node',
  description:
    'Перенести узел внутрь контейнера parent на позицию index (по умолчанию в конец). ' +
    'Тем же вызовом меняется порядок внутри текущего контейнера — укажи его же как parent.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      parent: { type: 'string', description: 'Адрес контейнера назначения' },
      index: {
        type: 'integer',
        minimum: 0,
        description: 'Позиция среди детей; по умолчанию в конец',
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
      return fail('INVALID_PARENT', `Нельзя перенести ${params.ref} внутрь самого себя.`);
    }

    const slotPath = insertSlotOf(parent.node, parent.path);
    if (!slotPath) {
      return fail('INVALID_PARENT', `Узел ${params.parent} не принимает детей.`);
    }

    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    const index = params.index ?? Number.MAX_SAFE_INTEGER;
    const result = moveNode(ctx.draft, found.path, slotPath, index);
    return commitMutation(ctx, result, (ref) => ({
      kind: 'move',
      summary: `${name} → ${ref}`,
    }));
  },
};
