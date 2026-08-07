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
 * Привести распарсенный JSON к `JsonFormSchema` или бросить. Ключи и неизвестные операторы
 * сохраняются as-is (требование round-trip); единственное преобразование — {@link migrateTextNodes}
 * для схем, написанных до переезда текста в `children`.
 *
 * @throws Если структура не проходит {@link isFormSchema}.
 */
export function ensureSchema(value: unknown): JsonFormSchema {
  if (!isFormSchema(value)) {
    throw new Error('ensureSchema: JSON не похож на JsonFormSchema (нет узла в `root`)');
  }
  return migrateTextNodes(value);
}

/**
 * Схемы прошлых версий держали содержимое в отдельном ключе `text` (`{ component, text: 'Итого' }`);
 * теперь текст — такая же часть `children`, как вложенный узел, и `text` мета-схемой отвергается.
 * Переписываем его в текстовые дети ПЕРЕД `children` — ровно там он и рендерился.
 *
 * Проход по всему значению (а не только по узлам): `text` встречается и внутри `componentProps`
 * (шаги мастера, слоты компонентов). Если `text` нет — возвращается исходная ссылка, поэтому
 * round-trip нетронутых файлов не страдает.
 */
export function migrateTextNodes<T>(value: T): T {
  let touched = false;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const items = v.map(walk);
      return touched ? items : v;
    }
    if (v == null || typeof v !== 'object') return v;
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      if (key === 'text' && isNodeLike(src)) {
        const parts = Array.isArray(src.text) ? src.text : [src.text];
        const kids = Array.isArray(src.children) ? (src.children as unknown[]).map(walk) : [];
        out.children = [...parts, ...kids];
        touched = true;
        continue;
      }
      // `children` уже собран веткой выше — второй раз его не переписываем.
      if (key === 'children' && out.children !== undefined) continue;
      out[key] = walk(src[key]);
    }
    return touched ? out : v;
  };
  const next = walk(value);
  return touched ? (next as T) : value;
}
