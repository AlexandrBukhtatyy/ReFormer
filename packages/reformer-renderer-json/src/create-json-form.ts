/**
 * `createJsonForm` — сборка формы из JSON-схемы ОДНИМ проходом.
 *
 * Раньше приложение передавало схему дважды: в `convertJsonToM1Tree` (для `createForm`) и пропом
 * `schema` в `JsonFormRenderer` (для рендера) — две несвязанные передачи одного артефакта, а
 * требование «собрать ровно один раз» держалось на комментарии в прикладном коде. Фабрика
 * инкапсулирует сборку и возвращает бандл `{ model, form, schema, registry, validation?,
 * renderBehavior? }`, который целиком отдаётся рендереру пропом `form`.
 *
 * Конфиг общий с `createCoreForm` (`@reformer/core`) и `createReactForm`
 * (`@reformer/renderer-react`); отличие — JSON-схема как данные и реестр компонентов.
 *
 * @module reformer/renderer-json/create-json-form
 */

import { createModel, createForm, buildValidation, useFormBundle } from '@reformer/core';
import type {
  CoreForm,
  CreateFormConfigBase,
  FormModel,
  FormProxy,
  FormValidationBundle,
} from '@reformer/core';
import type { RenderBehaviorFn } from '@reformer/renderer-react';
import type { ComponentRegistry } from './registry/types';
import type { JsonFormSchema } from './types/json-schema';
import { convertJsonToM1Tree } from './converter/json-to-render-schema';

/** Собранная форма из JSON-схемы: источник истины для `<JsonFormRenderer form={…} />`. */
export interface JsonForm<T> extends CoreForm<T> {
  /** Та же JSON-схема, из которой собраны model+form (рендерер строит из неё render-дерево). */
  schema: JsonFormSchema<T>;
  /** Реестр компонентов/source (нужен рендереру для резолва имён). */
  registry: ComponentRegistry;
  /**
   * Render-behavior, собранный фабрикой из конфига. В отличие от React-варианта он ещё НЕ применён:
   * дерево строит сам рендерер, он же и накладывает поведение. Ссылка стабильна — бандл собран один
   * раз, поэтому рендерер не пересобирает дерево на каждый рендер.
   */
  renderBehavior?: RenderBehaviorFn<T>;
}

/** Конфиг {@link createJsonForm}. Модель — либо `initial` (создаётся внутри), либо готовая `model`. */
export interface CreateJsonFormConfig<T> extends CreateFormConfigBase<T, JsonForm<T>> {
  /** JSON-схема формы (типизируй по `T` через `defineJsonSchema<T>`). */
  schema: JsonFormSchema<T>;
  /** Реестр компонентов/source. */
  registry: ComponentRegistry;
  /** Фабрика render-behavior: получает уже собранные форму, модель и валидацию. */
  renderBehavior?: (
    form: FormProxy<T>,
    model: FormModel<T>,
    validation?: FormValidationBundle<T>
  ) => RenderBehaviorFn<T>;
}

/**
 * Собирает форму из JSON-схемы за ОДИН проход: создаёт (или принимает) модель, конвертирует схему в
 * дерево нод, строит форму, собирает валидацию и render-behavior. Схема передаётся один раз;
 * результат целиком отдаётся рендереру пропом `form`.
 *
 * @typeParam T - Форма данных модели.
 * @param config - {@link CreateJsonFormConfig}: `schema` + `registry` + (`initial` | `model`) + опц.
 *   `behavior`, `validation`, `renderBehavior`, `seed`, `setup`.
 * @returns {@link JsonForm}` <T>` — `{ model, form, schema, registry, validation?, renderBehavior? }`.
 *
 * @example
 * ```tsx
 * const jsonForm = useJsonForm(() =>
 *   createJsonForm<CreditForm>({
 *     schema,
 *     registry,
 *     model: createCreditModel(),
 *     behavior: formBehavior,
 *     validation: { steps: { loan: loanRules }, extras: crossRules },
 *     renderBehavior: makeCreditRenderBehavior,
 *   })
 * );
 * return (
 *   <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
 *     <JsonFormRenderer form={jsonForm} />
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
  config.seed?.(model);

  const form = createForm<T>({
    model,
    schema: convertJsonToM1Tree(schema, registry, model),
    behavior,
  });

  const validation = buildValidation(model, config.validation);
  const renderBehavior = config.renderBehavior?.(form, model, validation);

  const bundle: JsonForm<T> = {
    model,
    form,
    schema,
    registry,
    ...(validation ? { validation } : {}),
    ...(renderBehavior ? { renderBehavior } : {}),
  };
  config.setup?.(bundle);
  return bundle;
}

/**
 * Хук стабильной сборки формы: фабрика вызывается РОВНО один раз (ленивый инициализатор `useState`),
 * поэтому model/form переживают ре-рендеры. `useMemo` для этого не годится — React вправе сбросить
 * его кэш и пересоздать форму (потеря введённого). Живая валидация армируется в эффекте.
 *
 * Это общий хук семейства (`useFormBundle` из `@reformer/core`) под именем JSON-слоя: он не сужает
 * результат до `JsonForm<T>`, поэтому расширенные бандлы (со своими полями) переживают его без
 * потерь.
 *
 * @typeParam B - Тип бандла (обычно `JsonForm<T>`).
 * @param factory - Фабрика бандла (обычно `() => createJsonForm<T>({…})`).
 * @returns Стабильный бандл.
 *
 * @example
 * ```tsx
 * const jsonForm = useJsonForm(() => createJsonForm<MyForm>({ schema, registry, initial }));
 * ```
 */
export const useJsonForm = useFormBundle;
