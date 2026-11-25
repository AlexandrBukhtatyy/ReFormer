/**
 * Конвертер документа для входа пакета под React: тот же {@link convertToSchemaNode}, результат
 * типизирован узлом `@reformer/renderer-react`.
 *
 * @module reformer/renderer-json/converter/react
 */

import type { RenderNode } from '@reformer/renderer-react';
import type { FormModel } from '@reformer/core';
import type { JsonFormSchema } from '../types/json-schema';
import type { ComponentRegistry } from '../registry/types';
import { convertJsonSchema as convertToSchemaNode } from './json-to-render-schema';

/**
 * Дерево узлов из документа JSON-схемы формата 2 — для сборки `createForm`. Привязки (`model`)
 * становятся ручками модели, компоненты и источники берутся из реестра, именованные части
 * (`parts`) разворачиваются для под-моделей мест подключения.
 *
 * Обычно вызывается не напрямую, а реестром — `createForm({ model, schema: document, registry })`
 * зовёт `registry.resolveSchema`.
 *
 * @typeParam T - Тип формы (форма данных модели).
 * @param schema - Документ JSON-схемы формата 2 ({@link JsonFormSchema}).
 * @param registry - Реестр компонентов/источников (см. {@link defineRegistry}).
 * @param model - Модель данных — источник значений (`FormModel`).
 * @returns Корневой {@link RenderNode}.
 * @throws Error если документ — прежнего формата (его переводит `migrateJsonSchema`) либо вовсе не
 *   документ формы: без `format` и без корня `root`, например JSON Schema данных.
 *
 * @example
 * ```ts
 * const tree = convertJsonSchema<MyForm>(document, registry, model);
 * const form = createFormFromModel<MyForm>({ model, schema: tree });
 * ```
 *
 * @group Converter
 */
export function convertJsonSchema<T>(
  schema: JsonFormSchema,
  registry: ComponentRegistry,
  model: FormModel<T>
): RenderNode<T> {
  // Узел рендерера React — тот же узел схемы ядра с уточнёнными типами компонента и детей.
  return convertToSchemaNode(schema, registry, model) as RenderNode<T>;
}
