/**
 * Каркас схемы: вложенное дерево рамок, которое рисуется БЕЗ исполнения чего-либо.
 *
 * ## Зачем поверхность, которая ничего не исполняет
 *
 * Она нужна ровно тогда, когда остальные не работают: форма не компилируется, кит не поставлен,
 * источник запретил исполнение. В этих случаях выбор стоит между «структура схемы» и «пустой
 * прямоугольник с текстом ошибки», и первое полезнее — по каркасу видно, что узлы на месте,
 * а вложенность такая, как задумано.
 *
 * Отсюда её главное свойство: она не может отказать. Ни каталога, ни namespace кита, ни рабочей
 * области ей не нужно — только сама схема.
 *
 * ## Дерево, а не список строк
 *
 * Канвас редактора разворачивает модель в ПЛОСКИЙ список строк, потому что рисует отступами.
 * Здесь наоборот: рамка вложена в рамку, и вложенность выражена структурой, а не числом.
 * Одна функция для обоих случаев была бы функцией с флагом, и на первом же различии
 * (свёрнутые ветки нужны там и не нужны здесь) она разошлась бы всё равно.
 *
 * @module plugins/preview/skeleton/tree
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { htmlTag } from '@/lib/catalog/grouping';
import { nodeIdOf } from '@/lib/form-model/node-id';
import { childSlots, kindOf, type ChildSlotKind, type NodeKind } from '@/lib/form-model/node-kind';
import { componentOf, labelOf, modelOf } from '@/lib/form-model/node-ref';
import { selectorOf } from '@/lib/form-model/selectors';
import type { NodeId } from '@/sdk';

/** Узел каркаса: то, что рамка про себя знает, и её дети. */
export interface SkeletonNode {
  /** Адрес узла; `null` у узла без `$nodeId` — такой рисуется, но кликом не выбирается. */
  readonly id: NodeId | null;
  readonly kind: NodeKind;
  /** Слот, в котором узел лежит у родителя; у корня — `null`. */
  readonly slot: ChildSlotKind | null;
  /** Подпись для человека. */
  readonly title: string;
  /** Каталожное имя (`Input`, `div`) или `null` у узла без компонента. */
  readonly component: string | null;
  /** Путь модели без обёртки `$model(...)`; у контейнера — `null`. */
  readonly binding: string | null;
  readonly children: readonly SkeletonNode[];
}

/**
 * Подпись узла.
 *
 * Порядок источников — от самого говорящего к самому служебному: подпись поля, затем имя,
 * которым узел адресуют правила, затем компонент. `$html(div)` показывается тегом: обёртка
 * оператора в дереве из сорока рамок — шум, а не информация.
 *
 * То же правило и тот же порядок, что у канваса редактора. Разойтись им нельзя: человек
 * узнаёт узел по подписи, и две разные подписи одного узла означали бы, что превью и дерево
 * говорят о разном.
 */
export function skeletonTitle(node: JsonNode): string {
  const component = componentOf(node);
  const display = component === undefined ? null : (htmlTag(component) ?? component);
  return labelOf(node) ?? selectorOf(node) ?? display ?? 'узел';
}

/**
 * Строит каркас схемы.
 *
 * `leafComponents` — листья активного кита: без них `childSlots` считает вложенность у всего,
 * и `Icon` получил бы слот для детей. Необязателен: кита может не быть, и каркас обязан
 * работать и в этом случае — просто чуть менее точно.
 */
export function buildSkeleton(
  schema: JsonFormSchema,
  leafComponents?: ReadonlySet<string>
): SkeletonNode | null {
  const root = schema.root;
  if (root === undefined || root === null) return null;
  return toSkeleton(root, null, leafComponents);
}

function toSkeleton(
  node: JsonNode,
  slot: ChildSlotKind | null,
  leafComponents: ReadonlySet<string> | undefined
): SkeletonNode {
  const children: SkeletonNode[] = [];
  for (const childSlot of childSlots(node, [], leafComponents)) {
    for (const entry of childSlot.entries) {
      children.push(toSkeleton(entry.node, childSlot.kind, leafComponents));
    }
  }

  return {
    id: nodeIdOf(node) ?? null,
    kind: kindOf(node),
    slot,
    title: skeletonTitle(node),
    component: componentOf(node) ?? null,
    binding: modelOf(node) ?? null,
    children,
  };
}

/** Число узлов каркаса. Нужно сводке в шапке поверхности и тестам. */
export function skeletonSize(node: SkeletonNode | null): number {
  if (node === null) return 0;
  return 1 + node.children.reduce((sum, child) => sum + skeletonSize(child), 0);
}
