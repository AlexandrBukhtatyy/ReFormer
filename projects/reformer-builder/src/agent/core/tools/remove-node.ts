/**
 * `remove_node` — удалить узел вместе с поддеревом.
 *
 * @module reformer-builder/agent/core/tools/remove-node
 */

import { removeNode } from '../../../model';
import { buildOutline } from '../outline';
import { commitBatch, type BatchEntry } from '../gate';
import type { NodeExpectation } from '../node-ref';
import { componentOf, isResolved, labelOf, refToPath, resolveRef } from '../node-ref';
import { fail, type AgentTool } from '../types';
import { EXPECT_PROP } from './params';

/** Параметры вызова. */
interface Params {
  refs: string[];
  expect?: NodeExpectation;
}

export const removeNodeTool: AgentTool<Params> = {
  name: 'remove_node',
  description:
    // Правило «передавай expect на разрушающих правках» живёт в системном промпте; повторять его
    // здесь — платить за одну мысль дважды в каждом запросе.
    'Remove nodes together with everything inside them.',
  inputSchema: {
    type: 'object',
    properties: {
      refs: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: 'Node addresses to remove',
      },
      expect: EXPECT_PROP,
    },
    required: ['refs'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    // Как и у set_node_prop: ожидание описывает ОДИН узел и на списке было бы бессмыслицей.
    if (params.expect && params.refs.length > 1) {
      return fail(
        'INVALID_PARAMS',
        'expect describes a single node — pass it only when refs holds exactly one address.'
      );
    }

    // Удаление идёт от последнего адреса к первому. Удалив соседа по возрастанию, мы сдвигаем
    // индексы оставшихся, и второй адрес уже указывает на чужой узел — тихая порча формы вместо
    // ошибки. Обратный порядок делает адреса независимыми друг от друга.
    const ordered = [...new Set(params.refs)].sort(compareRefs).reverse();

    let draft = ctx.draft;
    const entries: BatchEntry[] = [];

    for (const ref of ordered) {
      const found = resolveRef(draft, ref, params.expect);
      if (!isResolved(found)) return found;

      const name = labelOf(found.node) ?? componentOf(found.node) ?? ref;
      // Поддерево считаем ДО удаления: в предпросмотре важно, что уходит не только сам узел.
      const nested = buildOutline(draft).filter(
        (e) => e.ref.startsWith(`${ref}/`) && refToPath(e.ref).length > found.path.length
      ).length;

      draft = removeNode(draft, found.path).schema;
      entries.push({
        ref,
        kind: 'remove',
        summary: nested > 0 ? `${name} и вложенные узлы (${nested})` : String(name),
        report: nested > 0 ? `${name} and ${nested} nested node(s)` : String(name),
      });
    }

    return commitBatch(ctx, draft, entries);
  },
};

/**
 * Порядок адресов в дереве: посегментно, числовые индексы — как числа.
 *
 * Лексикографическое сравнение здесь врёт: `/children/10` оказалось бы раньше `/children/2`, и
 * удаление «с конца» перестало бы быть удалением с конца ровно там, где детей больше десяти.
 */
function compareRefs(a: string, b: string): number {
  const left = a.split('/');
  const right = b.split('/');
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i];
    const y = right[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isInteger(nx) && Number.isInteger(ny)) return nx - ny;
    return x < y ? -1 : 1;
  }
  return 0;
}
