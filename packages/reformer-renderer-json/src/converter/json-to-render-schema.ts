/**
 * Конвертер JSON-схемы в RenderSchema
 *
 * @module reformer/renderer-json/converter
 */

import { type RenderSchemaFn, type RenderNode } from '@reformer/renderer-react';
import type { FormModel } from '@reformer/core';
import type { JsonFormSchema, JsonNode } from '../types/json-schema';
import type { ComponentRegistry } from '../registry/types';

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
