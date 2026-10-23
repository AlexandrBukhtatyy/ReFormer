/**
 * `move_node` — перенести узлы в другой контейнер или на другую позицию.
 *
 * ## Почему пачкой
 *
 * Перенос по одному стоил дороже всех прочих правок: после каждого переноса адреса соседей
 * сдвигаются, и модель то перечитывала карту, то била по старому адресу. Замер на живой модели
 * (`docs/mcp-eval/builder-form-scenarios.md`, сценарий 5.3): разложить 11 полей по двум шагам —
 * 24–38 вызовов и до 17 отказов «формы уже нет по этому адресу». Пачкой адреса разрешаются по
 * форме ДО правки, и пересчитывает их ядро (`moveNodes`), а не модель.
 *
 * @module plugins/reformer/ai/tools/move-node
 */

import { isPrefix, kindOf, moveNode, moveNodes, type JsonPath } from '../../../core/form-model';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { commitBatch, type BatchEntry } from '../loop/gate';
import { componentOf, isResolved, labelOf, nodeRef, resolveRef } from '../model/node-ref';
import { insertSlotOf } from '../model/slots';
import { fail, type AgentTool } from '../model/types';
import { EXPECT_PROP, type RefParams } from './params';

/** Параметры вызова. */
interface Params extends Omit<RefParams, 'ref'> {
  refs: string[];
  parent: string;
  index?: number;
}

export const moveNodeTool: AgentTool<Params> = {
  name: 'move_node',
  description:
    'Move nodes into container parent at position index (appended by default), in the order ' +
    'of refs. The same call reorders within the current container — pass that same container ' +
    'as parent.',
  inputSchema: {
    type: 'object',
    properties: {
      refs: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: 'Node addresses, as read before the move',
      },
      parent: { type: 'string', description: 'Address of the destination container' },
      index: {
        type: 'integer',
        minimum: 0,
        description: 'Position among the children; appended by default',
      },
      expect: EXPECT_PROP,
    },
    required: ['refs', 'parent'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    // Как у remove_node: ожидание описывает ОДИН узел и на списке было бы бессмыслицей.
    if (params.expect && params.refs.length > 1) {
      return fail(
        'INVALID_PARAMS',
        'expect describes a single node — pass it only when refs holds exactly one address.'
      );
    }
    const refs = [...new Set(params.refs)];

    const found = [];
    for (const ref of refs) {
      const node = resolveRef(ctx.draft, ref, params.expect);
      if (!isResolved(node)) return node;
      found.push({ ref, ...node });
    }
    const parent = resolveRef(ctx.draft, params.parent);
    if (!isResolved(parent)) return parent;

    for (const item of found) {
      // Узел нельзя положить внутрь самого себя — получилось бы потерянное поддерево.
      if (isPrefix(item.path, parent.path)) {
        return fail('INVALID_PARENT', `Cannot move ${item.ref} inside itself.`);
      }
      // Узел внутри другого переносимого уезжает вместе с ним: переносить его ещё раз — значит
      // разорвать то, что модель, скорее всего, хотела перенести целиком.
      const outer = found.find((other) => other !== item && isPrefix(other.path, item.path));
      if (outer !== undefined) {
        return fail(
          'INVALID_PARAMS',
          `${item.ref} lies inside ${outer.ref}, which moves with it — drop ${item.ref} from refs.`
        );
      }
    }

    const slot = insertSlotOf(parent.node, parent.path);
    if (!slot) {
      return fail('INVALID_PARENT', `Node ${params.parent} does not accept children.`);
    }

    // Тот же запрет, что у insert_node: в слоте мастера живут шаги-контейнеры, а не поля. Слот
    // шагов узнаётся по его виду (`childSlots`), а не по пути: шаги лежат в `children` визарда.
    const loose = found.find((item) => slot.kind === 'steps' && kindOf(item.node) !== 'container');
    if (loose !== undefined) {
      return fail(
        'INVALID_PARENT',
        `A wizard holds steps only. Move ${loose.ref} inside one of the steps of ${params.parent}.`
      );
    }

    const index = params.index ?? Number.MAX_SAFE_INTEGER;
    // Одиночный перенос — прежним путём: он ещё и разворачивает выродившийся ряд.
    let schema: JsonFormSchema;
    let newPaths: readonly JsonPath[];
    if (found.length === 1) {
      const result = moveNode(ctx.draft, found[0].path, slot.path, index);
      schema = result.schema;
      newPaths = [result.newPath];
    } else {
      const result = moveNodes(
        ctx.draft,
        found.map((item) => item.path),
        slot.path,
        index
      );
      schema = result.schema;
      newPaths = result.newPaths;
    }

    // Новый адрес каждого узла — в ответе: следующий вызов идёт по нему, а не по прежнему.
    const entries: BatchEntry[] = found.map((item, i) => {
      const ref = nodeRef(newPaths[i]);
      const name = labelOf(item.node) ?? componentOf(item.node) ?? item.ref;
      return { ref, kind: 'move', summary: `${name} → ${ref}`, report: `${name} → ${ref}` };
    });
    return commitBatch(ctx, schema, entries);
  },
};
