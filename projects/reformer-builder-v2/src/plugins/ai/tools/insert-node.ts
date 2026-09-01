/**
 * `insert_node` — вставить компонент в контейнер.
 *
 * Узел строит `makeNodeFor` (`catalog/make-node`) — та же фабрика, что у палитры и быстрой
 * вставки. Второй механизм создания узлов заводить нельзя: он неизбежно разойдётся с первым в
 * compound-шаблонах, дефолтных классах и структуре wizard/array.
 *
 * @module plugins/ai/tools/insert-node
 */

import type { JsonNode } from '@reformer/renderer-json';
import { makeNodeFor } from '@/lib/catalog/make-node';
import { insertNode } from '@/lib/form-model/mutate';
import { catalogEntry, componentNames, type Catalog } from '../model/catalog-digest';
import { commitBatch, type BatchEntry, type OpDescription } from '../loop/gate';
import { isResolved, nodeRef, resolveRef } from '../model/node-ref';
import { insertSlotOf } from '../model/slots';
import { similarNames } from '../loop/suggest';
import { fail, type AgentTool, type ToolOutcome } from '../model/types';
import { REF_PROP } from './params';

/** Один вставляемый узел. */
interface NodeSpec {
  component: string;
  model?: string;
  props?: Record<string, unknown>;
}

/** Параметры вызова. */
interface Params {
  parent: string;
  index?: number;
  nodes: NodeSpec[];
}

export const insertNodeTool: AgentTool<Params> = {
  name: 'insert_node',
  // Пересказ собственных параметров отсюда убран: их описания идут ниже, в схеме, и уходили в
  // каждый запрос дважды. Здесь остаётся то, чего из схемы не видно, — что считается контейнером.
  description:
    'Insert a component into a container: a step, a section or the form root. ' +
    'A composite component arrives already assembled.',
  inputSchema: {
    type: 'object',
    properties: {
      parent: REF_PROP,
      index: {
        type: 'integer',
        minimum: 0,
        description: 'Position of the first node; appended by default',
      },
      nodes: {
        type: 'array',
        minItems: 1,
        description: 'Components to insert into parent, in order',
        items: {
          type: 'object',
          properties: {
            component: { type: 'string', description: 'Name from list_components' },
            model: { type: 'string', description: 'Model path, bare: applicant.email' },
            props: { type: 'object', description: 'Props; see describe_component' },
          },
          required: ['component'],
          additionalProperties: false,
        },
      },
    },
    required: ['parent', 'nodes'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const parent = resolveRef(ctx.draft, params.parent);
    if (!isResolved(parent)) return parent;

    const slot = insertSlotOf(parent.node, parent.path);
    if (!slot) {
      return fail(
        'INVALID_PARENT',
        `Node ${params.parent} does not accept children. Pick a container, a step or the form root.`
      );
    }

    // Пакет применяется к черновику по одному узлу, но гейт проходит один раз в конце: проверка
    // схемы стоит дороже самой вставки, а промежуточные состояния пакета модели не видны.
    let draft = ctx.draft;
    const entries: BatchEntry[] = [];
    let at = params.index ?? Number.MAX_SAFE_INTEGER;

    for (const [i, spec] of params.nodes.entries()) {
      const prepared = prepareNode(ctx.catalog, spec, slot.kind, params.parent);
      // Индекс элемента называется прямо: без него «поле нельзя класть в мастер» на пакете из
      // двенадцати узлов не говорит, какой именно узел виноват.
      if ('error' in prepared) return withIndex(prepared.error, params.nodes.length, i);

      const result = insertNode(draft, slot.path, at, prepared.node);
      draft = result.schema;
      // Следующий узел встаёт сразу за предыдущим: иначе пакет с явным index уложил бы узлы в
      // обратном порядке — каждый следующий перед уже вставленным.
      at = params.index === undefined ? Number.MAX_SAFE_INTEGER : at + 1;
      entries.push({ ref: nodeRef(result.newPath), ...prepared.describe });
    }

    return commitBatch(ctx, draft, entries);
  },
};

/** Приписать к отказу номер элемента пакета — у одиночной вставки приписывать нечего. */
function withIndex(outcome: ToolOutcome, total: number, index: number): ToolOutcome {
  if (total === 1) return outcome;
  return { ...outcome, text: `nodes[${index}]: ${outcome.text}` };
}

/** Узел, готовый ко вставке, вместе с описанием операции — либо отказ с причиной. */
function prepareNode(
  catalog: Catalog,
  spec: NodeSpec,
  slotKind: string,
  parentRef: string
): { node: JsonNode; describe: OpDescription } | { error: ToolOutcome } {
  const entry = catalogEntry(catalog, spec.component);
  if (!entry) {
    // Похожих имён может не найтись вовсе (выдуманное имя ни на что не похоже) — тогда
    // подсказкой служит сам путь восстановления, иначе модель осталась бы без него.
    return {
      error: fail(
        'UNKNOWN_COMPONENT',
        `No component "${spec.component}" in the catalog. Take a name from list_components.`,
        similarNames(spec.component, componentNames(catalog))
      ),
    };
  }

  // Мастер держит в своём слоте ШАГИ, и каждый шаг — контейнер. Поле, положенное сюда напрямую,
  // становилось шагом: рантайм пытался нарисовать его вместо страницы мастера. Отказ приходит до
  // правки, поэтому черновик остаётся чистым, а модель узнаёт правило в тот момент, когда оно ей
  // нужно. Проверка по ВИДУ узла, а не по имени `Step`: контейнер шагом быть вправе. Но каноничный
  // шаг — именно `Step` (`catalog/make-node.ts`, `stepNode`; рецепт renderer-json 07-form-wizard):
  // его props-схема знает `title`/`icon`, а `Box` — только `className`, поэтому `Box`-шаг вставку
  // пройдёт и тут же забракуется props-гейтом, как только на нём появится подпись.
  if (slotKind === 'steps' && entry.role !== 'container') {
    return {
      error: fail(
        'INVALID_PARENT',
        `A wizard holds steps only, and ${entry.name} is not a container. Insert a Step into ` +
          `${parentRef} first, then put this field inside that step.`
      ),
    };
  }

  // Узел достраивается по частям (привязка, свойства), поэтому типизируется как запись:
  // объединение JsonNode дискриминируется полями, которых на промежуточных шагах ещё нет.
  const node = makeNodeFor(entry.name, entry.role, entry.compoundParent) as unknown as Record<
    string,
    unknown
  >;
  if (spec.model) {
    // Поле держит привязку в `value`, массив — в `array`; контейнеру привязка не нужна.
    if (entry.role === 'field') node.value = `$model(${spec.model})`;
    else if (entry.role === 'array') node.array = `$model(${spec.model})`;
  }
  if (spec.props) {
    node.componentProps = { ...(node.componentProps as object), ...spec.props };
  }

  const label = String(spec.props?.label ?? spec.model ?? entry.name);
  return {
    node: node as unknown as JsonNode,
    describe: {
      kind: 'add',
      // Подпись узла — данные пользователя, поэтому в обеих строках она одна и та же.
      summary: `${label} (${entry.name})`,
      report: `${label} (${entry.name})`,
    },
  };
}
