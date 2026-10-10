/**
 * `createReactForm` — сборка формы ОДНИМ вызовом для рендера по RenderSchema.
 *
 * Главное, что фабрика прячет, — двойную сборку дерева. Билдер схемы вызывается дважды:
 * без формы (для `createForm`) и с формой (для рендера). Оба конца инварианта до сих пор держались
 * на комментарии в прикладном коде, а нарушения молчаливы или, наоборот, фатальны:
 * дерево С формой в `createForm` роняет harvest переполнением стека (прокси самоссылочен),
 * а дерево БЕЗ формы в рендере оставляет визард без источника значений — без единой ошибки.
 *
 * Конфиг общий с `createForm` (`@reformer/core`) и `createJsonForm`
 * (`@reformer/renderer-json`); отличие — билдер схемы и `renderBehavior`.
 *
 * @module reformer/renderer-react/create-react-form
 */

import { createFormFromModel, createFormLevel, createModel } from '@reformer/core';
import type {
  CoreForm,
  CreateFormConfigBase,
  FormModel,
  FormLevel,
  FormGroup,
} from '@reformer/core';
import type { RenderNode } from './core/types';
import type { RenderBehaviorFn } from './core/render-behavior';
import { createRenderSchema, type RenderSchemaProxy } from './core/render-schema-proxy';

/** Результат {@link createReactForm}: модель, форма, валидация + готовая к рендеру схема. */
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
  schema: (model: FormModel<T>, form?: FormGroup<T>) => RenderNode<T>;
  /** Фабрика render-behavior: получает собранные форму, модель и уровень формы (`submit`, поток). */
  renderBehavior?: (
    form: FormGroup<T>,
    model: FormModel<T>,
    level: FormLevel<T>
  ) => RenderBehaviorFn<T>;
}

/**
 * Собрать модель, форму, валидацию и рендер-схему за один проход.
 *
 * @typeParam T - Форма данных модели.
 * @param config - {@link CreateReactFormConfig}: (`initial` | `model`) + `schema` + опц.
 *   `behavior`, `validation`, `flow`, `renderBehavior`, `seed`, `setup`.
 * @returns {@link ReactForm}` <T>` — `{ model, form, render }` и уровень формы (`submit`, `flow`, …).
 *
 * @example
 * ```tsx
 * const credit = useReactForm(() =>
 *   createReactForm<CreditForm>({
 *     model: createCreditModel(),
 *     schema: buildCreditSchema,          // (model, form?) => RenderNode<CreditForm>
 *     behavior: creditBehavior,
 *     validation: { extras: crossRules },
 *     flow: { steps: [{ id: 'loan', rules: loanRules }] },
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

  // Первый проход — БЕЗ формы: harvest в `createForm` обходит дерево рекурсией, а `FormGroup`
  // самоссылочен. Формы на этот момент всё равно ещё не существует.
  // Уровень формы — до нод: поведение получает поток шагов.
  const level = createFormLevel<T>(model, { validation: config.validation, flow: config.flow });
  const form = createFormFromModel<T>({
    model,
    schema: config.schema(model) as never,
    ...(config.behavior ? { behavior: config.behavior } : {}),
    ...(level.flow !== undefined ? { flow: level.flow } : {}),
  });

  // Второй проход — С формой, лениво: `FormRenderer` зовёт схему на каждый рендер.
  const render = createRenderSchema<T>(() => config.schema(model, form));
  config.renderBehavior?.(form, model, level)(render);

  const bundle: ReactForm<T> = { ...level, model, form, render };
  config.setup?.(bundle);
  return bundle;
}
