/**
 * `set_node_model` — перепривязать поле или массив к другому пути данных.
 *
 * Оператор `$model(...)` собирает инструмент: модели он не показывается и ею не пишется —
 * внутренний синтаксис схемы не должен просачиваться в словарь агента.
 *
 * @module plugins/ai/core/tools/set-node-model
 */

import { isArrayNode, isFieldNode } from '@reformer/renderer-json';
import { setNodeKey } from '@/lib/form-model/mutate';
import { commitMutation } from '../gate';
import { componentOf, isResolved, labelOf, resolveRef } from '../node-ref';
import { fail, type AgentTool } from '../types';
import { EXPECT_PROP, REF_PROP, type RefParams } from './params';

/** Параметры вызова. */
interface Params extends RefParams {
  model: string;
}

export const setNodeModelTool: AgentTool<Params> = {
  name: 'set_node_model',
  description:
    'Bind a field or an array to a data path. Write the path bare: applicant.email, not ' +
    '$model(...). Containers have no binding.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      model: { type: 'string', minLength: 1, description: 'Model path, e.g. applicant.email' },
      expect: EXPECT_PROP,
    },
    required: ['ref', 'model'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const found = resolveRef(ctx.draft, params.ref, params.expect);
    if (!isResolved(found)) return found;

    const key = isArrayNode(found.node) ? 'array' : isFieldNode(found.node) ? 'value' : null;
    if (!key) {
      return fail(
        'INVALID_PARENT',
        `Node ${params.ref} is a container and has no data binding. Only fields and arrays do.`
      );
    }

    const result = setNodeKey(ctx.draft, found.path, key, `$model(${params.model})`);
    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    return commitMutation(ctx, result, () => ({
      kind: 'update',
      summary: `${name} → привязка ${params.model}`,
      report: `${name} → bound to ${params.model}`,
    }));
  },
};
