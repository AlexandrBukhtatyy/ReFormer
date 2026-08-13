/**
 * `set_layout` — раскладка контейнера в семантических терминах.
 *
 * @module reformer-builder/agent/core/tools/set-layout
 */

import { isContainerNode } from '@reformer/renderer-json';
import { setComponentProp } from '../../../model';
import { commitMutation } from '../gate';
import { layoutClassName, type LayoutParams } from '../layout';
import { componentOf, isResolved, labelOf, resolveRef } from '../node-ref';
import { fail, type AgentTool } from '../types';
import { EXPECT_PROP, REF_PROP, type RefParams } from './params';

/** Параметры вызова. */
interface Params extends RefParams, LayoutParams {}

export const setLayoutTool: AgentTool<Params> = {
  name: 'set_layout',
  description:
    'Задать раскладку контейнера: direction (в строку/в столбец), columns (сетка) и gap ' +
    '(плотность). Классы оформления не трогаются. CSS-классы напрямую не задавай — только эти ' +
    'параметры.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      direction: { type: 'string', enum: ['row', 'column'], description: 'Ось раскладки' },
      columns: { type: 'integer', minimum: 2, description: 'Число колонок сетки' },
      gap: {
        type: 'string',
        enum: ['none', 'sm', 'md', 'lg'],
        description: 'Расстояние между детьми',
      },
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
        `Раскладка есть только у контейнеров; ${params.ref} — не контейнер.`
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
    return commitMutation(ctx, result, () => ({
      kind: 'update',
      summary: `${name} → раскладка: ${how}`,
    }));
  },
};
