/**
 * `set_layout` — раскладка контейнера в семантических терминах.
 *
 * @module plugins/ai/core/tools/set-layout
 */

import { isContainerNode } from '@reformer/renderer-json';
import { setComponentProp } from '@/lib/form-model/mutate';
import { commitMutation } from '../gate';
import { layoutClassName, type LayoutParams } from '../layout';
import { componentOf, isResolved, labelOf, resolveRef } from '../node-ref';
import { fail, type AgentTool } from '../types';
import { EXPECT_PROP, LAYOUT_PROPS, REF_PROP, type RefParams } from './params';

/** Параметры вызова. */
interface Params extends RefParams, LayoutParams {}

export const setLayoutTool: AgentTool<Params> = {
  name: 'set_layout',
  description:
    'Set the layout of a container: direction (row/column), columns (grid) and gap (density). ' +
    'Styling classes are left alone.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      ...LAYOUT_PROPS,
      expect: EXPECT_PROP,
    },
    required: ['ref'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const found = resolveRef(ctx.draft, params.ref, params.expect);
    if (!isResolved(found)) return found;
    if (!isContainerNode(found.node)) {
      return fail(
        'INVALID_PARENT',
        `Only containers have a layout; ${params.ref} is not a container.`
      );
    }

    const existing = found.node.componentProps?.className;
    const className = layoutClassName(params, typeof existing === 'string' ? existing : '');
    const result = setComponentProp(ctx.draft, found.path, 'className', className);
    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    const how = params.columns
      ? `${params.columns} колонки`
      : params.direction === 'row'
        ? 'в строку'
        : params.direction === 'column'
          ? 'в столбец'
          : `отступ ${params.gap}`;
    const howEn = params.columns
      ? `${params.columns} columns`
      : params.direction === 'row'
        ? 'row'
        : params.direction === 'column'
          ? 'column'
          : `gap ${params.gap}`;
    return commitMutation(ctx, result, () => ({
      kind: 'update',
      summary: `${name} → раскладка: ${how}`,
      report: `${name} → layout: ${howEn}`,
    }));
  },
};
