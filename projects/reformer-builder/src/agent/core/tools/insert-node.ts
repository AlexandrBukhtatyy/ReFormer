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
    'Insert a component into a container. component — a name from list_components, parent — the ' +
    'address of the container (a step, a section, the form root). index — position among the ' +
    'children, appended by default. model binds fields and arrays to data, props sets component ' +
    'properties.',
  inputSchema: {
    type: 'object',
    properties: {
      component: { type: 'string', description: 'Component name from list_components' },
      parent: REF_PROP,
      index: {
        type: 'integer',
        minimum: 0,
        description: 'Position among the children; appended by default',
      },
      model: {
        type: 'string',
        description: 'Model path without $model(...), e.g. applicant.email',
      },
      props: { type: 'object', description: 'Component properties (see describe_component)' },
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
        `No component "${params.component}" in the catalog. Take a name from list_components.`,
        similarNames(params.component, componentNames())
      );
    }

    const parent = resolveRef(ctx.draft, params.parent);
    if (!isResolved(parent)) return parent;

    const slot = insertSlotOf(parent.node, parent.path);
    if (!slot) {
      return fail(
        'INVALID_PARENT',
        `Node ${params.parent} does not accept children. Pick a container, a step or the form root.`
      );
    }

    // Мастер держит в своём слоте ШАГИ, и каждый шаг — контейнер. Поле, положенное сюда напрямую,
    // становилось шагом: рантайм пытался нарисовать его вместо страницы мастера. Отказ приходит до
    // правки, поэтому черновик остаётся чистым, а модель узнаёт правило в тот момент, когда оно ей
    // нужно. Проверка по ВИДУ узла, а не по имени `Step`: шагом законно бывает и `Box`.
    if (slot.kind === 'steps' && entry.role !== 'container') {
      return fail(
        'INVALID_PARENT',
        `A wizard holds steps only, and ${entry.name} is not a container. Insert a Step into ` +
          `${params.parent} first, then put this field inside that step.`
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
    const result = insertNode(ctx.draft, slot.path, index, node as unknown as JsonNode);
    const label = params.props?.label ?? params.model ?? entry.name;
    return commitMutation(ctx, result, () => ({
      kind: 'add',
      // Подпись узла — данные пользователя, поэтому в обеих строках она одна и та же.
      summary: `${String(label)} (${entry.name})`,
      report: `${String(label)} (${entry.name})`,
    }));
  },
};
