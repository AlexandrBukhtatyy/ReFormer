/**
 * Вид узла и его дочерние слоты — единственное место, знающее про НЕОДНОРОДНУЮ вложенность
 * `JsonFormSchema`:
 *
 * - контейнер держит детей в `children[]`;
 * - wizard-подобный контейнер — в `componentProps.steps[]` (каждый шаг сам является узлом);
 * - массив — единственного ребёнка в `item.$template`;
 * - поле — опциональную обёртку в `wrapper`.
 *
 * Canvas, drag-drop и обходчики дерева ходят через {@link childSlots}, поэтому нигде больше
 * не хардкодится `children` и правила размещения ReFormer сосредоточены здесь.
 *
 * @module reformer-builder/model/node-kind
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  type JsonArrayNode,
  type JsonContainerNode,
  type JsonNode,
} from '@reformer/renderer-json';
import type { JsonPath } from './paths';

/** Вид узла: лист / массив / контейнер. */
export type NodeKind = 'field' | 'array' | 'container';

/** Имя дочернего слота. */
export type ChildSlotKind = 'children' | 'steps' | 'template' | 'wrapper';

/** Дочерний слот узла — нормализованное представление одной коллекции детей. */
export interface ChildSlot {
  /** Тип слота. */
  kind: ChildSlotKind;
  /** Абсолютный путь (от корня документа) к массиву-слоту (`children`/`steps`) либо к держателю одиночного узла (`template`/`wrapper`). */
  path: JsonPath;
  /** `true` для одиночных слотов (`template`/`wrapper`), где не массив, а один узел. */
  single: boolean;
  /** Узлы слота (для одиночного — массив из одного элемента). */
  nodes: JsonNode[];
}

/**
 * Вид узла. Порядок проверок важен: массив несёт `$model`, поэтому проверяется ПЕРВЫМ
 * (как и требуют guard-ы `@reformer/renderer-json`).
 */
export function kindOf(node: JsonNode): NodeKind {
  if (isArrayNode(node)) return 'array';
  if (isFieldNode(node)) return 'field';
  return 'container';
}

/** Похоже ли значение на узел схемы (лист/массив/контейнер) — без строгой валидации операторов. */
export function isNodeLike(v: unknown): v is JsonNode {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return 'value' in o || 'array' in o || 'component' in o;
}

/**
 * Дочерние слоты узла в порядке отображения. Для контейнера возвращает и `children`,
 * и `steps` (если оба присутствуют); для массива — `template`; для поля — `wrapper` (если есть).
 * Лист без обёртки и контейнер без детей дают пустой список.
 *
 * @param node - Узел.
 * @param nodePath - Абсолютный путь узла (нужен, чтобы построить пути слотов).
 */
export function childSlots(node: JsonNode, nodePath: JsonPath): ChildSlot[] {
  const slots: ChildSlot[] = [];

  if (isArrayNode(node)) {
    const arr = node as JsonArrayNode;
    slots.push({
      kind: 'template',
      path: [...nodePath, 'item', '$template'],
      single: true,
      nodes: [arr.item.$template],
    });
    return slots;
  }

  if (isFieldNode(node)) {
    if (node.wrapper) {
      slots.push({
        kind: 'wrapper',
        path: [...nodePath, 'wrapper'],
        single: true,
        nodes: [node.wrapper],
      });
    }
    return slots;
  }

  if (isContainerNode(node)) {
    const c = node as JsonContainerNode;
    const steps = c.componentProps?.steps;
    if (Array.isArray(steps) && steps.some(isNodeLike)) {
      slots.push({
        kind: 'steps',
        path: [...nodePath, 'componentProps', 'steps'],
        single: false,
        nodes: steps.filter(isNodeLike),
      });
    }
    if (Array.isArray(c.children)) {
      slots.push({
        kind: 'children',
        path: [...nodePath, 'children'],
        single: false,
        nodes: c.children,
      });
    }
  }

  return slots;
}

/**
 * Может ли узел принимать детей (контейнер/массив/wizard). Лист без `wrapper`-слота — нет.
 * Используется drag-drop для проверки легальности сброса.
 */
export function canAcceptChildren(node: JsonNode): boolean {
  if (isArrayNode(node)) return true;
  if (isContainerNode(node)) return true;
  return false;
}

/** Ось, вдоль которой контейнер раскладывает детей. */
export type Orientation = 'vertical' | 'horizontal';

/**
 * Ось раскладки контейнера, выведенная из его `componentProps.className`:
 * `flex` без `flex-col`, либо `grid grid-cols-N` (N≥2) → горизонтальная; иначе
 * (`space-y-*`, `flex-col`, отсутствие класса, не-контейнер) → вертикальная.
 * Эвристика для drag-раскладки: она определяет, вдоль какой оси сосед считается «до/после»,
 * а какая ось-край означает «поставить рядом».
 */
export function orientationOf(node: JsonNode): Orientation {
  if (!isContainerNode(node)) return 'vertical';
  const cls = (node as JsonContainerNode).componentProps?.className;
  if (typeof cls !== 'string') return 'vertical';
  const tokens = cls.split(/\s+/).filter(Boolean);
  if (tokens.includes('grid')) {
    const cols = tokens.find((t) => /^grid-cols-\d+$/.test(t));
    if (cols && Number(cols.slice('grid-cols-'.length)) >= 2) return 'horizontal';
  }
  if (tokens.includes('flex') && !tokens.includes('flex-col')) return 'horizontal';
  return 'vertical';
}
