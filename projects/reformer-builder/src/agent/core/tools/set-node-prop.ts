/**
 * `set_node_prop` — задать или убрать одно свойство компонента.
 *
 * @module reformer-builder/agent/core/tools/set-node-prop
 */

import { setComponentProp } from '../../../model';
import { commitMutation } from '../gate';
import { componentOf, isResolved, labelOf, resolveRef } from '../node-ref';
import type { AgentTool } from '../types';
import { EXPECT_PROP, REF_PROP, type RefParams } from './params';

/** Параметры вызова. */
interface Params extends RefParams {
  key: string;
  value: string | number | boolean | null;
}

export const setNodePropTool: AgentTool<Params> = {
  name: 'set_node_prop',
  description:
    'Задать одно свойство компонента (label, placeholder, required, …). value: null удаляет ' +
    'свойство. Допустимые ключи и типы смотри в describe_component.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      key: { type: 'string', description: 'Имя свойства' },
      value: {
        type: ['string', 'number', 'boolean', 'null'],
        description: 'Значение; null удаляет свойство',
      },
      expect: EXPECT_PROP,
    },
    required: ['ref', 'key', 'value'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const found = resolveRef(ctx.draft, params.ref, params.expect);
    if (!isResolved(found)) return found;

    // JSON не умеет выражать undefined, поэтому «убрать свойство» приходит как null.
    const value = params.value === null ? undefined : params.value;
    const result = setComponentProp(ctx.draft, found.path, params.key, value);
    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    return commitMutation(ctx, result, () => ({
      kind: 'update',
      summary:
        value === undefined
          ? `${name} → свойство ${params.key} убрано`
          : `${name} → ${params.key} = ${JSON.stringify(value)}`,
    }));
  },
};
