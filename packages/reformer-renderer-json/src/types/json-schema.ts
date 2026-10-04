/**
 * Типы JSON-схемы формы — формат 2 (строковый операторный DSL).
 *
 * Узел привязывается к модели одним ключом — `model: '$model(path)'`. Чем он является, решают
 * соседние ключи:
 * - {@link JsonFieldNode} — поле: `model` (+ опц. `component: '$component(Name)'`).
 * - {@link JsonArrayNode} — массив под-форм: `model` + `item` (шаблон строки).
 * - {@link JsonPartNode} — подформа: `model` + `part: '$part(name)'` (именованная часть документа).
 * - {@link JsonContainerNode} — контейнер: `component` (+ `children`), без `model`.
 *
 * `selector` — plain-строка, id узла для поведения формы (`schema.node('…')`), НЕ путь модели.
 * Привязки — только строки-операторы из `operators.ts` (голые строки не резолвятся). Схема —
 * чистый JSON (без вызовов функций), типобезопасна через template-literal типы.
 *
 * Прежний формат (ключи `value` / `array`, шаги в `componentProps.steps`) описан типами с
 * суффиксом `V1` — `./json-schema-v1`; документ переводит `migrateJsonSchema`.
 *
 * @module reformer/renderer-json/types
 */

import {
  isModelOp,
  isComponentOp,
  isHtmlOp,
  isPartOp,
  type ModelOp,
  type ComponentOp,
  type HtmlOp,
  type PartOp,
} from '../operators';

/**
 * Текстовая часть содержимого — элемент `children`, не являющийся узлом. Строки могут быть
 * операторами: `'$model(path)'` даёт реактивное значение модели, `'$locale(key)'` — строку
 * локализации, остальные строки — литералы. Соседние части склеиваются без разделителя.
 *
 * @example
 * ```json
 * { "component": "$html(p)", "children": ["Платёж: ", "$model(monthlyPayment)", " ₽"] }
 * ```
 */
export type JsonTextChild = string | number;

/** Поле формы: значение из модели (`$model`) + опциональный компонент (`$component`, дефолт — Input). */
export interface JsonFieldNode<T = unknown> {
  /**
   * Стабильный идентификатор узла, 8 символов base36. Выдаётся инструментом (билдером),
   * а не автором: `selector` человек пишет руками и адресует им поведение формы,
   * `$nodeId` машина выдаёт при разборе и в поведении не адресуется.
   *
   * Конвертером **игнорируется** — до render-узла и до DOM не доходит.
   */
  $nodeId?: string;
  /** Id узла для поведения формы (hideWhen/patchProps). Опционален. */
  selector?: string;
  /** Привязка к сигналу модели: `'$model(personalData.lastName)'`. С типом `T` путь сужается до {@link Path}<T>. */
  model: ModelOp<T>;
  /** Компонент поля из реестра: `'$component(Select)'`. Опционален. */
  component?: ComponentOp;
  /** Props компонента; значения могут содержать строки-операторы (`'$dataSource(NAME)'`) или вложенные узлы. */
  componentProps?: Record<string, unknown>;
  /** Обёртка поля (например, FormField). */
  wrapper?: JsonNode<T>;
}

/**
 * Массив под-форм: привязка к массиву модели (`$model`) + шаблон строки.
 *
 * Шаблон строки — либо вписанный узел (`{ "$template": {…} }`), либо именованная часть документа
 * (`"$part(name)"`). Пути `$model(...)` внутри шаблона относительны СТРОКЕ, а не корню формы.
 *
 * Без `component` рендерится безхромно (только строки); компонент секции — `'$component(FormArray)'`
 * (добавить / удалить / переставить) либо `'$component(List)'` для списка без управления.
 */
export interface JsonArrayNode<T = unknown> {
  /**
   * Стабильный идентификатор узла, 8 символов base36. Выдаётся инструментом (билдером),
   * а не автором: `selector` человек пишет руками и адресует им поведение формы,
   * `$nodeId` машина выдаёт при разборе и в поведении не адресуется.
   *
   * Конвертером **игнорируется** — до render-узла и до DOM не доходит.
   */
  $nodeId?: string;
  /** Id узла для поведения формы. */
  selector?: string;
  /** Привязка к массиву модели: `'$model(coBorrowers)'`. С типом `T` путь сужается до {@link Path}<T>. */
  model: ModelOp<T>;
  /**
   * Шаблон строки: вписанный узел либо именованная часть. Внутри `$model(...)` относителен к
   * СТРОКЕ, не к корню `T`, поэтому пути шаблона остаются нетипизированными.
   */
  item: { $template: JsonNode } | PartOp;
  /** Компонент-рендерер массива (`'$component(FormArray)'`). */
  component?: ComponentOp;
  /**
   * Запасной шаблон нового элемента для кнопки «Добавить» (литерал-объект по форме элемента).
   * Нужен только форме, чья модель создаётся из данных без кода: шаблон, объявленный в модели
   * (`arrayOf(blank)`), главнее.
   */
  initialValue?: Record<string, unknown>;
  /** Оформление секции массива / пропсы компонента-рендерера. */
  componentProps?: Record<string, unknown>;
}

/**
 * Подформа: именованная часть документа ({@link JsonFormSchema.parts}), подключённая к группе
 * модели. Пути `$model(...)` внутри части относительны этой группе, поэтому одна часть ставится в
 * документ сколько угодно раз — к разным группам той же формы данных.
 *
 * @example
 * ```json
 * { "model": "$model(registrationAddress)", "part": "$part(address)" }
 * ```
 */
export interface JsonPartNode<T = unknown> {
  /**
   * Стабильный идентификатор узла, 8 символов base36. Выдаётся инструментом (билдером),
   * а не автором. Конвертером **игнорируется**.
   */
  $nodeId?: string;
  /** Id узла для поведения формы. */
  selector?: string;
  /** Привязка к группе модели: `'$model(registrationAddress)'`. */
  model: ModelOp<T>;
  /** Именованная часть документа: `'$part(address)'`. */
  part: PartOp;
}

/**
 * Контейнер (Box/Section/FormWizard/Step/…) с дочерними узлами — либо блок нативной вёрстки
 * (`'$html(div)'`), для которого не нужен зарегистрированный компонент.
 */
export interface JsonContainerNode<T = unknown> {
  /**
   * Стабильный идентификатор узла, 8 символов base36. Выдаётся инструментом (билдером),
   * а не автором: `selector` человек пишет руками и адресует им поведение формы,
   * `$nodeId` машина выдаёт при разборе и в поведении не адресуется.
   *
   * Конвертером **игнорируется** — до render-узла и до DOM не доходит.
   */
  $nodeId?: string;
  /** Id узла для поведения формы. У шага визарда — ещё и ключ его правил в `validation.steps`. */
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
   * Содержимое узла: вложенные узлы и текстовые части ({@link JsonTextChild}) в любом порядке —
   * текст можно ставить и после узла (`[{ "component": "$html(b)", … }, " и далее текст"]`).
   * У визарда дети — его шаги; шаг, вынесенный в свой файл, стоит ссылкой {@link JsonStepRef}.
   */
  children?: JsonChild<T>[];
}

/** Узел JSON-схемы. `T` — форма модели: при указании `$model(...)` пути сужаются до {@link Path}<T>. */
export type JsonNode<T = unknown> =
  | JsonFieldNode<T>
  | JsonArrayNode<T>
  | JsonPartNode<T>
  | JsonContainerNode<T>;

/** Элемент `children`: вложенный узел либо текстовая часть ({@link JsonTextChild}). */
export type JsonChild<T = unknown> = JsonNode<T> | JsonTextChild;

/**
 * Корневая JSON-схема формы — формат 2.
 *
 * @example
 * ```ts
 * const schema: JsonFormSchema = {
 *   format: 2,
 *   parts: {
 *     address: {
 *       component: '$component(Box)',
 *       children: [{ model: '$model(city)', component: '$component(Input)' }],
 *     },
 *   },
 *   root: {
 *     component: '$component(Box)',
 *     children: [
 *       { model: '$model(email)', component: '$component(Input)' },
 *       { model: '$model(registrationAddress)', part: '$part(address)' },
 *     ],
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
  /**
   * Формат документа. `2` — этот формат; документ без поля — прежний формат (`JsonFormSchemaV1`),
   * его переводит `migrateJsonSchema`.
   */
  format: 2;
  /** Идентификатор схемы (произвольная строка: для реестров/трекинга). Игнорируется конвертером. */
  id?: string;
  /** Версия СОДЕРЖИМОГО формы (сверяется реестром форм). К формату документа не относится. */
  version?: string;
  /** Метаданные схемы (имя/описание — для каталогов/UI). Игнорируется конвертером. */
  meta?: {
    name?: string;
    description?: string;
  };
  /**
   * Именованные части документа: подформы и шаблоны строк массивов. Подключаются оператором
   * `$part(name)` — узлом-подформой `{ model, part }` либо шаблоном строки `"item": "$part(name)"`.
   * Пути `$model(...)` внутри части относительны под-модели места подключения.
   */
  parts?: Record<string, JsonNode>;
  /** Корневой узел. С типом `T` пути `$model(...)` в дереве сужаются до {@link Path}<T>. */
  root: JsonNode<T>;
}

/**
 * Ссылка на шаг визарда, вынесенный в свой файл: элемент `children` визарда в схеме, разбитой по
 * шагам. Конвертер её не понимает — перед сборкой формы схему собирает
 * {@link composeJsonFormSchema}.
 *
 * @example
 * ```json
 * { "$ref": "./steps/contacts/form.schema.json" }
 * ```
 */
export interface JsonStepRef {
  /** Относительный путь файла шага ({@link JsonFormStep}) от файла корневой схемы. */
  $ref: string;
}

/**
 * Файл шага визарда: узел шага без корня формы. Ключ — `node`, а не `root`, чтобы файл шага
 * не принимался за самостоятельную форму.
 *
 * @example
 * ```json
 * { "$schema": "../../form-step.schema.json", "node": { "component": "$component(Step)", "children": [] } }
 * ```
 */
export interface JsonFormStep<T = unknown> {
  /** Путь к мета-схеме файла шага для IDE. Игнорируется при сборке. */
  $schema?: string;
  /** Узел шага — то, что встаёт в `children` визарда на место ссылки. */
  node: JsonNode<T>;
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
 *   format: 2,
 *   root: {
 *     component: '$component(Box)',
 *     children: [{ model: '$model(personalData.firstName)', component: '$component(Input)' }],
 *     // { model: '$model(loanTyp)' } — ошибка компиляции: нет такого пути в CreditForm
 *   },
 * });
 * ```
 */
export function defineJsonSchema<T = unknown>(schema: JsonFormSchema<T>): JsonFormSchema<T> {
  return schema;
}

/**
 * Type-guard: узел — массив под-форм (`model: '$model(...)'` + `item`). Проверять ПЕРВЫМ:
 * привязку `model` несут и поле, и подформа.
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если узел — {@link JsonArrayNode}.
 *
 * @example Сузить тип узла перед доступом к `item`
 * ```ts
 * if (isArrayNode(node)) {
 *   node.model; // ModelOp
 *   node.item; // { $template } | '$part(name)'
 * }
 * ```
 */
export function isArrayNode(node: JsonNode): node is JsonArrayNode {
  const { model, item } = node as JsonArrayNode;
  if (!isModelOp(model)) return false;
  return isPartOp(item) || (typeof item === 'object' && item !== null && '$template' in item);
}

/**
 * Type-guard: узел — подформа (`model: '$model(...)'` + `part: '$part(...)'`).
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если узел — {@link JsonPartNode}.
 *
 * @example
 * ```ts
 * if (isPartNode(node)) {
 *   node.part; // '$part(address)'
 * }
 * ```
 */
export function isPartNode(node: JsonNode): node is JsonPartNode {
  const { model, part } = node as JsonPartNode;
  return isModelOp(model) && isPartOp(part);
}

/**
 * Type-guard: узел — поле (`model: '$model(...)'` без `item` и `part`).
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если узел — {@link JsonFieldNode}.
 *
 * @example Сузить тип узла перед доступом к `model`/`component`
 * ```ts
 * if (isFieldNode(node)) {
 *   node.model; // ModelOp
 *   node.component; // ComponentOp | undefined
 * }
 * ```
 */
export function isFieldNode(node: JsonNode): node is JsonFieldNode {
  return isModelOp((node as JsonFieldNode).model) && !isArrayNode(node) && !isPartNode(node);
}

/**
 * Type-guard: узел — контейнер (`component: '$component(...)'` или `'$html(...)'`, без `model`).
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если узел — {@link JsonContainerNode}.
 *
 * @example Сузить тип узла перед обходом `children`
 * ```ts
 * if (isContainerNode(node)) {
 *   node.component; // ComponentOp | HtmlOp
 *   node.children?.forEach(walk);
 * }
 * ```
 */
export function isContainerNode(node: JsonNode): node is JsonContainerNode {
  const component = (node as JsonContainerNode).component;
  return (
    (isComponentOp(component) || isHtmlOp(component)) && !isModelOp((node as JsonFieldNode).model)
  );
}

/**
 * Формат документа схемы: `2` — у документа есть поле `format: 2`; иначе — прежний формат `1`.
 *
 * @param schema - Документ схемы (любой: приходит и строкой с сервера).
 * @returns `1` либо `2`.
 *
 * @example
 * ```ts
 * if (schemaFormatOf(document) === 1) document = migrateJsonSchema(document);
 * ```
 */
export function schemaFormatOf(schema: unknown): 1 | 2 {
  return (schema as { format?: unknown } | null)?.format === 2 ? 2 : 1;
}
