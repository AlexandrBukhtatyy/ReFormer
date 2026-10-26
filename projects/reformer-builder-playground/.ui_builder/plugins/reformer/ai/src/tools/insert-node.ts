/**
 * `insert_node` — вставить компонент в контейнер.
 *
 * Узел строит фабрика ЗАПИСИ каталога (`entry.makeNode()`) — та же, что у палитры и быстрой
 * вставки. Второй механизм создания узлов заводить нельзя: он неизбежно разойдётся с первым в
 * compound-шаблонах, дефолтных классах и структуре wizard/array.
 *
 * Именно фабрика записи, а не `makeNodeFor(name, role, …)` напрямую: запись собрана вместе с
 * фактами о ките (`buildCatalogFromJson`, `MakeNodeKit`), и только она знает, какие компоненты
 * кита — листья и чем кит рисует массив. Прямой вызов без кита давал узел-массив БЕЗ `component`:
 * вставленный ассистентом массив рисовался без заголовка и кнопок «добавить» / «удалить», а тот
 * же массив из палитры — с ними.
 *
 * ## Вложенная вставка
 *
 * Узел пакета может нести `children` — узлы внутри него, той же формы. Визард с тремя шагами и
 * полями в каждом — один вызов, а не четыре: на локальной модели каждый лишний вызов — это весь
 * контекст ещё раз и десятки секунд. Переданные дети ЗАМЕНЯЮТ то, что компонент приносит сам
 * (шаг «Шаг 1» у визарда): модель описала содержимое целиком. Схема параметров рекурсии не
 * описывает (`$ref` на себя понимают не все каналы), поэтому форма детей проверяется здесь, с
 * адресом элемента в отказе: `nodes[0].children[2]`.
 *
 * @module plugins/reformer/ai/tools/insert-node
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { insertNode, updateAt } from '../../../core/form-model';
import { catalogEntry, componentNames, type Catalog } from '../model/catalog-digest';
import { commitBatch, type BatchEntry, type OpDescription } from '../loop/gate';
import { isResolved, nodeRef, resolveRef } from '../model/node-ref';
import { insertSlotOf, type InsertSlot } from '../model/slots';
import { similarNames } from '@reformer/builder-toolkit';
import { fail, type AgentTool, type ToolOutcome } from '../model/types';
import { REF_PROP } from './params';
import { nodeKeyOf, nodeKeyRefusal, splitNodeKeys } from './node-keys';
import { documentParts } from '../../../core/form-model';

/** Один вставляемый узел: компонент каталога либо подключение части (`part` + `model`). */
interface NodeSpec {
  component?: string;
  model?: string;
  props?: Record<string, unknown>;
  /** Имя части документа — узел подключает её разметку к группе `model`. */
  part?: string;
  /** Узлы внутри этого: шаги визарда, поля шага. Заменяют содержимое по умолчанию. */
  children?: NodeSpec[];
}

/** Глубина вложения в одном вызове: визард → шаг → поле. */
export const INSERT_MAX_DEPTH = 3;

/**
 * Узлов в одном вызове вместе с вложенными. Длинный вызов модель пишет долго, а оборванный на
 * середине не применится вовсе (см. правило «группируй» в промпте).
 */
export const INSERT_MAX_NODES = 40;

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
    'A composite arrives assembled; children replace its default content.',
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
            part: { type: 'string', description: 'Mount this part instead; model is the group' },
            model: { type: 'string', description: 'Model path, bare: applicant.email' },
            props: {
              type: 'object',
              description: 'Props; see describe_component. $disabled, $newRow: as in set_node_prop',
            },
            children: {
              type: 'array',
              description: "Nodes inside, same shape: a wizard's steps, a step's fields",
              items: { type: 'object' },
            },
          },
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

    const total = countNodes(params.nodes);
    if (total > INSERT_MAX_NODES) {
      return fail(
        'INVALID_PARAMS',
        `${total} nodes in one call, at most ${INSERT_MAX_NODES}. Split it into several calls.`
      );
    }

    // Пакет применяется к черновику по одному узлу, но гейт проходит один раз в конце: проверка
    // схемы стоит дороже самой вставки, а промежуточные состояния пакета модели не видны.
    const batch: Batch = {
      catalog: ctx.catalog,
      parts: documentParts(ctx.draft),
      draft: ctx.draft,
      entries: [],
    };
    let at = params.index ?? Number.MAX_SAFE_INTEGER;
    // Индекс элемента называется прямо: без него «поле нельзя класть в мастер» на пакете из
    // двенадцати узлов не говорит, какой именно узел виноват. У одиночной вставки без детей
    // приписывать нечего.
    const single = params.nodes.length === 1 && params.nodes[0].children === undefined;
    for (const [i, spec] of params.nodes.entries()) {
      const refused = insertTree(batch, {
        slot,
        at,
        spec,
        label: single ? '' : `nodes[${i}]`,
        depth: 1,
        parentRef: params.parent,
      });
      if (refused !== null) return refused;
      // Следующий узел встаёт сразу за предыдущим: иначе пакет с явным index уложил бы узлы в
      // обратном порядке — каждый следующий перед уже вставленным.
      at = params.index === undefined ? Number.MAX_SAFE_INTEGER : at + 1;
    }

    return commitBatch(ctx, batch.draft, batch.entries);
  },
};

/** Пакет вставки по ходу сборки: черновик и вставленные узлы в порядке вставки. */
interface Batch {
  readonly catalog: Catalog;
  readonly parts: ReadonlyMap<string, JsonNode>;
  draft: JsonFormSchema;
  readonly entries: BatchEntry[];
}

/** Куда и что вставить: узел пакета вместе с местом. */
interface TreeStep {
  readonly slot: InsertSlot;
  readonly at: number;
  readonly spec: NodeSpec;
  /** Адрес элемента в параметрах для отказа: `nodes[0].children[2]`; `''` — не нужен. */
  readonly label: string;
  readonly depth: number;
  readonly parentRef: string;
}

/** Вставить узел пакета и его детей. Отказ — `ToolOutcome` с адресом элемента, иначе `null`. */
function insertTree(batch: Batch, step: TreeStep): ToolOutcome | null {
  const { spec, label } = step;
  const refuse = (outcome: ToolOutcome): ToolOutcome =>
    label === '' ? outcome : { ...outcome, text: `${label}: ${outcome.text}` };
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return refuse(fail('INVALID_PARAMS', 'A node is an object: { component, model, props }.'));
  }
  if (spec.children !== undefined && !Array.isArray(spec.children)) {
    return refuse(fail('INVALID_PARAMS', 'children is an array of nodes.'));
  }
  const prepared =
    spec.part !== undefined
      ? preparePartMount(spec, batch.parts)
      : prepareNode(batch.catalog, spec, step.slot.kind, step.parentRef);
  if ('error' in prepared) return refuse(prepared.error);

  const children = spec.children ?? [];
  let node = prepared.node;
  let own: InsertSlot | null = null;
  if (children.length > 0) {
    if (step.depth >= INSERT_MAX_DEPTH) {
      return refuse(
        fail(
          'INVALID_PARAMS',
          `children nest at most ${INSERT_MAX_DEPTH} levels deep in one call; insert deeper ` +
            'nodes with another call into the address this one reports.'
        )
      );
    }
    own = insertSlotOf(node, []);
    if (own === null) {
      return refuse(fail('INVALID_PARENT', `${prepared.describe.report} does not hold children.`));
    }
    // Содержимое по умолчанию (шаг «Шаг 1» у визарда) заменяется переданным.
    node = updateAt(node, own.path, () => []);
  }

  const result = insertNode(batch.draft, step.slot.path, step.at, node);
  batch.draft = result.schema;
  const ref = nodeRef(result.newPath);
  batch.entries.push({ ref, ...prepared.describe });
  if (own === null) return null;

  const inner: InsertSlot = { path: [...result.newPath, ...own.path], kind: own.kind };
  for (const [j, child] of children.entries()) {
    const refused = insertTree(batch, {
      slot: inner,
      at: Number.MAX_SAFE_INTEGER,
      spec: child,
      label: `${label === '' ? 'nodes[0]' : label}.children[${j}]`,
      depth: step.depth + 1,
      parentRef: ref,
    });
    if (refused !== null) return refused;
  }
  return null;
}

/** Узлов в пакете вместе с вложенными; кривые `children` разбирает `insertTree`. */
function countNodes(nodes: readonly unknown[]): number {
  let total = 0;
  for (const node of nodes) {
    total += 1;
    const children = (node as NodeSpec | null)?.children;
    if (Array.isArray(children)) total += countNodes(children);
  }
  return total;
}

/**
 * Подключение части: узел `{ model, part }`. Части без группы модели не к чему привязать, а
 * части, которой нет в документе, — нечего рисовать.
 */
function preparePartMount(
  spec: NodeSpec,
  parts: ReadonlyMap<string, JsonNode>
): { node: JsonNode; describe: OpDescription } | { error: ToolOutcome } {
  const name = spec.part ?? '';
  if (!parts.has(name)) {
    return {
      error: fail('INVALID_PARAMS', `No part "${name}" in the document.`, [...parts.keys()]),
    };
  }
  if (spec.model === undefined) {
    return {
      error: fail('INVALID_PARAMS', `Mounting part "${name}" needs model — the group path.`),
    };
  }
  const node = { model: `$model(${spec.model})`, part: `$part(${name})` } as unknown as JsonNode;
  return {
    node,
    describe: {
      kind: 'add',
      summary: `часть «${name}» (${spec.model})`,
      report: `part "${name}" (${spec.model})`,
    },
  };
}

/** Узел, готовый ко вставке, вместе с описанием операции — либо отказ с причиной. */
function prepareNode(
  catalog: Catalog,
  spec: NodeSpec,
  slotKind: string,
  parentRef: string
): { node: JsonNode; describe: OpDescription } | { error: ToolOutcome } {
  if (spec.component === undefined) {
    // Что пришло вместо — называется: вложенный узел схема параметров не проверяет, и без этого
    // модель не видела, что шаг визарда она прислала одними props.
    const got = Object.keys(spec);
    return {
      error: fail(
        'INVALID_PARAMS',
        `A node needs component — or part to mount a part. Got: ${got.length ? got.join(', ') : 'nothing'}.`
      ),
    };
  }
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

  // Мастер держит в своём слоте ШАГИ, и каждый шаг — контейнер. Слот этот — те же `children`, что
  // у секции, поэтому узнаётся по виду (`slotKind`), а не по пути. Поле, положенное сюда напрямую,
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
  // Копия верхнего уровня — потому что ниже узел правится на месте, а фабрика записи приходит
  // вместе с каталогом и не обязана отдавать каждый раз новый объект.
  const node = { ...entry.makeNode() } as unknown as Record<string, unknown>;
  // Поле и массив держат привязку в одном ключе — `model`; контейнеру привязка не нужна.
  if (spec.model && (entry.role === 'field' || entry.role === 'array')) {
    node.model = `$model(${spec.model})`;
  }
  // Особые ключи (`./node-keys`) — в сам узел; остальное — свойства компонента.
  const { component: props, node: keys } = splitNodeKeys(spec.props ?? {});
  if (Object.keys(props).length > 0) {
    node.componentProps = { ...(node.componentProps as object), ...props };
  }
  for (const [name, value] of Object.entries(keys)) {
    const refused = nodeKeyRefusal(node as unknown as JsonNode, name, value);
    if (refused !== null) return { error: fail('INVALID_PARAMS', `${entry.name}: ${refused}`) };
    const key = nodeKeyOf(name);
    if (key !== undefined && value !== null) node[key] = value;
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
