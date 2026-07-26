/**
 * Фабрика пустой схемы (Mode A «новая форма») и мягкое приведение распарсенного JSON
 * к `JsonFormSchema`. Валидация против мета-схемы — отдельно (`validateFormSchema`);
 * здесь только структурный дискриминатор и заготовка.
 *
 * @module reformer-builder/model/normalize
 */

import type { ComponentOp, HtmlOp, JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { isNodeLike } from './node-kind';

/** Пустая схема для standalone-режима: корень — Box со `space-y-4`, без детей. */
export function emptySchema(opts?: {
  version?: string;
  rootComponent?: ComponentOp | HtmlOp;
  $schema?: string;
}): JsonFormSchema {
  const root: JsonNode = {
    component: opts?.rootComponent ?? '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [],
  };
  const schema: JsonFormSchema = { version: opts?.version ?? '1.0', root };
  if (opts?.$schema) schema.$schema = opts.$schema;
  return schema;
}

/**
 * Структурный дискриминатор «это форма-схема?» (спека §7.2): значение — объект с полем
 * `root`, а `root` — узел (несёт `component`/`value`/`array`). Отсекает саму
 * `form-schema.schema.json` (draft-07 JSON Schema) и произвольные JSON.
 */
export function isFormSchema(value: unknown): value is JsonFormSchema {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const root = (value as Record<string, unknown>).root;
  return isNodeLike(root);
}

/**
 * Привести распарсенный JSON к `JsonFormSchema` или бросить. НЕ мутирует и НЕ переупорядочивает
 * ключи — passthrough as-is (важно для round-trip).
 *
 * @throws Если структура не проходит {@link isFormSchema}.
 */
export function ensureSchema(value: unknown): JsonFormSchema {
  if (!isFormSchema(value)) {
    throw new Error('ensureSchema: JSON не похож на JsonFormSchema (нет узла в `root`)');
  }
  return value;
}
