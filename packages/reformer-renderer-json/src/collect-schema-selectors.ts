/**
 * Сбор всех `selector` из JSON-схемы формы (§8) — для диагностики промаха `schema.node('typo')`.
 *
 * Идём по СХЕМЕ, а не по рендер-дереву: рендер-дерево кастомных компонентов (узлы в пропсах)
 * обойти надёжно нельзя. В JSON структура плоская и известна: `children`, `item.$template`,
 * `wrapper`, вложенные ноды внутри `componentProps` и именованные части документа (`parts`).
 * Обход намеренно over-inclusive (лишний «известный» селектор безвреден; опасно лишь ПРОПУСТИТЬ).
 *
 * @module reformer/renderer-json/collect-schema-selectors
 */

import type { JsonFormSchema } from './types/json-schema';

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

/** Похоже ли значение на JSON-ноду (несёт дискриминатор оператора или selector)? */
function looksLikeNode(v: Record<string, unknown>): boolean {
  return 'component' in v || 'model' in v || 'selector' in v || 'children' in v;
}

function walkNode(node: unknown, out: Set<string>): void {
  if (!isObj(node)) return;
  if (Array.isArray(node)) {
    for (const n of node) walkNode(n, out);
    return;
  }
  if (typeof node.selector === 'string') out.add(node.selector);
  walkNode(node.children, out); // контейнер
  if (isObj(node.item)) walkNode((node.item as Record<string, unknown>).$template, out); // массив
  walkNode(node.wrapper, out); // per-field обёртка
  // componentProps: значения могут быть вложенными нодами (напр. `header` карточки).
  if (isObj(node.componentProps)) {
    for (const v of Object.values(node.componentProps)) walkComponentPropValue(v, out);
  }
}

function walkComponentPropValue(v: unknown, out: Set<string>): void {
  if (!isObj(v)) return;
  if (Array.isArray(v)) {
    for (const x of v) walkComponentPropValue(x, out);
    return;
  }
  if (looksLikeNode(v)) walkNode(v, out);
}

/**
 * Собирает множество всех `selector` из JSON-схемы (включая вложенные в `componentProps` ноды).
 *
 * @param schema - Документ JSON-схемы формы формата 2.
 * @returns Множество известных селекторов.
 */
export function collectSchemaSelectors(schema: JsonFormSchema): Set<string> {
  const out = new Set<string>();
  walkNode(schema.root, out);
  // Именованные части документа: их селекторы живут в областях подформ и строк, но «известными»
  // считаются тоже — обход намеренно over-inclusive.
  const parts = schema.parts;
  if (isObj(parts)) for (const part of Object.values(parts)) walkNode(part, out);
  return out;
}
