/**
 * `createJsonForm` — сборка формы из JSON-схемы ОДНИМ проходом (§7 рекомендаций).
 *
 * Раньше приложение передавало схему дважды: в `convertJsonToM1Tree` (для `createForm`) и пропом
 * `schema` в `JsonFormRenderer` (для рендера) — две несвязанные передачи одного артефакта, а
 * требование «собрать ровно один раз» держалось на комментарии в прикладном коде. `createJsonForm`
 * инкапсулирует сборку и возвращает бандл `{ model, form, schema, registry }`, который целиком
 * отдаётся рендереру пропом `form`.
 *
 * @module reformer/renderer-json/create-json-form
 */

import { useState } from 'react';
import { createModel, createForm } from '@reformer/core';
import type { FormModel, FormProxy } from '@reformer/core';
import type { FormBehavior } from '@reformer/core/behaviors';
import type { ComponentRegistry } from './registry/types';
import type { JsonFormSchema } from './types/json-schema';
import { convertJsonToM1Tree } from './converter/json-to-render-schema';

/** Собранная форма из JSON-схемы: источник истины для `<JsonFormRenderer form={…} />`. */
export interface JsonForm<T> {
  /** Модель данных (источник истины значений). */
  model: FormModel<T>;
  /** Дерево нод формы (валидация/поведение/submit). */
  form: FormProxy<T>;
  /** Та же JSON-схема, из которой собраны model+form (рендерер строит из неё render-дерево). */
  schema: JsonFormSchema<T>;
  /** Реестр компонентов/source (нужен рендереру для резолва имён). */
  registry: ComponentRegistry;
}

/** Конфиг {@link createJsonForm}. Модель — либо `initial` (создаётся внутри), либо готовая `model`. */
export interface CreateJsonFormConfig<T> {
  /** JSON-схема формы (типизируй по `T` через `defineJsonSchema<T>`). */
  schema: JsonFormSchema<T>;
  /** Реестр компонентов/source. */
  registry: ComponentRegistry;
  /** Начальные значения — из них создаётся модель. Взаимоисключимо с `model`. */
  initial?: T;
  /** Готовая модель (если создана отдельно). Приоритетнее `initial`. */
  model?: FormModel<T>;
  /** Декларативное поведение модели (compute/copyFrom/enableWhen/onChange). */
  behavior?: FormBehavior<T>;
}

/**
 * Собирает форму из JSON-схемы за ОДИН проход: создаёт (или принимает) модель, конвертирует схему в
 * дерево нод и строит форму. Схема передаётся один раз; результат целиком отдаётся рендереру пропом
 * `form`.
 *
 * @typeParam T - Форма данных модели.
 * @param config - {@link CreateJsonFormConfig}: `schema` + `registry` + (`initial` | `model`) + опц. `behavior`.
 * @returns {@link JsonForm}` <T>` — `{ model, form, schema, registry }`.
 *
 * @example
 * ```tsx
 * const jsonForm = useJsonForm(() =>
 *   createJsonForm<CreditForm>({ schema, registry, initial: INITIAL, behavior: formBehavior })
 * );
 * return (
 *   <JsonRendererProvider settings={{ registry }}>
 *     <JsonFormRenderer form={jsonForm} renderBehavior={renderBehavior} />
 *   </JsonRendererProvider>
 * );
 * ```
 */
export function createJsonForm<T extends object>(config: CreateJsonFormConfig<T>): JsonForm<T> {
  const { schema, registry, behavior } = config;
  if (!config.model && config.initial === undefined) {
    throw new Error('createJsonForm: provide either `initial` (to create a model) or `model`.');
  }
  const model = config.model ?? createModel<T>(config.initial as T);
  const form = createForm<T>({
    model,
    schema: convertJsonToM1Tree(schema, registry, model),
    behavior,
  });
  return { model, form, schema, registry };
}

/**
 * Хук стабильной сборки формы: `factory` вызывается РОВНО один раз (ленивый инициализатор `useState`),
 * поэтому model/form переживают ре-рендеры. `useMemo` для этого не годится — React вправе сбросить
 * его кэш и пересоздать форму (потеря введённого). §7 рекомендаций.
 *
 * @typeParam T - Форма данных модели.
 * @param factory - Фабрика бандла (обычно `() => createJsonForm<T>({…})`).
 * @returns Стабильный {@link JsonForm}` <T>`.
 *
 * @example
 * ```tsx
 * const jsonForm = useJsonForm(() => createJsonForm<MyForm>({ schema, registry, initial }));
 * ```
 */
export function useJsonForm<T>(factory: () => JsonForm<T>): JsonForm<T> {
  const [jsonForm] = useState(factory);
  return jsonForm;
}
