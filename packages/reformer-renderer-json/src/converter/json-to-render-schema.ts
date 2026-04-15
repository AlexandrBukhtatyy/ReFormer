/**
 * Конвертер JSON-схемы в RenderSchema
 *
 * @module reformer/renderer-json/converter
 */

import type {
  RenderSchemaFn,
  RenderNode,
  FieldRenderNode,
  ContainerRenderNode,
} from '@reformer/renderer-react';
import type { FieldPath, FieldPathNode } from '@reformer/core';
import type { JsonFormSchema, JsonNode } from '../types/json-schema';
import type { ComponentRegistry } from '../registry/types';

/**
 * Получает FieldPathNode по строковому пути
 *
 * Поддерживает:
 * - Простые пути: "email", "password"
 * - Вложенные пути: "personalData.firstName"
 * - Индексы массивов: "addresses[0].city"
 *
 * @param path - Корневой FieldPath
 * @param fieldPath - Строковый путь к полю
 * @returns FieldPathNode для поля
 * @throws Error если путь невалидный
 */
function getFieldPathNode<T>(
  path: FieldPath<T>,
  fieldPath: string
): FieldPathNode<unknown, unknown, unknown> {
  // Разбиваем путь на сегменты: "addresses[0].city" → ["addresses", "0", "city"]
  const segments = fieldPath.split(/\.|\[|\]/).filter(Boolean);

  let current: unknown = path;

  for (const segment of segments) {
    if (current == null) {
      throw new Error(`Invalid field path: "${fieldPath}" - segment "${segment}" not found`);
    }

    // Для числовых индексов (массивы)
    const index = parseInt(segment, 10);
    if (!isNaN(index)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current = (current as any)[index];
    } else {
      // Для строковых ключей
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current = (current as any)[segment];
    }
  }

  if (current == null) {
    throw new Error(`Invalid field path: "${fieldPath}" - path resolved to null/undefined`);
  }

  return current as FieldPathNode<unknown, unknown, unknown>;
}

/**
 * Эвристика: похож ли объект на JsonNode (имеет `model` или `component`-строку).
 */
function looksLikeJsonNode(value: unknown): value is JsonNode {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.model === 'string' || typeof obj.component === 'string';
}

/**
 * Ссылка на поле формы: `{ $model: 'properties' }` резолвится в FieldPathNode.
 * Используется для пропсов, которые принимают FieldPath (array в RendererFormArraySection).
 */
function isModelRef(value: unknown): value is { $model: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { $model?: unknown }).$model === 'string'
  );
}

/**
 * Шаблон-обёртка: `{ $template: <JsonNode> }` превращается в функцию
 * `(itemPath) => RenderNode`, где `model:` внутри шаблона резолвится против `itemPath`.
 * Используется для itemComponent в RendererFormArraySection и подобных мест,
 * где callable нельзя выразить чистым JSON.
 */
function isTemplateRef(value: unknown): value is { $template: JsonNode } {
  return (
    value !== null &&
    typeof value === 'object' &&
    looksLikeJsonNode((value as { $template?: unknown }).$template)
  );
}

/**
 * Преобразует значение внутри componentProps:
 * - JsonNode → RenderNode
 * - массив JsonNode → массив RenderNode
 * - строка, совпадающая с source-записью в registry → значение source
 * - функция с сигнатурой `(itemPath) => JsonNode` — оборачивается так,
 *   чтобы возвращать RenderNode (нужно для `itemComponent` в массивах)
 * - остальное возвращается как есть
 */
function transformPropValue<T>(
  value: unknown,
  path: FieldPath<T>,
  registry: ComponentRegistry
): unknown {
  // 1. Строковый source ref. Если source — функция (itemComponent и т.п.),
  //    оборачиваем её в wrapper, конвертирующий возвращаемый JsonNode в RenderNode.
  //    Если source — значение, возвращаем как есть.
  if (typeof value === 'string') {
    const meta = registry.get(value);
    if (meta && meta.type === 'source') {
      const sourceValue = meta.component;
      if (typeof sourceValue === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (...args: any[]) => {
          const result = (sourceValue as (...a: unknown[]) => unknown)(...args);
          if (looksLikeJsonNode(result)) {
            return convertNode(result, args[0] as FieldPath<T>, registry);
          }
          return result;
        };
      }
      return sourceValue;
    }
    return value;
  }

  // 2. Ссылка на поле формы: { $model: 'path.to.field' }
  if (isModelRef(value)) {
    return getFieldPathNode(path, value.$model);
  }

  // 3. Шаблон: { $template: JsonNode } → (itemPath) => RenderNode
  //    args[0] становится FieldPath-корнем для резолва model: внутри шаблона.
  if (isTemplateRef(value)) {
    const template = value.$template;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...args: any[]) => convertNode(template, args[0] as FieldPath<T>, registry);
  }

  // 4. JsonNode → RenderNode
  if (looksLikeJsonNode(value)) {
    return convertNode(value, path, registry);
  }

  // 3. Массив
  if (Array.isArray(value)) {
    return value.map((item) => transformPropValue(item, path, registry));
  }

  // 4. Функция: оборачиваем вызов — результат конвертируем как JsonNode
  if (typeof value === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...args: any[]) => {
      const result = (value as (...a: unknown[]) => unknown)(...args);
      if (looksLikeJsonNode(result)) {
        // Поддержка itemComponent((itemPath) => ({...}))
        return convertNode(result, args[0] as FieldPath<T>, registry);
      }
      return result;
    };
  }

  // 5. Обычный объект — рекурсивно обрабатываем поля
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    let changed = false;
    for (const key of Object.keys(src)) {
      const transformed = transformPropValue(src[key], path, registry);
      if (transformed !== src[key]) changed = true;
      out[key] = transformed;
    }
    return changed ? out : value;
  }

  return value;
}

function transformComponentProps<T>(
  props: Record<string, unknown>,
  path: FieldPath<T>,
  registry: ComponentRegistry
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    out[key] = transformPropValue(props[key], path, registry);
  }
  return out;
}

/**
 * Возвращает path к полю из JsonNode, если нода — поле.
 * Поддерживает 2 формы:
 *   a) { model: 'path.to.field', ... }
 *   b) { selector: 'path.to.field', component: 'Select', componentProps: {...} } —
 *      `component` должен резолвиться в field-type запись реестра.
 * Возвращает null для контейнеров.
 */
function resolveFieldPath(
  jsonNode: JsonNode,
  registry: ComponentRegistry
): string | null {
  if (typeof jsonNode.model === 'string' && jsonNode.model.length > 0) {
    return jsonNode.model;
  }
  if (
    typeof jsonNode.selector === 'string' &&
    typeof jsonNode.component === 'string' &&
    !jsonNode.children
  ) {
    const meta = registry.get(jsonNode.component);
    if (meta?.type === 'field') {
      return jsonNode.selector;
    }
  }
  return null;
}

/**
 * Конвертирует JsonNode в RenderNode
 *
 * @param jsonNode - JSON-узел
 * @param path - FieldPath для резолва путей полей
 * @param registry - Реестр компонентов
 * @returns RenderNode для renderer-react
 */
function convertNode<T>(
  jsonNode: JsonNode,
  path: FieldPath<T>,
  registry: ComponentRegistry
): RenderNode<T> {
  const fieldPath = resolveFieldPath(jsonNode, registry);
  if (fieldPath !== null) {
    const fieldPathNode = getFieldPathNode(path, fieldPath);

    const fieldNode: FieldRenderNode = {
      component: fieldPathNode,
    };

    // Добавляем selector если указан
    if (jsonNode.selector) {
      fieldNode.selector = jsonNode.selector;
    }

    // componentProps для полей — пропускаем все пропсы через трансформер
    // (поддержка source-подстановки, className и testId обрабатываются там же).
    // Примечание: `component`/`value` в JSON-описании поля (inline-форма)
    // используются как документация — само поле форма создаёт из TS-схемы.
    if (jsonNode.componentProps) {
      fieldNode.componentProps = transformComponentProps(
        jsonNode.componentProps,
        path,
        registry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;
    }

    // TODO: Обработка wrapper — требует дополнительной логики
    // в renderer-react для поддержки custom wrapper на уровне поля

    return fieldNode;
  }

  // Узел контейнера (имеет только component)
  if (jsonNode.component) {
    const componentMeta = registry.get(jsonNode.component);

    if (!componentMeta) {
      throw new Error(
        `Component "${jsonNode.component}" not found in registry. ` +
          `Available components: ${registry.names().join(', ')}`
      );
    }

    if (componentMeta.type === 'source') {
      throw new Error(
        `Entry "${jsonNode.component}" is a 'source' and cannot be used as component`
      );
    }

    const containerNode: ContainerRenderNode<T> = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: componentMeta.component as any,
    };

    // Добавляем selector если указан
    if (jsonNode.selector) {
      containerNode.selector = jsonNode.selector;
    }

    // componentProps для контейнера — пропускаем через трансформер.
    // Это критично для wizard-подобных компонентов, где в componentProps
    // хранятся вложенные JsonNode-структуры (steps, itemComponent и т.д.).
    if (jsonNode.componentProps) {
      containerNode.componentProps = transformComponentProps(
        jsonNode.componentProps,
        path,
        registry
      );
    }

    // Рекурсивно конвертируем дочерние узлы
    if (jsonNode.children && jsonNode.children.length > 0) {
      containerNode.children = jsonNode.children.map((child) =>
        convertNode(child, path, registry)
      );
    }

    return containerNode;
  }

  // Невалидный узел — нет ни model, ни component
  throw new Error(
    `Invalid JSON node: must have either "model" (for fields) or "component" (for containers). ` +
      `Got: ${JSON.stringify(jsonNode)}`
  );
}

/**
 * Создаёт RenderSchemaFn из JSON-схемы
 *
 * Конвертирует JSON-схему в функцию RenderSchemaFn, которую можно
 * передать в FormRenderer из @reformer/renderer-react.
 *
 * @param schema - JSON-схема формы
 * @param registry - Реестр компонентов для резолва имён
 * @returns RenderSchemaFn для FormRenderer
 *
 * @example
 * ```typescript
 * const jsonSchema = {
 *   root: {
 *     component: 'Box',
 *     children: [
 *       { model: 'email' },
 *       { model: 'password', component: 'InputPassword' }
 *     ]
 *   }
 * };
 *
 * const renderSchema = createRenderSchemaFromJson(jsonSchema, registry);
 *
 * <FormRenderer render={renderSchema} settings={{ fieldWrapper: FormField }} />
 * ```
 */
export function createRenderSchemaFromJson<T>(
  schema: JsonFormSchema,
  registry: ComponentRegistry
): RenderSchemaFn<T> {
  return (path: FieldPath<T>): RenderNode<T> => {
    return convertNode(schema.root, path, registry);
  };
}
