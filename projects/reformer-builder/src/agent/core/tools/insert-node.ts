/**
 * `insert_node` — вставить компонент в контейнер.
 *
 * Узел строит `makeNodeFor` (`catalog/make-node`) — та же фабрика, что у палитры и быстрой
 * вставки. Второй механизм создания узлов заводить нельзя: он неизбежно разойдётся с первым в
 * compound-шаблонах, дефолтных классах и структуре wizard/array.
 *
 * @module reformer-builder/agent/core/tools/insert-node
 */

import type { JsonNode } from '@reformer/renderer-json';
import { getCatalogEntry, makeNodeFor } from '../../../catalog';
import { insertNode } from '../../../model';
import { componentNames } from '../catalog-digest';
import { commitMutation } from '../gate';
import { isResolved, resolveRef } from '../node-ref';
import { insertSlotOf } from '../slots';
import { similarNames } from '../suggest';
import { fail, type AgentTool } from '../types';
import { REF_PROP } from './params';

/** Параметры вызова. */
interface Params {
  component: string;
  parent: string;
  index?: number;
  model?: string;
  props?: Record<string, unknown>;
}

export const insertNodeTool: AgentTool<Params> = {
  name: 'insert_node',
  description:
    'Вставить компонент внутрь контейнера. component — имя из list_components, parent — адрес ' +
    'контейнера (шага, секции, корня). index — позиция среди детей, по умолчанию в конец. ' +
    'model задаёт привязку к данным для полей и массивов, props — свойства компонента.',
  inputSchema: {
    type: 'object',
    properties: {
      component: { type: 'string', description: 'Имя компонента из list_components' },
      parent: REF_PROP,
      index: {
        type: 'integer',
        minimum: 0,
        description: 'Позиция среди детей; по умолчанию в конец',
      },
      model: {
        type: 'string',
        description: 'Путь модели без $model(...), например applicant.email',
      },
      props: { type: 'object', description: 'Свойства компонента (см. describe_component)' },
    },
    required: ['component', 'parent'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const entry = getCatalogEntry(params.component);
    if (!entry) {
      // Похожих имён может не найтись вовсе (выдуманное имя ни на что не похоже) — тогда
      // подсказкой служит сам путь восстановления, иначе модель осталась бы без него.
      return fail(
        'UNKNOWN_COMPONENT',
        `Компонента "${params.component}" нет в каталоге. Возьми имя из list_components.`,
        similarNames(params.component, componentNames())
      );
    }

    const parent = resolveRef(ctx.draft, params.parent);
    if (!isResolved(parent)) return parent;

    const slotPath = insertSlotOf(parent.node, parent.path);
    if (!slotPath) {
      return fail(
        'INVALID_PARENT',
        `Узел ${params.parent} не принимает детей. Выбери контейнер, шаг или корень формы.`
      );
    }

    // Узел достраивается по частям (привязка, свойства), поэтому типизируется как запись:
    // объединение JsonNode дискриминируется полями, которых на промежуточных шагах ещё нет.
    const node = makeNodeFor(entry.name, entry.role, entry.compoundParent) as unknown as Record<
      string,
      unknown
    >;
    if (params.model) {
      // Поле держит привязку в `value`, массив — в `array`; контейнеру привязка не нужна.
      if (entry.role === 'field') node.value = `$model(${params.model})`;
      else if (entry.role === 'array') node.array = `$model(${params.model})`;
    }
    if (params.props) {
      node.componentProps = { ...(node.componentProps as object), ...params.props };
    }

    const index = params.index ?? Number.MAX_SAFE_INTEGER;
    const result = insertNode(ctx.draft, slotPath, index, node as unknown as JsonNode);
    const label = params.props?.label ?? params.model ?? entry.name;
    return commitMutation(ctx, result, () => ({
      kind: 'add',
      summary: `${String(label)} (${entry.name})`,
    }));
  },
};
