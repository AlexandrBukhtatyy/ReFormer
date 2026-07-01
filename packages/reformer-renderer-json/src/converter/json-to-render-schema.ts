/**
 * Конвертер JSON-схемы (M1) → RenderNode-дерево `@reformer/renderer-react`.
 *
 * Привязки — СТРОКИ-операторы (`operators.ts`); голые строки НЕ резолвятся:
 * - лист:      `{ value: '$model(path)', component: '$component(Name)', componentProps: { options: '$dataSource(NAME)' } }`
 * - массив:    `{ array: '$model(arr)', item: { $template: <JsonNode> }, initialValue?: {…} }`
 * - контейнер: `{ component: '$component(Name)', children: [...] }`
 *
 * `selector` — plain-строка (id для render-behavior), НЕ путь модели.
 *
 * @module reformer/renderer-json/converter
 */

import { type RenderSchemaFn, type RenderNode } from '@reformer/renderer-react';
import type { FormModel } from '@reformer/core';
import {
  isArrayNode,
  isFieldNode,
  isContainerNode,
  type JsonFormSchema,
  type JsonNode,
} from '../types/json-schema';
import { parseOperator, isModelOp, isComponentOp, isDataSourceOp } from '../operators';
import type { ComponentRegistry } from '../registry/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Резолв компонента реестра по строке `'$component(name)'` (тип component). */
function resolveComponent(op: string | undefined, registry: ComponentRegistry): any {
  if (!op) return undefined;
  const name = parseOperator(op)?.arg;
  if (!name) throw new Error(`Invalid $component operator: "${op}"`);
  const meta = registry.get(name);
  if (!meta) {
    throw new Error(
      `Component "${name}" not found in registry. Available: ${registry.names().join(', ')}`
    );
  }
  if (meta.type === 'dataSource') {
    throw new Error(`Entry "${name}" is a 'dataSource' and cannot be used as $component(...)`);
  }
  return meta.component;
}

/** Резолв registry-source по имени из `'$dataSource(name)'` (options/itemLabel/константа/loading-компонент). */
function resolveDataSource(name: string, registry: ComponentRegistry): unknown {
  const meta = registry.get(name);
  if (!meta) {
    throw new Error(
      `Data source "${name}" not found in registry. Available: ${registry.names().join(', ')}`
    );
  }
  return meta.component;
}

/** Значение по dot-пути в value-прокси модели ('properties' → model.properties массив-прокси). */
function resolveModelPath(scope: any, path: string): any {
  return path.split('.').reduce((acc, seg) => (acc == null ? acc : acc[seg]), scope);
}

/** Похож ли объект на JsonNode (несёт строку-оператор в value/array/component). */
function looksLikeNode(v: unknown): v is JsonNode {
  if (v === null || typeof v !== 'object') return false;
  const n = v as Record<string, unknown>;
  return isModelOp(n.value) || isModelOp(n.array) || isComponentOp(n.component);
}

/** Глубокий клон литерал-объекта (initialValue нового элемента массива — без shared-ссылок). */
function cloneLiteral<T>(v: T): T {
  return v == null ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/**
 * Рекурсивная трансформация значений `componentProps`: резолв строк-операторов + вложенных узлов.
 * Обычные значения (label/placeholder/className/testId, инлайн-массивы options) — как есть.
 */
function transformPropValue(value: unknown, scope: any, registry: ComponentRegistry): unknown {
  if (isDataSourceOp(value)) return resolveDataSource(parseOperator(value)!.arg, registry);
  if (isComponentOp(value)) return resolveComponent(value, registry);
  if (isModelOp(value)) return (scope as FormModel<unknown>).signalAt(parseOperator(value)!.arg);
  if (looksLikeNode(value)) return convertNodeM1(value, scope, registry);
  if (Array.isArray(value)) return value.map((v) => transformPropValue(v, scope, registry));
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src)) out[k] = transformPropValue(src[k], scope, registry);
    return out;
  }
  return value;
}

function transformProps(
  props: Record<string, unknown> | undefined,
  scope: any,
  registry: ComponentRegistry
): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) out[k] = transformPropValue(props[k], scope, registry);
  return out;
}

/**
 * Конвертирует JsonNode в RenderNode (M1). Дискриминация — по строке-оператору:
 * массив (`array`+`item`) → field (`value`) → контейнер (`component`).
 */
function convertNodeM1<T>(node: JsonNode, scope: any, registry: ComponentRegistry): RenderNode<T> {
  // Массив: данные из модели (value-прокси массива), элемент — из $template
  if (isArrayNode(node)) {
    const arrayControl = resolveModelPath(scope, parseOperator(node.array)!.arg);
    const template = node.item.$template;
    const initial = node.initialValue;
    return {
      ...(node.selector ? { selector: node.selector } : {}),
      array: arrayControl,
      initialValue: () => (initial ? cloneLiteral(initial) : {}),
      item: (im: FormModel<unknown>) => convertNodeM1(template, im, registry),
      componentProps: transformProps(node.componentProps, scope, registry),
    } as unknown as RenderNode<T>;
  }

  // Лист: value = сигнал модели по пути из '$model(...)'
  if (isFieldNode(node)) {
    const path = parseOperator(node.value)!.arg;
    const signal = (scope as FormModel<unknown>).signalAt(path);
    if (!signal && typeof console !== 'undefined') {
      console.warn(`[JsonRenderer/M1] No model signal for "${path}".`);
    }
    return {
      ...(node.selector ? { selector: node.selector } : {}),
      value: signal,
      component: resolveComponent(node.component, registry),
      componentProps: transformProps(node.componentProps, scope, registry),
    } as unknown as RenderNode<T>;
  }

  // Контейнер
  if (isContainerNode(node)) {
    return {
      ...(node.selector ? { selector: node.selector } : {}),
      component: resolveComponent(node.component, registry),
      componentProps: transformProps(node.componentProps, scope, registry),
      children: node.children?.map((c) => convertNodeM1(c, scope, registry)),
    } as unknown as RenderNode<T>;
  }

  throw new Error(`Invalid JSON node (M1): ${JSON.stringify(node)}`);
}

/**
 * Сырое дерево RenderNode из JSON (M1) — для `createForm({ model, schema })`. Листья привязываются
 * к сигналам модели (`'$model(path)'` → `model.signalAt`), компоненты/источники — из реестра.
 *
 * @typeParam T - Тип формы (форма данных модели).
 * @param schema - JSON-схема формы ({@link JsonFormSchema}).
 * @param registry - Реестр компонентов/источников (см. {@link defineRegistry}).
 * @param model - Модель данных — источник значений (`FormModel`).
 * @returns Корневой {@link RenderNode} — кладётся в `createForm({ schema })`.
 *
 * @example Собрать форму из JSON-схемы (M1)
 * ```ts
 * import { createForm } from '@reformer/core';
 *
 * const form = createForm<MyForm>({
 *   model,
 *   schema: convertJsonToM1Tree(jsonSchema, registry, model),
 *   behavior,
 * });
 * ```
 *
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
 * `RenderSchemaFn` из JSON (M1) — для `FormRenderer`/`JsonFormRenderer`. Листья привязываются к
 * сигналам модели (`'$model(path)'` → `model.signalAt`), компоненты/источники — из реестра.
 *
 * В отличие от {@link convertJsonToM1Tree} (который возвращает готовое дерево), здесь результат —
 * ленивая функция-фабрика дерева, как её ждёт `createRenderSchema`. Обычно вызывается внутри
 * {@link JsonFormRenderer}; напрямую нужен для интеграции с `FormRenderer` без JSON-обёртки.
 *
 * @typeParam T - Тип формы.
 * @param schema - JSON-схема формы ({@link JsonFormSchema}).
 * @param registry - Реестр компонентов/источников (см. {@link defineRegistry}).
 * @param model - Модель данных — источник значений (`FormModel`).
 * @returns `RenderSchemaFn<T>` — фабрика {@link RenderNode}-дерева для `createRenderSchema`.
 *
 * @example
 * ```ts
 * import { createRenderSchema, FormRenderer } from '@reformer/renderer-react';
 *
 * const fn = createRenderSchemaFromJsonM1<MyForm>(jsonSchema, registry, model);
 * const proxy = createRenderSchema<MyForm>(fn);
 * <FormRenderer render={proxy} />;
 * ```
 *
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
