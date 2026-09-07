/**
 * `group_nodes` — обернуть соседние узлы в общий контейнер.
 *
 * @module plugins/ai/tools/group-nodes
 */

import { groupBlock } from '@/lib/form-model/mutate';
import { siblingInfo } from '@/lib/form-model/query';
import { commitMutation } from '../loop/gate';
import { isResolved, refToPath, resolveRef } from '../model/node-ref';
import { layoutClassName, type LayoutParams } from '../model/layout';
import { fail, type AgentTool } from '../model/types';
import { LAYOUT_PROPS } from './params';

/** Параметры вызова. */
interface Params extends LayoutParams {
  refs: string[];
}

export const groupNodesTool: AgentTool<Params> = {
  name: 'group_nodes',
  description:
    'Wrap several ADJACENT nodes into a shared container — e.g. two fields on one line. ' +
    'direction/columns/gap set the layout of the resulting group.',
  inputSchema: {
    type: 'object',
    properties: {
      refs: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        description: 'Adjacent nodes in one container, in document order',
      },
      ...LAYOUT_PROPS,
    },
    required: ['refs'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const infos = [];
    for (const ref of params.refs) {
      const found = resolveRef(ctx.draft, ref);
      if (!isResolved(found)) return found;
      const info = siblingInfo(ctx.draft, refToPath(ref));
      if (!info) {
        return fail(
          'INVALID_PARENT',
          `Node ${ref} does not sit among the children of a container — nothing to group.`
        );
      }
      infos.push({ ref, info });
    }

    const slot = infos[0].info.slotPath.join('/');
    if (infos.some((i) => i.info.slotPath.join('/') !== slot)) {
      return fail('INVALID_PARENT', 'All nodes must sit in the same container.');
    }

    // Шаги мастера обёртка схлопывает: `groupBlock` ставит на их место один `$html(div)`, и вместо
    // нескольких страниц остаётся одна безымянная. Внутри шага группировка полей по-прежнему
    // законна — запрет ровно на сам слот шагов.
    if (infos[0].info.slotPath.at(-1) === 'steps') {
      return fail(
        'INVALID_PARENT',
        'Wizard steps cannot be grouped — the wrapper would collapse them into a single step. ' +
          'Group the fields INSIDE a step instead.'
      );
    }

    const indices = infos.map((i) => i.info.index).sort((a, b) => a - b);
    const start = indices[0];
    const adjacent = indices.every((v, k) => v === start + k);
    if (!adjacent) {
      return fail(
        'INVALID_PARENT',
        `Only consecutive nodes can be grouped; got positions ${indices.join(', ')}.`
      );
    }

    const result = groupBlock(ctx.draft, infos[0].info.slotPath, start, indices.length, {
      className: layoutClassName(params),
    });
    return commitMutation(ctx, result, () => ({
      kind: 'add',
      summary: `группа из ${indices.length} узлов`,
      report: `group of ${indices.length} nodes`,
    }));
  },
};
