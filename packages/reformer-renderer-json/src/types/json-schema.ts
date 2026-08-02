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

import {
  isModelOp,
  isComponentOp,
  isHtmlOp,
  type ModelOp,
  type ComponentOp,
  type HtmlOp,
} from '../operators';

/**
 * Текстовое содержимое узла ({@link JsonContainerNode.text}). Строки могут быть операторами:
 * `'$model(path)'` даёт реактивное значение модели, `'$locale(key)'` — строку локализации,
 * остальные строки — литералы. Массив склеивается без разделителя.
 *
 * @example
 * ```json
 * { "component": "$html(p)", "text": ["Платёж: ", "$model(monthlyPayment)", " ₽"] }
 * ```
 */
export type JsonText = string | number | Array<string | number>;

/** Лист формы: значение из модели (`$model`) + опциональный компонент (`$component`, дефолт — Input). */
export interface JsonFieldNode<T = unknown> {
  /** Id для render-behavior (hideWhen/patchProps). Опционален. */
  selector?: string;
  /** Привязка к сигналу модели: `'$model(personalData.lastName)'`. С типом `T` путь сужается до {@link Path}<T>. */
  value: ModelOp<T>;
  /** Компонент поля из реестра: `'$component(Select)'`. Опционален. */
  component?: ComponentOp;
  /** Props компонента; значения могут содержать строки-операторы (`'$dataSource(NAME)'`) или вложенные узлы. */
  componentProps?: Record<string, unknown>;
  /** Обёртка поля (например, FormField). */
  wrapper?: JsonNode<T>;
}

/**
 * Итерация массива модели (`$model`) + шаблон элемента (`$template`).
 *
 * По умолчанию рендерится встроенной редактируемой секцией (add/remove/reorder). Опциональный
 * `component` уводит рендер на зарегистрированный компонент — например `'$component(List)'` для
 * chrome-less display-списка (алерты) или своя секция с кастомным хромом. Дисплей-vs-редактирование —
 * это выбор компонента, а не отдельный тип узла. `initialValue` нужен только редактируемому пути
 * (кнопка «Добавить»); при `component` display-компоненты его игнорируют.
 */
export interface JsonArrayNode<T = unknown> {
  /** Id для render-behavior. */
  selector?: string;
  /** Привязка к массиву модели: `'$model(coBorrowers)'`. С типом `T` путь сужается до {@link Path}<T>. */
  array: ModelOp<T>;
  /**
   * Шаблон под-схемы элемента (внутри `$model(...)` относителен к ЭЛЕМЕНТУ, не к корню `T`),
   * поэтому его пути остаются нетипизированными (`JsonNode` без параметра).
   */
  item: { $template: JsonNode };
  /**
   * Компонент-рендерер массива (`'$component(List)'`). Опционален: без него — встроенная
   * редактируемая секция. С ним рендер идёт этим компонентом (он получает контрол массива,
   * `item`-фабрику и готовые элементы children).
   */
  component?: ComponentOp;
  /**
   * «Пустой» элемент для кнопки «Добавить» (литерал-объект по форме элемента).
   * Нужен, т.к. листья шаблона несут `value: '$model(...)'`, а не литерал-дефолт. Только для
   * редактируемого (встроенного) пути.
   */
  initialValue?: Record<string, unknown>;
  /** Оформление секции массива / пропсы компонента-рендерера. */
  componentProps?: Record<string, unknown>;
}

/**
 * Контейнер (Box/Section/Wizard/Step/…) с дочерними узлами — либо блок нативной вёрстки
 * (`'$html(div)'`), для которого не нужен зарегистрированный компонент.
 */
export interface JsonContainerNode<T = unknown> {
  /** Id для render-behavior. */
  selector?: string;
  /**
   * Компонент-контейнер из реестра (`'$component(Section)'`) либо нативный HTML-тег
   * (`'$html(div)'`). Для тега `componentProps` — DOM-атрибуты, и они проходят чистку
   * (`sanitizeHtmlProps`): обработчики `on*`, `dangerouslySetInnerHTML` и `javascript:`-URL
   * отбрасываются.
   */
  component: ComponentOp | HtmlOp;
  /** Props компонента; значения могут содержать строки-операторы или вложенные узлы. */
  componentProps?: Record<string, unknown>;
  /**
   * Текстовое содержимое узла (литерал, `$model(...)`, `$locale(...)` или массив частей).
   * Рендерится перед `children`.
   */
  text?: JsonText;
  /** Дочерние узлы. */
  children?: JsonNode<T>[];
}

/** Узел JSON-схемы (M1). `T` — форма модели: при указании `$model(...)` пути сужаются до {@link Path}<T>. */
export type JsonNode<T = unknown> = JsonFieldNode<T> | JsonArrayNode<T> | JsonContainerNode<T>;

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
export interface JsonFormSchema<T = unknown> {
  /**
   * Путь к мета-схеме для IDE (VSCode подсветит структуру/синтаксис/имена `$component`).
   * Игнорируется конвертером. Сгенерировать конкретную мета-схему: `gen-form-json-schema.ts`.
   */
  $schema?: string;
  /** Версия схемы (для миграций). */
  version?: string;
  /** Корневой узел. С типом `T` пути `$model(...)` в дереве сужаются до {@link Path}<T>. */
  root: JsonNode<T>;
}

/**
 * Идентити-хелпер, ТИПИЗИРУЮЩИЙ литерал схемы по форме модели `T`: внутри `$model(...)` пути
 * сужаются до {@link Path}<T> (опечатка ловится компилятором), и не нужен `as unknown as JsonFormSchema`.
 * Для схемы-строки-с-сервера (тип формы неизвестен) используйте `JsonFormSchema` без параметра.
 *
 * @typeParam T - Форма данных модели.
 * @param schema - Литерал схемы, типизируемый по `T`.
 * @returns Та же схема с типом `JsonFormSchema<T>`.
 *
 * @example
 * ```ts
 * interface CreditForm { loanType: string; personalData: { firstName: string } }
 * const schema = defineJsonSchema<CreditForm>({
 *   version: '1.0',
 *   root: {
 *     component: '$component(Box)',
 *     children: [{ value: '$model(personalData.firstName)', component: '$component(Input)' }],
 *     // { value: '$model(loanTyp)' } — ошибка компиляции: нет такого пути в CreditForm
 *   },
 * });
 * ```
 */
export function defineJsonSchema<T = unknown>(schema: JsonFormSchema<T>): JsonFormSchema<T> {
  return schema;
}

/**
 * Type-guard: узел — массив (`array: '$model(...)'` + `item.$template`). Проверять ПЕРВЫМ
 * (лист/контейнер отсеиваются после, т.к. массив тоже несёт `$model`).
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если узел — {@link JsonArrayNode}.
 *
 * @example Сузить тип узла перед доступом к `item.$template`
 * ```ts
 * if (isArrayNode(node)) {
 *   node.array;            // ModelOp
 *   node.item.$template;   // JsonNode
 * }
 * ```
 */
export function isArrayNode(node: JsonNode): node is JsonArrayNode {
  const n = node as JsonArrayNode;
  return (
    isModelOp(n.array) && typeof n.item === 'object' && n.item !== null && '$template' in n.item
  );
}

/**
 * Type-guard: узел — лист (`value: '$model(...)'`).
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если узел — {@link JsonFieldNode}.
 *
 * @example Сузить тип узла перед доступом к `value`/`component`
 * ```ts
 * if (isFieldNode(node)) {
 *   node.value;      // ModelOp
 *   node.component;  // ComponentOp | undefined
 * }
 * ```
 */
export function isFieldNode(node: JsonNode): node is JsonFieldNode {
  return isModelOp((node as JsonFieldNode).value);
}

/**
 * Type-guard: узел — контейнер (`component: '$component(...)'` или `'$html(...)'`,
 * без `value`/`array`).
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если узел — {@link JsonContainerNode}.
 *
 * @example Сузить тип узла перед обходом `children`
 * ```ts
 * if (isContainerNode(node)) {
 *   node.component;   // ComponentOp | HtmlOp
 *   node.children?.forEach(walk);
 * }
 * ```
 */
export function isContainerNode(node: JsonNode): node is JsonContainerNode {
  const component = (node as JsonContainerNode).component;
  return (
    (isComponentOp(component) || isHtmlOp(component)) && !isFieldNode(node) && !isArrayNode(node)
  );
}
