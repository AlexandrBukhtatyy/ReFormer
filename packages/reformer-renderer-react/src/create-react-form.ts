/**
 * `createReactForm` — сборка формы ОДНИМ вызовом для рендера по RenderSchema.
 *
 * Главное, что фабрика прячет, — двойную сборку дерева. Билдер схемы вызывается дважды:
 * без формы (для `createForm`) и с формой (для рендера). Оба конца инварианта до сих пор держались
 * на комментарии в прикладном коде, а нарушения молчаливы или, наоборот, фатальны:
 * дерево С формой в `createForm` роняет harvest переполнением стека (прокси самоссылочен),
 * а дерево БЕЗ формы в рендере оставляет визард без источника значений — без единой ошибки.
 *
 * Конфиг общий с `createCoreForm` (`@reformer/core`) и `createJsonForm`
 * (`@reformer/renderer-json`); отличие — билдер схемы и `renderBehavior`.
 *
 * @module reformer/renderer-react/create-react-form
 */

import { createForm, createModel, buildValidation } from '@reformer/core';
import type {
  CoreForm,
  CreateFormConfigBase,
  FormModel,
  FormProxy,
  FormValidationBundle,
} from '@reformer/core';
import type { RenderNode } from './core/types';
import type { RenderBehaviorFn } from './core/render-behavior';
import { createRenderSchema, type RenderSchemaProxy } from './core/render-schema-proxy';

/** Результат {@link createReactForm}: бандл `createCoreForm` + готовая к рендеру схема. */
export interface ReactForm<T> extends CoreForm<T> {
  /** Схема для `<FormRenderer form={…} />` — с уже наложенным render-behavior. */
  render: RenderSchemaProxy<T>;
}

/** Конфиг {@link createReactForm}. */
export interface CreateReactFormConfig<T> extends CreateFormConfigBase<T, ReactForm<T>> {
  /**
   * Билдер дерева. Вызывается ДВАЖДЫ: сперва без `form` (это дерево уходит в `createForm`), затем
   * с `form` — для рендера. Узлы, которым нужна форма (визард), берут её из второго аргумента.
   */
  schema: (model: FormModel<T>, form?: FormProxy<T>) => RenderNode<T>;
  /** Фабрика render-behavior: получает уже собранные форму, модель и валидацию. */
  renderBehavior?: (
    form: FormProxy<T>,
    model: FormModel<T>,
    validation?: FormValidationBundle<T>
  ) => RenderBehaviorFn<T>;
}

/**
 * Собрать модель, форму, валидацию и рендер-схему за один проход.
 *
 * @typeParam T - Форма данных модели.
 * @param config - {@link CreateReactFormConfig}: (`initial` | `model`) + `schema` + опц.
 *   `behavior`, `validation`, `renderBehavior`, `seed`, `setup`.
 * @returns {@link ReactForm}` <T>` — `{ model, form, validation?, render }`.
 *
 * @example
 * ```tsx
 * const credit = useReactForm(() =>
 *   createReactForm<CreditForm>({
 *     model: createCreditModel(),
 *     schema: buildCreditSchema,          // (model, form?) => RenderNode<CreditForm>
 *     behavior: creditBehavior,
 *     validation: { steps: { loan: loanRules }, extras: crossRules },
 *     renderBehavior: makeCreditRenderBehavior,
 *   })
 * );
 * return <FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />;
 * ```
 */
export function createReactForm<T extends object>(config: CreateReactFormConfig<T>): ReactForm<T> {
  if (!config.model && config.initial === undefined) {
    throw new Error('createReactForm: provide either `initial` (to create a model) or `model`.');
  }
  const model = config.model ?? createModel<T>(config.initial as T);
  config.seed?.(model);

  // Первый проход — БЕЗ формы: harvest в `createForm` обходит дерево рекурсией, а `FormProxy`
  // самоссылочен. Формы на этот момент всё равно ещё не существует.
  const form = createForm<T>({
    model,
    schema: config.schema(model) as never,
    ...(config.behavior ? { behavior: config.behavior } : {}),
  });

  const validation = buildValidation(model, config.validation);

  // Второй проход — С формой, лениво: `FormRenderer` зовёт схему на каждый рендер.
  const render = createRenderSchema<T>(() => config.schema(model, form));
  config.renderBehavior?.(form, model, validation)(render);

  const bundle: ReactForm<T> = {
    model,
    form,
    render,
    ...(validation ? { validation } : {}),
  };
  config.setup?.(bundle);
  return bundle;
}
