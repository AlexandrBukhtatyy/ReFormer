/**
 * Дайджест схемы — то, как агент «видит» форму.
 *
 * Полный `JsonFormSchema` модели не отдаётся: реальные формы занимают тысячи строк, `componentProps`
 * почти целиком шум для структурных решений, а вложенные деревья в `componentProps.steps` ломают
 * наивную оценку размера. Дайджест даёт по строке на узел — адрес, компонент, модель, подпись —
 * а полный узел запрашивается точечно (`get_form_node`).
 *
 * Обход идёт через `childSlots` (`model/node-kind`) — единственное место, знающее про неоднородную
 * вложенность (`children` / `componentProps.steps` / `item.$template` / `wrapper`), поэтому
 * дайджест не хардкодит правила размещения повторно.
 *
 * @module reformer-builder/agent/core/outline
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  childSlots,
  isNodeLike,
  kindOf,
  type ChildSlotKind,
  type JsonPath,
  type NodeKind,
} from '../../model';
import { componentOf, labelOf, modelOf, nodeRef } from './node-ref';
import { joinWithinBudget } from './render-budget';

/** Одна строка дайджеста. */
export interface OutlineEntry {
  /** JSON Pointer — адрес, которым узел адресуют write-инструменты. */
  ref: string;
  /** Глубина от корня (для отступа). */
  depth: number;
  kind: NodeKind;
  /** Каталожное имя компонента. */
  component?: string;
  /** Путь модели без обёртки оператора. */
  model?: string;
  /** `label` поля либо `title` шага. */
  label?: string;
  /** Слот РОДИТЕЛЯ, в котором лежит узел; у корня отсутствует. */
  slot?: ChildSlotKind;
  /** `componentProps.required === true`. */
  required?: boolean;
}

/**
 * Построить дайджест схемы (pre-order, начиная с корневого узла `['root']`).
 * Схема без узла-корня даёт пустой список, а не бросает: гейт качества — не здесь.
 */
export function buildOutline(schema: JsonFormSchema): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  const root = (schema as { root?: unknown }).root;
  if (!isNodeLike(root)) return out;
  visit(root, ['root'], 0, undefined, out);
  return out;
}

function visit(
  node: JsonNode,
  path: JsonPath,
  depth: number,
  slot: ChildSlotKind | undefined,
  out: OutlineEntry[]
): void {
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
  const component = componentOf(node);
  const model = modelOf(node);
  const label = labelOf(node);
  out.push({
    ref: nodeRef(path),
    depth,
    kind: kindOf(node),
    ...(component ? { component } : {}),
    ...(model ? { model } : {}),
    ...(label ? { label } : {}),
    ...(slot ? { slot } : {}),
    ...(props?.required === true ? { required: true } : {}),
  });
  for (const s of childSlots(node, path)) {
    for (const entry of s.entries) {
      const childPath = s.single ? s.path : [...s.path, entry.index];
      visit(entry.node, childPath, depth + 1, s.kind, out);
    }
  }
}

/** Одна строка дайджеста в текст. */
function renderEntry(e: OutlineEntry): string {
  const parts = [e.component ?? `(${e.kind})`];
  if (e.model) parts.push(`model=${e.model}`);
  if (e.label) parts.push(`«${e.label}»`);
  if (e.required) parts.push('required');
  return `${'  '.repeat(e.depth)}${e.ref} · ${parts.join(' · ')}`;
}

/**
 * Дайджест в текст для модели. При превышении бюджета обрезается ОСОЗНАННО — с хвостовой строкой
 * о числе пропущенных узлов, чтобы модель знала о неполноте и дозапросила нужное через
 * `get_form_node`, а не считала обрезанное дерево полным.
 *
 * @param entries - Результат {@link buildOutline}.
 * @param budget - Бюджет в символах.
 */
export function renderOutline(entries: readonly OutlineEntry[], budget: number): string {
  if (!entries.length) return 'Форма пуста: узлов нет.';
  return joinWithinBudget(
    [],
    entries.map(renderEntry),
    budget,
    (shown, total) => `… ещё ${total - shown} узл(ов) — запроси get_form_node по нужному адресу`
  );
}
