/**
 * Подписи и бейджи узлов для схематичного canvas/инспектора/таб-бара.
 *
 * @module reformer-builder/canvas/node-display
 */

import {
  isArrayNode,
  isFieldNode,
  parseOperator,
  type JsonNode,
} from '@reformer/renderer-json';

/** Бейдж типа узла: имя компонента, `Array` или имя HTML-тега. */
export function nodeTypeBadge(node: JsonNode): string {
  if (isArrayNode(node)) return 'Array';
  const comp = (node as { component?: unknown }).component;
  const parsed = parseOperator(comp);
  if (parsed?.op === 'component') return parsed.arg;
  if (parsed?.op === 'html') return parsed.arg;
  return isFieldNode(node) ? 'Input' : 'Node';
}

/** Человекочитаемая подпись узла: label/title → путь модели → имя компонента. */
export function nodeLabel(node: JsonNode): string {
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
  if (props?.label != null) return String(props.label);
  if (props?.title != null) return String(props.title);
  if (isFieldNode(node)) return parseOperator(node.value)?.arg ?? 'поле';
  if (isArrayNode(node)) return parseOperator(node.array)?.arg ?? 'массив';
  const comp = parseOperator((node as { component?: unknown }).component);
  return comp?.arg ?? 'узел';
}
