/**
 * Читатели узла: каталожное имя, путь модели, подпись для человека.
 *
 * В v1 эти три функции лежали в `agent/core/node-ref` вместе с адресацией инструментов агента
 * (`resolveRef`, `NodeExpectation`, `STALE_POINTER`), и `model/selectors` импортировал их ОТТУДА —
 * домен зависел от агента. В v2 агент становится плагином (`plugins/reformer/ai/`), а плагин домену
 * не виден, поэтому чистые читатели переехали в домен, а адресация инструментов остаётся у агента
 * и берёт их отсюда. Разделение проходит ровно по границе «знание о форме» / «протокол агента».
 *
 * @module plugins/reformer/core/form-model/node-ref
 */

import { isArrayNode, parseOperator, type JsonNode } from '@reformer/renderer-json';

/** Синтетическое каталожное имя array-узла без явного `component`. */
export const ARRAY_COMPONENT_NAME = 'FieldArray';

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

/**
 * Путь модели узла без обёртки `$model(...)`; у контейнеров — `undefined`.
 *
 * Привязка у поля, массива и подформы лежит в одном ключе — `model`; у контейнера ключа нет.
 */
export function modelOf(node: JsonNode): string | undefined {
  const parsed = parseOperator((node as { model?: unknown }).model);
  return parsed?.op === 'model' ? parsed.arg : undefined;
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
