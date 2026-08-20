/**
 * `createCoreForm` — сборка формы ОДНИМ вызовом для рендера собственными компонентами
 * (ui-kit / `@reformer/cdk`, без слоя рендер-схем).
 *
 * Раньше страница писала это руками: `createModel` → `buildSchema(model)` → `createForm(...)` →
 * отдельный `useMemo` под конфиг валидации, и всё это внутри `useMemo`, который React вправе
 * сбросить (потеря введённого). Фабрика собирает то же самое за один проход и отдаёт бандл
 * `{ model, form, validation }`; стабильность даёт {@link useFormBundle}.
 *
 * Родственные фабрики того же вида — `createReactForm` (`@reformer/renderer-react`) и
 * `createJsonForm` (`@reformer/renderer-json`): у них тот же конфиг плюс то, что нужно их слою
 * рендера.
 *
 * @module form/create-core-form
 */

import { createModel } from '../state/create-model';
import type { FormModel } from '../state/types';
import { createForm } from './create-form';
import type { FormSchemaNode } from './types/schema-node';
import type { FormBehavior } from './behaviors';
import type { FormProxy } from './types/index';
import {
  buildValidation,
  type FormValidation,
  type FormValidationBundle,
} from './validation/config';
import type { ValidationSchema } from './validation/schema';

/**
 * Общая часть конфига всех фабрик формы.
 *
 * @typeParam T - Форма данных модели.
 * @typeParam B - Бандл конкретной фабрики (его получает {@link CreateFormConfigBase.setup}).
 */
export interface CreateFormConfigBase<T, B> {
  /** Начальные значения — из них создаётся модель. Взаимоисключимо с `model`. */
  initial?: T;
  /** Готовая модель (если создана отдельной фабрикой). Приоритетнее `initial`. */
  model?: FormModel<T>;
  /** Декларативное поведение модели (compute/copyFrom/enableWhen/onChange). */
  behavior?: FormBehavior<T>;
  /** Правила валидации: готовая схема либо {@link FormValidation} со стратегией и шагами. */
  validation?: FormValidation<T> | ValidationSchema<T>;
  /**
   * Правка модели ДО сборки формы. Нужна там, где значение обязано существовать к моменту
   * построения нод — например, массив, наполняемый из вычислений (реактивные `onChange` на
   * инициализации не срабатывают).
   */
  seed?: (model: FormModel<T>) => void;
  /**
   * Донастройка ПОСЛЕ сборки. Единственное место для правок, которые обязаны идти следом за
   * `createForm`: поле, чьё значение уже массив, ноды не получает (см. `buildModelConfig`),
   * поэтому такой префилл выполняется здесь.
   */
  setup?: (bundle: B) => void;
}

/** Результат {@link createCoreForm}: модель, форма и (если заданы правила) собранная валидация. */
export interface CoreForm<T> {
  model: FormModel<T>;
  form: FormProxy<T>;
  validation?: FormValidationBundle<T>;
}

/** Конфиг {@link createCoreForm}. */
export interface CreateCoreFormConfig<T> extends CreateFormConfigBase<T, CoreForm<T>> {
  /**
   * Билдер схемы формы. Именно функция, а не готовое дерево: листья схемы держат сами сигналы
   * модели (`value: model.$.email`), поэтому построить дерево до модели нечем.
   */
  schema?: (model: FormModel<T>) => FormSchemaNode;
}

/**
 * Собрать модель, форму и валидацию за один проход.
 *
 * @typeParam T - Форма данных модели.
 * @param config - {@link CreateCoreFormConfig}: (`initial` | `model`) + опц. `schema`, `behavior`,
 *   `validation`, `seed`, `setup`.
 * @returns {@link CoreForm}` <T>` — `{ model, form, validation? }`.
 *
 * @example
 * ```tsx
 * const credit = useFormBundle(() =>
 *   createCoreForm<CreditForm>({
 *     model: createCreditModel(),
 *     schema: buildCreditSchema,
 *     behavior: creditBehavior,
 *     validation: { steps: { loan: loanRules, confirm: null }, extras: crossRules },
 *   })
 * );
 * return <FormWizard form={credit.form} config={credit.validation} steps={STEPS} />;
 * ```
 */
export function createCoreForm<T extends object>(config: CreateCoreFormConfig<T>): CoreForm<T> {
  if (!config.model && config.initial === undefined) {
    throw new Error('createCoreForm: provide either `initial` (to create a model) or `model`.');
  }
  const model = config.model ?? createModel<T>(config.initial as T);
  config.seed?.(model);

  const form = createForm<T>({
    model,
    ...(config.schema ? { schema: config.schema(model) } : {}),
    ...(config.behavior ? { behavior: config.behavior } : {}),
  });

  const validation = buildValidation(model, config.validation);
  const bundle: CoreForm<T> = { model, form, ...(validation ? { validation } : {}) };
  config.setup?.(bundle);
  return bundle;
}
