/**
 * Хит-тест runtime-превью: DOM-элемент → узел схемы. Обратная сторона {@link annotateSchema}:
 * ищем ближайшего предка с класс-токеном, раскодируем путь и проверяем, что узел по нему реально
 * есть (устаревший токен после правки схемы → поднимаемся выше).
 *
 * @module reformer-builder/canvas/preview-hit-test
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { getAt, isNodeLike, type JsonPath } from '../model';
import {
  decodeNodeToken,
  encodeNodeToken,
  NODE_CLASS_PREFIX,
  tokenFromClassName,
} from '../preview-runtime';

/** CSS-селектор помеченных элементов (маркер живёт в `class`). */
export const NODE_SELECTOR = `[class*="${NODE_CLASS_PREFIX}"]`;

/** Найденный узел: путь в схеме, сам узел и DOM-элемент-якорь (для геометрии). */
export interface HitResult {
  path: JsonPath;
  node: JsonNode;
  element: HTMLElement;
}

/** Узел схемы под элементом `el` (сам элемент либо ближайший помеченный предок). */
export function nodeAtElement(
  el: Element | null | undefined,
  schema: JsonFormSchema
): HitResult | null {
  let current: Element | null = el instanceof Element ? el.closest(NODE_SELECTOR) : null;
  while (current instanceof HTMLElement) {
    // getAttribute, а не .className: у SVG-элементов это SVGAnimatedString, а не строка.
    const token = tokenFromClassName(current.getAttribute('class') ?? '');
    const path = token ? decodeNodeToken(token) : null;
    const node = path ? getAt(schema, path) : undefined;
    if (path && isNodeLike(node)) return { path, node, element: current };
    // Токен не резолвится (схема успела измениться) — пробуем предка.
    current = current.parentElement?.closest(NODE_SELECTOR) ?? null;
  }
  return null;
}

/**
 * DOM-элемент узла внутри хоста превью. Узлов может быть несколько (шаблон элемента массива
 * рендерится на каждый элемент) — возвращаем первый, он же верхний по документу.
 */
export function elementForPath(host: HTMLElement, path: JsonPath): HTMLElement | null {
  return host.querySelector<HTMLElement>(`.${CSS.escape(encodeNodeToken(path))}`);
}
