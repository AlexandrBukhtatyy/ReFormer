/**
 * Адресация узлов для агента: JSON Pointer вместо массива-пути.
 *
 * Почему Pointer, а не собственные ID узлов в side-map: указатель уже есть в модели
 * (`toPointer`/`fromPointer`, `model/paths`) и используется для подсветки raw-JSON, тогда как
 * реестр ID пришлось бы синхронизировать с каждой мутацией. Плата за Pointer — он «съезжает»,
 * если соседей вставили/удалили; лечится не реестром, а проверкой {@link NodeExpectation}:
 * инструмент объявляет, ЧТО он рассчитывает найти по адресу, и получает `STALE_POINTER`
 * вместо тихой правки чужого узла.
 *
 * `fromPointer` намеренно оставляет индексы строками (Pointer не различает индекс и ключ), но
 * {@link refToPath} приводит их к числам. Это не косметика: большинство функций `model/*` приводят
 * сегмент сами, а `ungroupNode` проверяет `typeof last === 'number'` и на строке молча ничего не
 * делает. Нормализация в одном месте убирает весь класс таких расхождений — путь из адреса
 * неотличим от пути, который строит сам редактор.
 *
 * @module reformer-builder/agent/core/node-ref
 */

import {
  isArrayNode,
  isFieldNode,
  parseOperator,
  type JsonNode,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { fromPointer, getAt, isNodeLike, toPointer, type JsonPath } from '../../model';
import { fail, type ToolOutcome } from './types';

/** Синтетическое каталожное имя array-узла без явного `component`. */
export const ARRAY_COMPONENT_NAME = 'FormArray';

/** Что вызывающий рассчитывает найти по адресу. Любое заданное поле обязано совпасть. */
export interface NodeExpectation {
  /** Каталожное имя: `Input`, `$html(div)`, `FormArray`. */
  component?: string;
  /** Путь модели без обёртки оператора: `applicant.email`. */
  model?: string;
}

/** Путь → адрес для агента. */
export function nodeRef(path: JsonPath): string {
  return toPointer(path);
}

/** Адрес → путь. Числовые сегменты становятся числами (см. заметку в шапке модуля). */
export function refToPath(ref: string): JsonPath {
  return fromPointer(ref).map((seg) =>
    typeof seg === 'string' && /^\d+$/.test(seg) ? Number(seg) : seg
  );
}

/**
 * Каталожное имя узла — ровно тот словарь, которым оперируют `list_components` и `insert_node`.
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

/** Узел, найденный по адресу. */
export interface ResolvedNode {
  node: JsonNode;
  path: JsonPath;
}

/**
 * Найти узел по адресу и проверить ожидание.
 *
 * @returns Узел либо `ToolOutcome` с `STALE_POINTER` — вызывающий возвращает его без изменений.
 */
export function resolveRef(
  schema: JsonFormSchema,
  ref: string,
  expect?: NodeExpectation
): ResolvedNode | ToolOutcome {
  const path = refToPath(ref);
  const node = getAt(schema, path);
  if (!isNodeLike(node)) {
    return fail(
      'STALE_POINTER',
      `По адресу ${ref} узла нет — форму изменили. Перезапроси get_form_outline.`
    );
  }
  if (expect?.component) {
    const actual = componentOf(node);
    if (actual !== expect.component) {
      return fail(
        'STALE_POINTER',
        `По адресу ${ref} ожидался ${expect.component}, а находится ${actual ?? 'узел без компонента'}. Перезапроси get_form_outline.`
      );
    }
  }
  if (expect?.model) {
    const actual = modelOf(node);
    if (actual !== expect.model) {
      return fail(
        'STALE_POINTER',
        `По адресу ${ref} ожидалась модель ${expect.model}, а находится ${actual ?? 'узел без модели'}. Перезапроси get_form_outline.`
      );
    }
  }
  return { node, path };
}

/** Отличить успешный резолв от ошибки. */
export function isResolved(v: ResolvedNode | ToolOutcome): v is ResolvedNode {
  return 'node' in v;
}
