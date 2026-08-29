/**
 * Селекторы узлов схемы — адреса, которыми правило render-слоя цепляется за разметку.
 *
 * **Зачем понадобилось.** `codegen/assign-selectors.ts` проставляет `selector` только при экспорте,
 * только на КОПИИ схемы и только контейнерам-секциям, массивам и submit-кнопке. Обычное поле его не
 * получало вовсе, задать вручную не умел ни один инструмент — и правило видимости на поле
 * оказывалось no-op: ни ошибки, ни эффекта, худший исход из возможных. Ровно поэтому
 * `set_form_rules` отказывался принимать видимость, о чём его шапка и говорила: «параметр вернётся,
 * когда селектором можно будет управлять».
 *
 * Здесь селектор становится управляемым: он пишется в ЖИВУЮ схему, переживает экспорт
 * (`assignSelectors` пользовательские селекторы сохраняет) и потому годится в адрес правила.
 *
 * @module reformer-builder/lib/form-model/selectors
 */

import {
  collectSchemaSelectors,
  parseOperator,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { kebab } from './naming';
import { componentOf, labelOf, modelOf } from './node-ref';
import { setNodeKey, type MutationResult } from './mutate';
import type { JsonPath } from './paths';
import { findByPath } from './query';

/** Селектор узла, если он задан. */
export function selectorOf(node: JsonNode): string | undefined {
  const s = (node as { selector?: unknown }).selector;
  return typeof s === 'string' && s ? s : undefined;
}

/**
 * Имя-кандидат для узла: подпись → путь модели → компонент. Без суффикса и без дедупа —
 * это заготовка, уникальность обеспечивает {@link uniqueSelector}.
 */
export function suggestSelector(node: JsonNode): string {
  const component = componentOf(node);
  // Оператор html-узла `componentOf` отдаёт строкой целиком — так он назван в каталоге. Для имени
  // селектора это давало «htmldiv»: kebab выкидывает служебные знаки, и тег слипался со словом
  // «html». Поэтому у html-узла берём тег, а не строку целиком.
  const op = parseOperator(component);
  const fromComponent = op?.op === 'html' ? op.arg : component;
  const base = labelOf(node) ?? modelOf(node) ?? fromComponent ?? 'node';
  return kebab(base) || 'node';
}

/**
 * Свободное имя селектора в пределах схемы.
 *
 * Множество занятых берётся из `collectSchemaSelectors` — того же, по которому `schema.node()`
 * ищет узел в рантайме. Свой обход здесь был бы вторым ответом на вопрос «какие селекторы есть»,
 * и разошёлся бы он ровно тогда, когда рендерер научится новому виду узла.
 */
export function uniqueSelector(schema: JsonFormSchema, base: string, keep?: string): string {
  const used = new Set(collectSchemaSelectors(schema));
  if (keep) used.delete(keep);
  const root = kebab(base) || 'node';
  if (!used.has(root)) return root;
  let i = 2;
  while (used.has(`${root}-${i}`)) i += 1;
  return `${root}-${i}`;
}

/** Задать селектор узлу (пустая строка удаляет ключ). Имя дедуплицируется по всей схеме. */
export function setNodeSelector(
  schema: JsonFormSchema,
  path: JsonPath,
  selector: string
): MutationResult {
  const trimmed = selector.trim();
  if (!trimmed) return setNodeKey(schema, path, 'selector', undefined);
  const node = findByPath(schema, path);
  const current = node ? selectorOf(node) : undefined;
  if (current === trimmed) return { schema, newPath: path };
  return setNodeKey(schema, path, 'selector', uniqueSelector(schema, trimmed, current));
}

/** Результат {@link ensureSelector}: схема (возможно, та же) и адрес, которым цепляться. */
export interface EnsuredSelector {
  schema: JsonFormSchema;
  selector: string;
  /** Был ли селектор проставлен сейчас — вызывающий сообщает об этом в отчёте о правке. */
  created: boolean;
}

/**
 * Гарантировать узлу селектор: вернуть существующий либо вывести и проставить новый.
 *
 * Это и есть точка, ради которой модуль существует: инструмент агента адресует узел по `ref`
 * (JSON Pointer, которым он уже пользуется), а селектор — деталь, о которой модель знать не
 * обязана и в которой она будет ошибаться.
 */
export function ensureSelector(schema: JsonFormSchema, path: JsonPath): EnsuredSelector | null {
  const node = findByPath(schema, path);
  if (!node) return null;
  const existing = selectorOf(node);
  if (existing) return { schema, selector: existing, created: false };
  const selector = uniqueSelector(schema, suggestSelector(node));
  return { schema: setNodeKey(schema, path, 'selector', selector).schema, selector, created: true };
}
