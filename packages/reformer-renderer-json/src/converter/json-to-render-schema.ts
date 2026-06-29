/**
 * Конвертер JSON-схемы в RenderSchema
 *
 * @module reformer/renderer-json/converter
 */

import type { ComponentType, ReactNode } from 'react';
import { createElement } from 'react';
import {
  RenderNodeComponent,
  type RenderSchemaFn,
  type RenderNode,
  type FieldRenderNode,
  type ContainerRenderNode,
} from '@reformer/renderer-react';
import {
  createFieldPath,
  type FieldPath,
  type FieldPathNode,
  type FormModel,
  type FormProxy,
} from '@reformer/core';
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
 * Создаёт FC-обёртку из JsonNode-шаблона. FC принимает `control: FormProxy<TItem>`,
 * пред-конвертирует шаблон в RenderNode (один раз) и рендерит через
 * `RenderNodeComponent` с form={control}. Используется для `itemComponent`
 * слотов в `FormArraySection` и подобных мест.
 */
function templateToItemFC<T>(
  template: JsonNode,
  registry: ComponentRegistry
): ComponentType<{ control: FormProxy<unknown> }> {
  // Pre-convert: используем синтетический FieldPath<TItem> root. RenderNode
  // содержит FieldPathNode-ссылки относительно item-корня. При render-time
  // navigator.getNodeByPath(form=control, pathStr) резолвит против item FormProxy.
  const itemPath = createFieldPath<unknown>() as FieldPath<T>;
  const renderNode = convertNode(template, itemPath, registry);

  const TemplateItemFC = ({ control }: { control: FormProxy<unknown> }): ReactNode =>
    createElement(RenderNodeComponent, { node: renderNode, form: control });
  TemplateItemFC.displayName = 'TemplateItemFC';
  return TemplateItemFC;
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

  // 2. Шаблон: { $template: JsonNode } → FC<{ control }> (Path C unified API).
  //    Шаблон конвертируется один раз, FC рендерит через RenderNodeComponent
  //    с form=control. Это позволяет `itemComponent: { $template: ... }` в JSON
  //    работать с новым `FormArraySection.itemComponent: ComponentType<{ control }>`.
  if (isTemplateRef(value)) {
    return templateToItemFC<T>(value.$template, registry);
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
    const value = props[key];
    // Пропсы с именем 'control' или '*Control' и строковым значением
    // резолвятся как ссылка на FieldPath (аналог control={fieldNode} в компонентах).
    if ((key === 'control' || key.endsWith('Control')) && typeof value === 'string') {
      out[key] = getFieldPathNode(path, value);
      continue;
    }
    // `*Component` слоты (itemComponent, headerComponent, и т.п.) со строковым
    // значением резолвятся как ссылка на любой зарегистрированный компонент
    // (field/container/source). Используется в Path C для FormArraySection,
    // где `itemComponent: "PropertyForm"` указывает на FC из registry.
    if ((key === 'component' || key.endsWith('Component')) && typeof value === 'string') {
      const meta = registry.get(value);
      if (meta) {
        out[key] = meta.component;
        continue;
      }
    }
    out[key] = transformPropValue(value, path, registry);
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
function resolveFieldPath(jsonNode: JsonNode, registry: ComponentRegistry): string | null {
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
      containerNode.children = jsonNode.children.map((child) => convertNode(child, path, registry));
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

// ============================================================================
// M1: единая схема — конвертация JSON в дерево с value-сигналами модели
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Резолв строки-source через реестр (options/itemLabel/LoadingComponent/CURRENT_YEAR…). */
function resolveSourceString(value: string, registry: ComponentRegistry): unknown {
  const meta = registry.get(value);
  if (meta && meta.type === 'source') return meta.component;
  return value;
}

/** Значение по dot-пути в модели (value-доступ): 'properties' → model.properties (массив-прокси). */
function resolveModelPath(scope: any, path: string): any {
  return path.split('.').reduce((acc, seg) => (acc == null ? acc : acc[seg]), scope);
}

function setByPath(obj: Record<string, any>, path: string, value: unknown): void {
  const segs = path.split('.');
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur[segs[i]] == null) cur[segs[i]] = {};
    cur = cur[segs[i]];
  }
  cur[segs[segs.length - 1]] = value;
}

/** «Пустой» элемент массива из value-дефолтов полей шаблона (для кнопки «Добавить»). */
function buildBlankFromTemplate(template: JsonNode): Record<string, unknown> {
  const blank: Record<string, unknown> = {};
  const walk = (node: JsonNode): void => {
    if (node.selector && !node.children && 'value' in node) {
      setByPath(blank, node.selector, (node as { value?: unknown }).value);
    }
    node.children?.forEach(walk);
  };
  walk(template);
  return blank;
}

function transformPropValueM1<T>(
  value: unknown,
  scope: FormModel<T>,
  registry: ComponentRegistry
): unknown {
  if (typeof value === 'string') return resolveSourceString(value, registry);
  if (isTemplateRef(value)) return value; // обрабатывается в array-ветке
  if (looksLikeJsonNode(value)) return convertNodeM1(value, scope, registry);
  if (Array.isArray(value)) return value.map((v) => transformPropValueM1(v, scope, registry));
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src)) out[k] = transformPropValueM1(src[k], scope, registry);
    return out;
  }
  return value;
}

function transformComponentPropsM1<T>(
  props: Record<string, unknown>,
  scope: FormModel<T>,
  registry: ComponentRegistry
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) out[k] = transformPropValueM1(props[k], scope, registry);
  return out;
}

/**
 * Конвертирует JsonNode в RenderNode под M1: поле → лист с `value: model.signalAt(selector)` +
 * `component` из реестра; `{ control, itemComponent: { $template } }` → ArrayRenderNode
 * (`array: model.<control>`, `item: (im) => convert(template, im)`, blank из value-дефолтов).
 */
function convertNodeM1<T>(
  jsonNode: JsonNode,
  scope: FormModel<T>,
  registry: ComponentRegistry
): RenderNode<T> {
  const cp = jsonNode.componentProps;

  // Array-секция: control (строка-путь) + itemComponent.$template
  if (cp && typeof cp.control === 'string' && isTemplateRef(cp.itemComponent)) {
    const template = (cp.itemComponent as { $template: JsonNode }).$template;
    const arrayControl = resolveModelPath(scope as any, cp.control);
    return {
      ...(jsonNode.selector ? { selector: jsonNode.selector } : {}),
      array: arrayControl,
      initialValue: () => buildBlankFromTemplate(template),
      item: (im: FormModel<unknown>) => convertNodeM1(template, im, registry),
      componentProps: {
        title: cp.title,
        addButtonLabel: cp.addButtonLabel,
        removeButtonLabel: cp.removeButtonLabel,
        emptyMessage: cp.emptyMessage,
        emptyMessageHint: cp.emptyMessageHint,
        itemLabel:
          typeof cp.itemLabel === 'string'
            ? resolveSourceString(cp.itemLabel, registry)
            : cp.itemLabel,
      },
    } as unknown as RenderNode<T>;
  }

  // Поле: value = сигнал модели по selector
  const fieldPath = resolveFieldPath(jsonNode, registry);
  if (fieldPath !== null) {
    const signal = scope.signalAt(fieldPath);
    if (!signal && typeof console !== 'undefined') {
      console.warn(`[JsonRenderer/M1] No model signal for "${fieldPath}".`);
    }
    const meta = jsonNode.component ? registry.get(jsonNode.component) : undefined;
    return {
      ...(jsonNode.selector ? { selector: jsonNode.selector } : {}),
      value: signal,
      component: meta?.component,
      componentProps: jsonNode.componentProps
        ? transformComponentPropsM1(jsonNode.componentProps, scope, registry)
        : undefined,
    } as unknown as RenderNode<T>;
  }

  // Контейнер
  if (jsonNode.component) {
    const meta = registry.get(jsonNode.component);
    if (!meta) {
      throw new Error(
        `Component "${jsonNode.component}" not found in registry. ` +
          `Available: ${registry.names().join(', ')}`
      );
    }
    return {
      ...(jsonNode.selector ? { selector: jsonNode.selector } : {}),
      component: meta.component as any,
      componentProps: jsonNode.componentProps
        ? transformComponentPropsM1(jsonNode.componentProps, scope, registry)
        : undefined,
      children: jsonNode.children?.map((c) => convertNodeM1(c, scope, registry)),
    } as unknown as RenderNode<T>;
  }

  throw new Error(`Invalid JSON node (M1): ${JSON.stringify(jsonNode)}`);
}

/**
 * Сырое дерево RenderNode из JSON под M1 (для `createForm({ model, schema })`).
 * @group Converter
 */
export function convertJsonToM1Tree<T>(
  schema: JsonFormSchema,
  registry: ComponentRegistry,
  model: FormModel<T>
): RenderNode<T> {
  return convertNodeM1(schema.root, model, registry);
}

/**
 * `RenderSchemaFn` из JSON под M1 (для `FormRenderer`/`JsonFormRenderer`). Листья привязываются
 * к сигналам модели (`model.signalAt(selector)`), компоненты резолвятся из реестра.
 * @group Converter
 */
export function createRenderSchemaFromJsonM1<T>(
  schema: JsonFormSchema,
  registry: ComponentRegistry,
  model: FormModel<T>
): RenderSchemaFn<T> {
  return (): RenderNode<T> => convertNodeM1(schema.root, model, registry);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
