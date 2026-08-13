/**
 * `group_nodes` — обернуть соседние узлы в общий контейнер.
 *
 * @module reformer-builder/agent/core/tools/group-nodes
 */

import { groupBlock, siblingInfo } from '../../../model';
import { commitMutation } from '../gate';
import { isResolved, refToPath, resolveRef } from '../node-ref';
import { layoutClassName, type LayoutParams } from '../layout';
import { fail, type AgentTool } from '../types';

/** Параметры вызова. */
interface Params extends LayoutParams {
  refs: string[];
}

export const groupNodesTool: AgentTool<Params> = {
  name: 'group_nodes',
  description:
    'Обернуть несколько СОСЕДНИХ узлов в общий контейнер — например, чтобы поставить имя и ' +
    'фамилию в одну строку. direction/columns/gap задают раскладку получившейся группы.',
  inputSchema: {
    type: 'object',
    properties: {
      refs: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        description: 'Адреса соседних узлов одного контейнера, в порядке следования',
      },
      direction: { type: 'string', enum: ['row', 'column'], description: 'Раскладка группы' },
      columns: { type: 'integer', minimum: 2, description: 'Число колонок сетки' },
      gap: {
        type: 'string',
        enum: ['none', 'sm', 'md', 'lg'],
        description: 'Расстояние между детьми',
      },
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
          `Узел ${ref} не лежит среди детей контейнера — группировать нечего.`
        );
      }
      infos.push({ ref, info });
    }

    const slot = infos[0].info.slotPath.join('/');
    if (infos.some((i) => i.info.slotPath.join('/') !== slot)) {
      return fail('INVALID_PARENT', 'Все узлы должны лежать в одном контейнере.');
    }

    // Шаги мастера обёртка схлопывает: `groupBlock` ставит на их место один `$html(div)`, и вместо
    // нескольких страниц остаётся одна безымянная. Внутри шага группировка полей по-прежнему
    // законна — запрет ровно на сам слот шагов.
    if (infos[0].info.slotPath.at(-1) === 'steps') {
      return fail(
        'INVALID_PARENT',
        'Шаги мастера группировать нельзя — обёртка сделала бы из них один шаг. ' +
          'Группируй поля ВНУТРИ шага.'
      );
    }

    const indices = infos.map((i) => i.info.index).sort((a, b) => a - b);
    const start = indices[0];
    const adjacent = indices.every((v, k) => v === start + k);
    if (!adjacent) {
      return fail(
        'INVALID_PARENT',
        `Группировать можно только идущие подряд узлы; получены позиции ${indices.join(', ')}.`
      );
    }

    const result = groupBlock(ctx.draft, infos[0].info.slotPath, start, indices.length, {
      className: layoutClassName(params),
    });
    return commitMutation(ctx, result, () => ({
      kind: 'add',
      summary: `группа из ${indices.length} узлов`,
    }));
  },
};
