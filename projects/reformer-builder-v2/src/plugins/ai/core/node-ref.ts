/**
 * Адресация узлов для агента: JSON Pointer вместо массива-пути.
 *
 * Почему Pointer, а не собственные ID узлов в side-map: указатель уже есть в модели
 * (`toPointer`/`fromPointer`, `@/lib/form-model/paths`) и используется для подсветки raw-JSON, тогда как
 * реестр ID пришлось бы синхронизировать с каждой мутацией. Плата за Pointer — он «съезжает»,
 * если соседей вставили/удалили; лечится не реестром, а проверкой {@link NodeExpectation}:
 * инструмент объявляет, ЧТО он рассчитывает найти по адресу, и получает `STALE_POINTER`
 * вместо тихой правки чужого узла.
 *
 * `fromPointer` намеренно оставляет индексы строками (Pointer не различает индекс и ключ), но
 * {@link refToPath} приводит их к числам. Это не косметика: большинство функций `@/lib/form-model/*` приводят
 * сегмент сами, а `ungroupNode` проверяет `typeof last === 'number'` и на строке молча ничего не
 * делает. Нормализация в одном месте убирает весь класс таких расхождений — путь из адреса
 * неотличим от пути, который строит сам редактор.
 *
 * ## Что отсюда УЕХАЛО в домен
 *
 * Читатели узла — `componentOf`, `modelOf`, `labelOf` — в v1 жили здесь, и `model/selectors`
 * импортировал их ОТСЮДА: домен зависел от агента. В v2 они переехали в
 * `@/lib/form-model/node-ref`, а здесь остались реэкспортом ради одного правила: имя компонента
 * узла обязано читаться ОДИНАКОВО палитрой и ассистентом. Вторая копия разошлась бы с первой на
 * первом же новом виде узла, и разошлась бы молча.
 *
 * Адресация инструментов ({@link resolveRef}, {@link NodeExpectation}, `STALE_POINTER`) осталась
 * здесь: это протокол агента, а не знание о форме.
 *
 * @module plugins/ai/core/node-ref
 */

import type { JsonNode, JsonFormSchema } from '@reformer/renderer-json';
import { componentOf, modelOf } from '@/lib/form-model/node-ref';
import { isNodeLike } from '@/lib/form-model/node-kind';
import { fromPointer, getAt, toPointer, type JsonPath } from '@/lib/form-model/paths';
import { fail, type ToolOutcome } from './types';

export { ARRAY_COMPONENT_NAME, componentOf, labelOf, modelOf } from '@/lib/form-model/node-ref';

/** Что вызывающий рассчитывает найти по адресу. Любое заданное поле обязано совпасть. */
export interface NodeExpectation {
  /** Каталожное имя: `Input`, `$html(div)`, `FormArray`. `null` — не проверять (см. `EXPECT_PROP`). */
  component?: string | null;
  /** Путь модели без обёртки оператора: `applicant.email`. `null` — не проверять. */
  model?: string | null;
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

/** Узел, найденный по адресу. */
export interface ResolvedNode {
  node: JsonNode;
  path: JsonPath;
}

/** Хвосты адреса, которыми заканчивается СЛОТ, а не узел (см. `@/lib/form-model/node-kind`). */
const SLOT_TAILS = ['/children', '/componentProps/steps', '/item/$template'];

/**
 * Если адрес указывает на слот — адрес узла-держателя, иначе `undefined`.
 *
 * Слот легко спутать с узлом: в дайджесте он не показывается, а по смыслу «вставить в children»
 * звучит естественнее, чем «вставить в узел». Подсказка называет правильный адрес прямо, чтобы
 * следующий вызов был верным, а не ещё одним чтением карты.
 */
function slotHolderRef(ref: string): string | undefined {
  const tail = SLOT_TAILS.find((t) => ref.endsWith(t));
  if (!tail) return undefined;
  const holder = ref.slice(0, -tail.length);
  return holder || '/root';
}

/**
 * Сообщение для адреса с индексом за пределами слота, либо `undefined`, если случай не тот.
 *
 * @param schema - Схема, в которой ищут.
 * @param path - Разобранный путь адреса.
 * @param ref - Исходный адрес — чтобы повторить его в тексте.
 */
function outOfRangeHint(schema: JsonFormSchema, path: JsonPath, ref: string): string | undefined {
  const last = path.at(-1);
  if (typeof last !== 'number') return undefined;
  const slot = getAt(schema, path.slice(0, -1));
  if (!Array.isArray(slot)) return undefined;

  const holder = slotHolderRef(nodeRef(path.slice(0, -1))) ?? '/root';
  return slot.length === 0
    ? `No node at ${ref}: ${holder} is still empty. Insert the first node with parent=${holder}.`
    : `No node at ${ref}: ${holder} has ${slot.length} child(ren), indices 0…${slot.length - 1}.`;
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
    // Две разные беды приводили к одному совету «перезапроси карту», и один из них был ложным.
    // Адрес, указывающий на СЛОТ (`/root/children`, `…/componentProps/steps`), — не устаревший:
    // форму никто не менял, и повторный get_form_outline вернёт ровно то же. Наблюдалось вживую:
    // модель перечитывала карту пять раз подряд и упиралась в предел шагов, так и не вставив узел.
    const holder = slotHolderRef(ref);
    if (holder) {
      return fail(
        'STALE_POINTER',
        `${ref} is a slot, not a node. Pass the node itself as the parent: ${holder}.`
      );
    }
    // Индекс за пределами слота — вторая половина той же беды: «перезапроси карту» ничего не
    // добавит, если карта уже прочитана и в контейнере просто нет столько детей. Называем, сколько
    // их есть, — по этому числу видно и что адрес невозможен, и куда класть следующий узел.
    const outside = outOfRangeHint(schema, path, ref);
    if (outside) return fail('STALE_POINTER', outside);

    return fail(
      'STALE_POINTER',
      `No node at ${ref} — the form changed. Call get_form_outline again.`
    );
  }
  if (expect?.component) {
    const actual = componentOf(node);
    if (actual !== expect.component) {
      return fail(
        'STALE_POINTER',
        `Expected ${expect.component} at ${ref}, found ${actual ?? 'a node without a component'}. Call get_form_outline again.`
      );
    }
  }
  if (expect?.model) {
    const actual = modelOf(node);
    if (actual !== expect.model) {
      return fail(
        'STALE_POINTER',
        `Expected model ${expect.model} at ${ref}, found ${actual ?? 'a node without a model'}. Call get_form_outline again.`
      );
    }
  }
  return { node, path };
}

/** Отличить успешный резолв от ошибки. */
export function isResolved(v: ResolvedNode | ToolOutcome): v is ResolvedNode {
  return 'node' in v;
}
