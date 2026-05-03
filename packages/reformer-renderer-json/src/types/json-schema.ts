/**
 * Типы для JSON-схемы формы
 *
 * @module reformer/renderer-json/types
 */

/**
 * Унифицированный узел JSON-схемы
 *
 * Может представлять:
 * - Поле формы (если указан `model`)
 * - Контейнер/компонент (если указан только `component`)
 * - Поле с кастомным компонентом (если указаны оба)
 *
 * @example
 * ```json
 * // Поле формы с дефолтным компонентом
 * { "model": "email" }
 *
 * // Поле с кастомным компонентом
 * { "model": "password", "component": "InputPassword" }
 *
 * // Контейнер
 * { "component": "Box", "children": [...] }
 * ```
 */
export interface JsonNode {
  /**
   * Идентификатор узла для renderBehavior (hideWhen, patchProps).
   * Необязателен — нужен только если к узлу привязано поведение.
   */
  selector?: string;

  /**
   * Имя компонента из реестра: "Input", "Box", "Section", "Select"
   *
   * - Для полей: компонент для рендеринга значения (опционально, по умолчанию Input)
   * - Для контейнеров: React-компонент контейнера (обязательно)
   */
  component?: string;

  /**
   * Путь к полю формы (модели): "email", "personalData.firstName", "addresses[0].city"
   *
   * Если указан — узел представляет поле формы.
   */
  model?: string;

  /**
   * Props для компонента (className, title и т.д.)
   */
  componentProps?: Record<string, unknown>;

  /**
   * Дочерние узлы (для контейнеров)
   */
  children?: JsonNode[];

  /**
   * Обёртка для узла (например, fieldWrapper)
   *
   * @example
   * ```json
   * {
   *   "model": "email",
   *   "wrapper": {
   *     "component": "FormField",
   *     "componentProps": { "className": "col-span-2" }
   *   }
   * }
   * ```
   */
  wrapper?: JsonNode;
}

/**
 * Корневая JSON-схема формы
 *
 * @example
 * ```json
 * {
 *   "version": "1.0",
 *   "root": {
 *     "component": "Box",
 *     "componentProps": { "className": "space-y-4" },
 *     "children": [
 *       { "model": "email" },
 *       { "model": "password", "component": "InputPassword" }
 *     ]
 *   }
 * }
 * ```
 */
export interface JsonFormSchema {
  /**
   * Версия схемы (для миграций)
   */
  version?: string;

  /**
   * Корневой узел схемы
   */
  root: JsonNode;
}

/**
 * Type guard: проверяет, является ли узел полем формы (имеет `model`).
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если у узла есть непустое `model`.
 *
 * @example
 * ```typescript
 * if (isFieldNode(node)) {
 *   // node.model гарантированно строка
 *   readField(node.model);
 * }
 * ```
 */
export function isFieldNode(node: JsonNode): boolean {
  return typeof node.model === 'string' && node.model.length > 0;
}

/**
 * Type guard: проверяет, является ли узел контейнером (только `component`, без `model`).
 *
 * @param node - Узел JSON-схемы.
 * @returns `true`, если у узла есть `component`, но нет `model`.
 *
 * @example
 * ```typescript
 * if (isContainerNode(node)) {
 *   node.children?.forEach(walk);
 * }
 * ```
 */
export function isContainerNode(node: JsonNode): boolean {
  return typeof node.component === 'string' && !isFieldNode(node);
}
