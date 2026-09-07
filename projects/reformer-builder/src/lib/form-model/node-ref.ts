/**
 * Читатели узла: каталожное имя, путь модели, подпись для человека.
 *
 * В v1 эти три функции лежали в `agent/core/node-ref` вместе с адресацией инструментов агента
 * (`resolveRef`, `NodeExpectation`, `STALE_POINTER`), и `model/selectors` импортировал их ОТТУДА —
 * домен зависел от агента. В v2 агент становится плагином (`plugins/ai/`), а плагин домену
 * не виден, поэтому чистые читатели переехали в домен, а адресация инструментов остаётся у агента
 * и берёт их отсюда. Разделение проходит ровно по границе «знание о форме» / «протокол агента».
 *
 * @module lib/form-model/node-ref
 */

import { isArrayNode, isFieldNode, parseOperator, type JsonNode } from '@reformer/renderer-json';

/** Синтетическое каталожное имя array-узла без явного `component`. */
export const ARRAY_COMPONENT_NAME = 'FormArray';

/**
 * Каталожное имя узла — ровно тот словарь, которым оперируют палитра и вставка узла.
 * У `$html(div)` именем является сама строка оператора (так запись названа в каталоге),
 * у array-узла без `component` — {@link ARRAY_COMPONENT_NAME}.
 */
export function componentOf(node: JsonNode): string | undefined {
  const raw = (node as { component?: unknown }).component;
  const op = parseOperator(raw);
  if (op?.op === 'component') return op.arg;
  if (op?.op === 'html') return raw as string;
  if (isArrayNode(node)) return ARRAY_COMPONENT_NAME;
  return undefined;
}

/** Путь модели узла без обёртки `$model(...)`; у контейнеров — `undefined`. */
export function modelOf(node: JsonNode): string | undefined {
  const raw = isArrayNode(node) ? node.array : isFieldNode(node) ? node.value : undefined;
  return parseOperator(raw)?.arg;
}

/**
 * Подпись узла для человека: `label` поля либо `title` шага/секции. Оператор-значения
 * (`$locale(...)`) отдаются как есть — распаковывать их незачем, они и так читаемы.
 */
export function labelOf(node: JsonNode): string | undefined {
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
  for (const key of ['label', 'title']) {
    const v = props?.[key];
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}
