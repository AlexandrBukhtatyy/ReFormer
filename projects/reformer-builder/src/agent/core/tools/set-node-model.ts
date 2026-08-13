/**
 * `set_node_model` — перепривязать поле или массив к другому пути данных.
 *
 * Оператор `$model(...)` собирает инструмент: модели он не показывается и ею не пишется —
 * внутренний синтаксис схемы не должен просачиваться в словарь агента.
 *
 * @module reformer-builder/agent/core/tools/set-node-model
 */

import { isArrayNode, isFieldNode } from '@reformer/renderer-json';
import { setNodeKey } from '../../../model';
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
    'Привязать поле или массив к пути данных. Путь пиши без обёртки: applicant.email, не $model(...). ' +
    'У контейнеров привязки нет.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      model: { type: 'string', minLength: 1, description: 'Путь модели, например applicant.email' },
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
        `Узел ${params.ref} — контейнер, привязки к данным у него нет. Привязка есть у полей и массивов.`
      );
    }

    const result = setNodeKey(ctx.draft, found.path, key, `$model(${params.model})`);
    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    return commitMutation(ctx, result, () => ({
      kind: 'update',
      summary: `${name} → привязка ${params.model}`,
    }));
  },
};
