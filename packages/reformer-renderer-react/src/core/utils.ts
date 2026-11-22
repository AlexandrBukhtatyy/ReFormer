/**
 * Утилиты для RenderSchema
 *
 * @module reformer/renderer-react/utils
 */

import type { RenderNode, ContainerRenderNode } from './types';

/**
 * Type guard: узел — нативный HTML-тег (`component` задан строкой), а не React-компонент.
 * Рендерер различает их, чтобы не пробрасывать `selector` в DOM-атрибуты и не передавать
 * содержимое void-тегам.
 *
 * @param node - Узел {@link RenderNode}
 * @returns `true`, если `node.component` — строка-тег
 *
 * @example
 * ```typescript
 * isHtmlTagRenderNode({ component: 'div' }); // true
 * isHtmlTagRenderNode({ component: Section }); // false
 * ```
 */
export function isHtmlTagRenderNode<T>(node: RenderNode<T>): node is ContainerRenderNode<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (node as any).component === 'string';
}

/**
 * HTML void-элементы: не имеют содержимого. React бросает
 * «is a void element tag and must neither have children…», если такому тегу передать children,
 * поэтому рендерер их содержимое не передаёт вовсе.
 */
export const VOID_HTML_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
