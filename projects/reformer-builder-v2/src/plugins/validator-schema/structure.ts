/**
 * Структурный линт: связи между узлами, которых не видит схемная валидация.
 *
 * `validateFormSchema` проверяет узлы ПООДИНОЧКЕ, поэтому форма, где вкладка ссылается
 * в пустоту, а шаг недостижим, проходит её без единого замечания. Именно так выглядели формы,
 * собранные ассистентом: по схеме валидны, на экране мертвы — не открыта ни одна вкладка,
 * четыре кнопки на три панели.
 *
 * **Замечания — предупреждения, а не ошибки.** Применение хода ассистента требует полной
 * валидности без сравнения с базой, и ошибка на чужой, изначально кривой форме заблокировала бы
 * ему любую работу — включая ту, которая эту форму чинит.
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ v1 (`io/structure-lint.ts`). Там результат — `string[]` вида
 * `«/root/children/0: tab has no value — it will open no panel.»`: адрес указателем внутри
 * фразы, фраза по-английски, привязать её к узлу можно только разбором. Здесь замечание несёт
 * КОД, параметры и сам узел, а указатель не нужен вовсе: узел адресуется своим `$nodeId`,
 * который не съезжает при вставке соседей.
 *
 * @module plugins/validator-schema/structure
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { childSlots } from '@/lib/form-model/node-kind';
import { componentOf } from '@/lib/form-model/node-ref';
import { walkNodes } from '@/lib/form-model/query';
import type { JsonPath } from '@/lib/form-model/paths';
import { CODES, type DiagnosticCode } from './codes';

/** Замечание до того, как оно стало диагностикой: код, данные и узел-виновник. */
export interface Finding {
  readonly code: DiagnosticCode;
  readonly params?: Record<string, unknown>;
  /** Узел, к которому замечание относится; `undefined` — замечание о схеме целиком. */
  readonly node?: JsonNode;
}

/** Компонент-контейнер вкладок и имена его частей. */
const TABS = { root: 'Tabs', trigger: 'TabsTrigger', panel: 'TabsContent' } as const;

/** Значение `componentProps.value` узла, если оно строковое. */
function valueOf(node: JsonNode): string | undefined {
  const value = (node as { componentProps?: Record<string, unknown> }).componentProps?.value;
  return typeof value === 'string' ? value : undefined;
}

/** Все потомки узла (без него самого). Путь нужен только обходу слотов, наружу не отдаётся. */
function descendants(node: JsonNode, path: JsonPath): JsonNode[] {
  const out: JsonNode[] = [];
  const rec = (current: JsonNode, currentPath: JsonPath): void => {
    for (const slot of childSlots(current, currentPath)) {
      for (const entry of slot.entries) {
        const childPath = slot.single ? slot.path : [...slot.path, entry.index];
        out.push(entry.node);
        rec(entry.node, childPath);
      }
    }
  };
  rec(node, path);
  return out;
}

/** Замечания по одному узлу `Tabs`: кнопки без панелей, панели без кнопок, чужой `defaultValue`. */
function lintTabs(node: JsonNode, path: JsonPath): Finding[] {
  const out: Finding[] = [];
  const inside = descendants(node, path);
  const triggers = inside.filter((child) => componentOf(child) === TABS.trigger);
  const panels = inside.filter((child) => componentOf(child) === TABS.panel);
  if (triggers.length === 0 && panels.length === 0) return out;

  const triggerValues = new Set<string>();
  for (const trigger of triggers) {
    const value = valueOf(trigger);
    // Без `value` кнопка не связана ни с одной панелью: Radix свяжет её по `undefined`,
    // и две такие вкладки схлопнутся в одну.
    if (value === undefined) out.push({ code: CODES.TAB_WITHOUT_VALUE, node: trigger });
    else triggerValues.add(value);
  }

  const panelValues = new Set<string>();
  for (const panel of panels) {
    const value = valueOf(panel);
    if (value === undefined) {
      out.push({ code: CODES.PANEL_WITHOUT_VALUE, node: panel });
      continue;
    }
    panelValues.add(value);
    if (!triggerValues.has(value)) {
      out.push({ code: CODES.PANEL_WITHOUT_TAB, params: { value }, node: panel });
    }
  }

  for (const trigger of triggers) {
    const value = valueOf(trigger);
    if (value !== undefined && !panelValues.has(value)) {
      out.push({ code: CODES.TAB_WITHOUT_PANEL, params: { value }, node: trigger });
    }
  }

  const defaultValue = (node as { componentProps?: Record<string, unknown> }).componentProps
    ?.defaultValue;
  if (
    typeof defaultValue === 'string' &&
    triggerValues.size > 0 &&
    !triggerValues.has(defaultValue)
  ) {
    out.push({ code: CODES.TABS_DEFAULT_VALUE_UNKNOWN, params: { value: defaultValue }, node });
  }
  return out;
}

/** Шагом мастера может быть только контейнер: полю в не-контейнере некуда лечь. */
function lintSteps(node: JsonNode, path: JsonPath): Finding[] {
  const out: Finding[] = [];
  for (const slot of childSlots(node, path)) {
    if (slot.kind !== 'steps') continue;
    for (const entry of slot.entries) {
      if (childSlots(entry.node, [...slot.path, entry.index]).length > 0) continue;
      out.push({
        code: CODES.STEP_NOT_CONTAINER,
        params: { name: componentOf(entry.node) ?? '' },
        node: entry.node,
      });
    }
  }
  return out;
}

/** Структурные замечания к форме. Пустой массив — связи в порядке. */
export function structureFindings(schema: JsonFormSchema): Finding[] {
  const out: Finding[] = [];
  walkNodes(schema, (node, path) => {
    if (componentOf(node) === TABS.root) out.push(...lintTabs(node, path));
    out.push(...lintSteps(node, path));
  });
  return out;
}
