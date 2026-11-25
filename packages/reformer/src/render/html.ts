/**
 * HTML-узел схемы (`component: 'div'`): то, что о тегах знает рендерер на любом фреймворке.
 *
 * @module render/html
 */

/** HTML-элементы без содержимого: детей им рендерер не передаёт. */
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
