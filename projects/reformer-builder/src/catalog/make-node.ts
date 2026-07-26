/**
 * Фабрики узлов по умолчанию (для дропа из палитры). Реконструируются из `role`+`name` — так
 * каталог-JSON остаётся чисто декларативным (без функций), а билдер восстанавливает `makeNode`
 * (спека §5).
 *
 * @module reformer-builder/catalog/make-node
 */

import type { JsonNode } from '@reformer/renderer-json';
import type { CatalogRole } from './types';

const HTML_CONTAINERS = new Set(['div', 'section', 'fieldset']);

export function fieldNode(name: string): JsonNode {
  return {
    value: '$model(newField)',
    component: `$component(${name})`,
    componentProps: { label: name },
  };
}

export function containerNode(name: string): JsonNode {
  return {
    component: `$component(${name})`,
    componentProps: { className: 'space-y-4' },
    children: [],
  };
}

export function htmlNodeFor(name: string): JsonNode {
  const tag = name.slice('$html('.length, -1); // '$html(div)' → 'div'
  const component = `$html(${tag})` as `$html(${string})`;
  if (HTML_CONTAINERS.has(tag)) {
    return { component, componentProps: { className: tag === 'div' ? 'flex gap-4' : 'space-y-4' }, children: [] };
  }
  if (tag === 'hr') return { component, componentProps: {} };
  return { component, text: tag === 'h3' ? 'Заголовок' : 'Текст' };
}

export function arrayNode(): JsonNode {
  return {
    array: '$model(items)',
    item: {
      $template: { component: '$component(Box)', componentProps: { className: 'space-y-3' }, children: [] },
    },
    componentProps: { addButtonLabel: '+ Добавить элемент' },
  };
}

/** Узел по умолчанию для записи каталога (по `role`/`name`). */
export function makeNodeFor(name: string, role: CatalogRole): JsonNode {
  if (role === 'array') return arrayNode();
  if (name.startsWith('$html(')) return htmlNodeFor(name);
  if (role === 'field') return fieldNode(name);
  return containerNode(name);
}
