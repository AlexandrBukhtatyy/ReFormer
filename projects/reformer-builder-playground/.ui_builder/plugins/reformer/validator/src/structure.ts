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
 * @module plugins/reformer/validator/structure
 */

import {
  isArrayNode,
  isPartNode,
  parseOperator,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { childSlots, isNodeLike, kindOf } from '../../core/form-model';
import { componentOf } from '../../core/form-model';
import { walkNodes } from '../../core/form-model';
import type { JsonPath } from '../../core/form-model';
import type { NodePart } from '@reformer/builder-plugin-api';
import { CODES, type DiagnosticCode } from './codes';

/** Замечание до того, как оно стало диагностикой: код, данные и узел-виновник. */
export interface Finding {
  readonly code: DiagnosticCode;
  readonly params?: Record<string, unknown>;
  /** Узел, к которому замечание относится; `undefined` — замечание о схеме целиком. */
  readonly node?: JsonNode;
  /**
   * Место ВНУТРИ узла, если оно у замечания есть: путь от самого узла.
   *
   * Ставится не везде, и это не недоделка. «Вкладке «one» не соответствует ни одна панель»
   * цитирует конкретное значение — его и надо подчеркнуть. «У вкладки нет value» говорит
   * о ключе, которого в тексте НЕТ, и подчёркивать там можно только объект, которому его
   * не хватает.
   */
  readonly within?: JsonPath;
  /** Что подчеркнуть у {@link within}: имя (по умолчанию) или значение. */
  readonly at?: NodePart;
}

/** Пропсы узла — общий адрес для замечаний, чей ключ в тексте отсутствует. */
const PROPS: JsonPath = ['componentProps'];
/** Значение внутри пропсов — адрес замечаний, которые цитируют это значение в своей фразе. */
const PROPS_VALUE: JsonPath = ['componentProps', 'value'];

/** Компонент-контейнер вкладок и имена его частей. */
const TABS = { root: 'Tabs', trigger: 'TabsTrigger', panel: 'TabsContent' } as const;

/** Значение `componentProps.value` узла, если оно строковое. */
function valueOf(node: JsonNode): string | undefined {
  const value = (node as { componentProps?: Record<string, unknown> }).componentProps?.value;
  return typeof value === 'string' ? value : undefined;
}

/** Именованные части документа (`parts`): разметка подформ и шаблонов строк вне дерева корня. */
type Parts = Readonly<Record<string, unknown>>;

/**
 * Имя части, из которой узел берёт разметку: подформа (`part`) либо массив с шаблоном строки
 * `item: "$part(имя)"`. У остальных узлов разметка лежит в них самих.
 */
function partNameOf(node: JsonNode): string | undefined {
  const ref = isPartNode(node) ? node.part : isArrayNode(node) ? node.item : undefined;
  const op = parseOperator(ref);
  return op?.op === 'part' ? op.arg : undefined;
}

/**
 * Все потомки узла (без него самого). Путь нужен только обходу слотов, наружу не отдаётся.
 *
 * Потомки — то, что рендерер построит ВНУТРИ узла, а не только то, что в нём записано: у подформы
 * и у массива с `item: "$part(имя)"` дочерних слотов нет, их разметка лежит в `parts` документа.
 * Не зайди обход туда, вкладке, чья панель вынесена в часть, достался бы ложный упрёк «панели
 * нет». Каждая часть обходится один раз на вызов: повторная ссылка новых потомков не даёт, а на
 * части, ссылающейся на саму себя, обход без этого не кончился бы.
 */
function descendants(node: JsonNode, path: JsonPath, parts: Parts): JsonNode[] {
  const out: JsonNode[] = [];
  const entered = new Set<string>();
  const rec = (current: JsonNode, currentPath: JsonPath): void => {
    for (const slot of childSlots(current, currentPath)) {
      for (const entry of slot.entries) {
        const childPath = slot.single ? slot.path : [...slot.path, entry.index];
        out.push(entry.node);
        rec(entry.node, childPath);
      }
    }
    const name = partNameOf(current);
    if (name === undefined || entered.has(name)) return;
    entered.add(name);
    // Части с таким именем может не быть — об этом скажет проверка схемы (`unknown-part`).
    const part = Object.hasOwn(parts, name) ? parts[name] : undefined;
    if (!isNodeLike(part)) return;
    out.push(part);
    rec(part, ['parts', name]);
  };
  rec(node, path);
  return out;
}

/** Замечания по одному узлу `Tabs`: кнопки без панелей, панели без кнопок, чужой `defaultValue`. */
function lintTabs(node: JsonNode, path: JsonPath, parts: Parts): Finding[] {
  const out: Finding[] = [];
  const inside = descendants(node, path, parts);
  const triggers = inside.filter((child) => componentOf(child) === TABS.trigger);
  const panels = inside.filter((child) => componentOf(child) === TABS.panel);
  if (triggers.length === 0 && panels.length === 0) return out;

  const triggerValues = new Set<string>();
  for (const trigger of triggers) {
    const value = valueOf(trigger);
    // Без `value` кнопка не связана ни с одной панелью: Radix свяжет её по `undefined`,
    // и две такие вкладки схлопнутся в одну.
    if (value === undefined)
      out.push({ code: CODES.TAB_WITHOUT_VALUE, node: trigger, within: PROPS });
    else triggerValues.add(value);
  }

  const panelValues = new Set<string>();
  for (const panel of panels) {
    const value = valueOf(panel);
    if (value === undefined) {
      out.push({ code: CODES.PANEL_WITHOUT_VALUE, node: panel, within: PROPS });
      continue;
    }
    panelValues.add(value);
    if (!triggerValues.has(value)) {
      out.push({
        code: CODES.PANEL_WITHOUT_TAB,
        params: { value },
        node: panel,
        within: PROPS_VALUE,
        at: 'value',
      });
    }
  }

  for (const trigger of triggers) {
    const value = valueOf(trigger);
    if (value !== undefined && !panelValues.has(value)) {
      out.push({
        code: CODES.TAB_WITHOUT_PANEL,
        params: { value },
        node: trigger,
        within: PROPS_VALUE,
        at: 'value',
      });
    }
  }

  const defaultValue = (node as { componentProps?: Record<string, unknown> }).componentProps
    ?.defaultValue;
  if (
    typeof defaultValue === 'string' &&
    triggerValues.size > 0 &&
    !triggerValues.has(defaultValue)
  ) {
    out.push({
      code: CODES.TABS_DEFAULT_VALUE_UNKNOWN,
      params: { value: defaultValue },
      node,
      within: ['componentProps', 'defaultValue'],
      at: 'value',
    });
  }
  return out;
}

/**
 * Шагом мастера может быть только контейнер: полю в не-контейнере некуда лечь.
 *
 * Шаги — это `children` визарда: слот шагов ({@link childSlots}, вид `steps`) есть только у него,
 * и лежит он там же, где дети любого контейнера. Есть ли в шаге место полям, говорят его
 * дочерние слоты — с одной оговоркой. Подформа и массив держат разметку не обязательно в узле:
 * у подформы она целиком в `parts` документа, у массива шаблон строки бывает ссылкой
 * `item: "$part(имя)"`. Слотов у такого узла нет, а место полям есть — замечания он не получает.
 */
function lintSteps(node: JsonNode, path: JsonPath): Finding[] {
  const out: Finding[] = [];
  for (const slot of childSlots(node, path)) {
    if (slot.kind !== 'steps') continue;
    for (const entry of slot.entries) {
      const kind = kindOf(entry.node);
      if (kind === 'part' || kind === 'array') continue;
      if (childSlots(entry.node, [...slot.path, entry.index]).length > 0) continue;
      out.push({
        code: CODES.STEP_NOT_CONTAINER,
        params: { name: componentOf(entry.node) ?? '' },
        node: entry.node,
        // Имя не-контейнера стоит в значении `component` — оттуда же берётся `params.name`.
        within: ['component'],
        at: 'value',
      });
    }
  }
  return out;
}

/** Структурные замечания к форме. Пустой массив — связи в порядке. */
export function structureFindings(schema: JsonFormSchema): Finding[] {
  const out: Finding[] = [];
  const parts: Parts = schema.parts ?? {};
  walkNodes(schema, (node, path) => {
    if (componentOf(node) === TABS.root) out.push(...lintTabs(node, path, parts));
    out.push(...lintSteps(node, path));
  });
  return out;
}
