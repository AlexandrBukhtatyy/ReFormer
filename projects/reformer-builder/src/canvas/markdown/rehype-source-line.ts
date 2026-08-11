/**
 * rehype-плагин: проставляет блочным элементам предпросмотра `data-line` — строку исходника
 * (1-based), с которой начинается блок. По этой разметке работает синхроскролл
 * ({@link module:reformer-builder/canvas/markdown/scroll-sync}).
 *
 * Позиции доходят сюда потому, что remark сохраняет `position` в mdast, а `mdast-util-to-hast`
 * переносит его в hast. ВАЖНО: плагин обязан стоять ДО `rehype-sanitize` — санитайзер строит новое
 * дерево и позиции за ним не сохраняются.
 *
 * Обход написан руками (десяток строк) вместо `unist-util-visit`: одной зависимостью меньше, а
 * `hast` для этого достаточно прост.
 *
 * @module reformer-builder/canvas/markdown/rehype-source-line
 */

import type { Element, Root, RootContent } from 'hast';

/**
 * Теги, которым ставим метку. Набор блочный и достаточно частый, чтобы якоря шли густо (пункты
 * списка и строки таблицы — тоже, иначе длинный список даёт один якорь на весь экран).
 */
const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'hr',
  'details',
  'section',
  'div',
  'figure',
]);

/** Внутрь этих элементов не спускаемся: содержимое рисуется целиком, разбивать его незачем. */
const OPAQUE_TAGS = new Set(['pre', 'code']);

function isElement(node: RootContent): node is Element {
  return node.type === 'element';
}

function walk(children: RootContent[]): void {
  for (const node of children) {
    if (!isElement(node)) continue;
    const line = node.position?.start.line;
    if (line != null && BLOCK_TAGS.has(node.tagName)) {
      node.properties = { ...node.properties, dataLine: line };
    }
    if (!OPAQUE_TAGS.has(node.tagName)) walk(node.children);
  }
}

/** Плагин для `rehypePlugins` (см. `MarkdownPreview`). */
export function rehypeSourceLine() {
  return (tree: Root): void => walk(tree.children);
}
