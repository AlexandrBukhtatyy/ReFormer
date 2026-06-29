/**
 * Типы JSON-схемы формы (M1, строковый операторный DSL).
 *
 * Узел — дискриминированный union по строке-оператору, которую он несёт:
 * - {@link JsonFieldNode} — лист: `value: '$model(path)'` (+ опц. `component: '$component(Name)'`).
 * - {@link JsonArrayNode} — массив: `array: '$model(path)'` + `item: { $template }`.
 * - {@link JsonContainerNode} — контейнер: `component: '$component(Name)'` (+ `children`).
 *
 * `selector` — plain-строка, id для render-behavior (`schema.node('…')`), НЕ путь модели.
 * Привязки — только строки-операторы из `operators.ts` (голые строки не резолвятся). Схема —
 * чистый JSON (без вызовов функций), типобезопасна через template-literal типы.
 *
 * @module reformer/renderer-json/types
 */

import { isModelOp, isComponentOp, type ModelOp, type ComponentOp } from '../operators';

/** Лист формы: значение из модели (`$model`) + опциональный компонент (`$component`, дефолт — Input). */
export interface JsonFieldNode {
  /** Id для render-behavior (hideWhen/patchProps). Опционален. */
  selector?: string;
  /** Привязка к сигналу модели: `'$model(personalData.lastName)'`. */
  value: ModelOp;
  /** Компонент поля из реестра: `'$component(Select)'`. Опционален. */
  component?: ComponentOp;
  /** Props компонента; значения могут содержать строки-операторы (`'$dataSource(NAME)'`) или вложенные узлы. */
  componentProps?: Record<string, unknown>;
  /** Обёртка поля (например, FormField). */
  wrapper?: JsonNode;
}

/** Массив форм: данные из модели (`$model`) + шаблон элемента (`$template`). */
export interface JsonArrayNode {
  /** Id для render-behavior. */
  selector?: string;
  /** Привязка к массиву модели: `'$model(coBorrowers)'`. */
  array: ModelOp;
  /** Шаблон под-схемы элемента. */
  item: { $template: JsonNode };
  /**
   * «Пустой» элемент для кнопки «Добавить» (литерал-объект по форме элемента).
   * Нужен, т.к. листья шаблона несут `value: '$model(...)'`, а не литерал-дефолт.
   */
  initialValue?: Record<string, unknown>;
  /** Оформление секции массива (title/addButtonLabel/itemLabel/emptyMessage/…). */
  componentProps?: Record<string, unknown>;
}

/** Контейнер (Box/Section/Wizard/Step/…) с дочерними узлами. */
export interface JsonContainerNode {
  /** Id для render-behavior. */
  selector?: string;
  /** Компонент-контейнер из реестра: `'$component(Section)'`. */
  component: ComponentOp;
  /** Props компонента; значения могут содержать строки-операторы или вложенные узлы. */
  componentProps?: Record<string, unknown>;
  /** Дочерние узлы. */
  children?: JsonNode[];
}

/** Узел JSON-схемы (M1). */
export type JsonNode = JsonFieldNode | JsonArrayNode | JsonContainerNode;

/**
 * Корневая JSON-схема формы.
 *
 * @example
 * ```ts
 * const schema: JsonFormSchema = {
 *   version: '1.0',
 *   root: {
 *     component: '$component(Box)',
 *     children: [{ value: '$model(email)', component: '$component(Input)' }],
 *   },
 * };
 * ```
 */
export interface JsonFormSchema {
  /** Версия схемы (для миграций). */
  version?: string;
  /** Корневой узел. */
  root: JsonNode;
}

/** Type-guard: узел — массив (`array: '$model(...)'` + `item.$template`). Проверять ПЕРВЫМ. */
export function isArrayNode(node: JsonNode): node is JsonArrayNode {
  const n = node as JsonArrayNode;
  return (
    isModelOp(n.array) && typeof n.item === 'object' && n.item !== null && '$template' in n.item
  );
}

/** Type-guard: узел — лист (`value: '$model(...)'`). */
export function isFieldNode(node: JsonNode): node is JsonFieldNode {
  return isModelOp((node as JsonFieldNode).value);
}

/** Type-guard: узел — контейнер (`component: '$component(...)'`, без `value`/`array`). */
export function isContainerNode(node: JsonNode): node is JsonContainerNode {
  return (
    isComponentOp((node as JsonContainerNode).component) && !isFieldNode(node) && !isArrayNode(node)
  );
}
