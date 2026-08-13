/**
 * Структурный линт: связи между узлами, которых не видит схемная валидация.
 *
 * `validateFormSchema` проверяет узлы ПООДИНОЧКЕ — форма, где вкладка ссылается в пустоту, а шаг
 * недостижим, проходит её без замечаний. Именно так выглядели формы, собранные ассистентом: по
 * схеме валидны, на экране мертвы (не открыта ни одна вкладка, четыре кнопки на три панели).
 *
 * Замечания линта — ПРЕДУПРЕЖДЕНИЯ, а не ошибки, и это не мягкость ради мягкости: применение хода
 * (`agent/apply`) требует полной валидности без сравнения с базой, поэтому ошибка на чужой,
 * изначально кривой форме заблокировала бы агенту любую работу — включая ту, которая эту форму
 * чинит. Предупреждение доходит до модели через `validate_form` и до человека — при сохранении.
 *
 * @module reformer-builder/io/structure-lint
 */

import { parseOperator, type JsonFormSchema, type JsonNode } from '@reformer/renderer-json';
import { childSlots, toPointer, walkNodes, type JsonPath } from '../model';

/** Компонент-контейнер вкладок и имена его частей. */
const TABS = { root: 'Tabs', trigger: 'TabsTrigger', panel: 'TabsContent' } as const;

/** Каталожное имя компонента узла. */
function nameOf(node: JsonNode): string | undefined {
  const op = parseOperator((node as { component?: unknown }).component);
  return op?.op === 'component' ? op.arg : undefined;
}

/** Значение `componentProps.value` узла, если оно строковое. */
function valueOf(node: JsonNode): string | undefined {
  const v = (node as { componentProps?: Record<string, unknown> }).componentProps?.value;
  return typeof v === 'string' ? v : undefined;
}

/** Все потомки узла (без него самого) с их путями. */
function descendants(node: JsonNode, path: JsonPath): Array<{ node: JsonNode; path: JsonPath }> {
  const out: Array<{ node: JsonNode; path: JsonPath }> = [];
  const rec = (n: JsonNode, p: JsonPath) => {
    for (const slot of childSlots(n, p)) {
      for (const entry of slot.entries) {
        const childPath = slot.single ? slot.path : [...slot.path, entry.index];
        out.push({ node: entry.node, path: childPath });
        rec(entry.node, childPath);
      }
    }
  };
  rec(node, path);
  return out;
}

/** Замечания по одному узлу `Tabs`. */
function lintTabs(node: JsonNode, path: JsonPath): string[] {
  const out: string[] = [];
  const inside = descendants(node, path);
  const triggers = inside.filter((e) => nameOf(e.node) === TABS.trigger);
  const panels = inside.filter((e) => nameOf(e.node) === TABS.panel);
  if (!triggers.length && !panels.length) return out;

  const triggerValues = new Set<string>();
  for (const t of triggers) {
    const v = valueOf(t.node);
    if (v === undefined) {
      // Без value кнопка не связана ни с одной панелью: Radix свяжет её по `undefined`, и две
      // такие вкладки схлопнутся в одну.
      out.push(`${toPointer(t.path)}: tab has no value — it will open no panel.`);
      continue;
    }
    triggerValues.add(v);
  }

  const panelValues = new Set<string>();
  for (const p of panels) {
    const v = valueOf(p.node);
    if (v === undefined) {
      out.push(`${toPointer(p.path)}: panel has no value — it cannot be reached.`);
      continue;
    }
    panelValues.add(v);
    if (!triggerValues.has(v)) {
      out.push(`${toPointer(p.path)}: panel value="${v}" has no tab — its content is unreachable.`);
    }
  }

  for (const t of triggers) {
    const v = valueOf(t.node);
    if (v !== undefined && !panelValues.has(v)) {
      out.push(`${toPointer(t.path)}: tab value="${v}" has no panel — it opens nothing.`);
    }
  }

  const defaultValue = (node as { componentProps?: Record<string, unknown> }).componentProps
    ?.defaultValue;
  if (typeof defaultValue === 'string' && triggerValues.size && !triggerValues.has(defaultValue)) {
    out.push(
      `${toPointer(path)}: defaultValue="${defaultValue}" matches no tab — nothing will be ` +
        `selected when the form opens.`
    );
  }
  return out;
}

/** Замечания по элементам слота шагов: шагом может быть только контейнер с телом. */
function lintSteps(node: JsonNode, path: JsonPath): string[] {
  const out: string[] = [];
  for (const slot of childSlots(node, path)) {
    if (slot.kind !== 'steps') continue;
    for (const entry of slot.entries) {
      if (!childSlots(entry.node, [...slot.path, entry.index]).length) {
        const name = nameOf(entry.node) ?? 'a node';
        out.push(
          `${toPointer([...slot.path, entry.index])}: ${name} stands as a wizard step — a step must be ` +
            `a container that fields go into.`
        );
      }
    }
  }
  return out;
}

/**
 * Структурные замечания к форме.
 *
 * @param schema - Проверяемая схема.
 * @returns Список предупреждений; пустой — если связи в порядке.
 */
export function lintStructure(schema: JsonFormSchema): string[] {
  const out: string[] = [];
  walkNodes(schema, (node, path) => {
    if (nameOf(node) === TABS.root) out.push(...lintTabs(node, path));
    out.push(...lintSteps(node, path));
  });
  return out;
}
