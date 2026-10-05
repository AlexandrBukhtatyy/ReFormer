/**
 * `createCoreForm` — прежнее имя сборки одним вызовом; теперь псевдоним `createForm`.
 *
 * Сборка стала одна на все способы реализации формы (`form-bundle`): тот же вызов отдаёт и форму
 * для собственных компонентов, и дерево для рендерера. Здесь остаются имя и типы, на которые
 * опираются родственные фабрики — `createReactForm` (`@reformer/renderer-react`) и
 * `createJsonForm` (`@reformer/renderer-json`).
 *
 * @module form/create-core-form
 */

import type { FormModel } from '../model/types';
import { createForm, type CreateFormConfig } from './form-bundle';
import type { FormSchemaNode } from './types/schema-node';
import type { FormBehavior } from './behaviors';
import type { FormProxy } from './types/index';
import type { FormValidation, FormValidationBundle } from './validation/config';
import type { ValidationSchema } from './validation';

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
   * сборкой формы: поле, чьё значение уже массив, ноды не получает (см. `buildModelConfig`),
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
   * Билдер схемы формы. Именно функция, а не готовое дерево: узлы схемы держат ручки модели
   * (`model: model.$.email`), поэтому построить дерево до модели нечем.
   */
  schema?: (model: FormModel<T>) => FormSchemaNode;
}

/**
 * Собрать модель, форму и валидацию за один проход.
 *
 * @deprecated Пишите `createForm` — та же сборка, в бандле вдобавок дерево для рендерера.
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
  return createForm<T>(config as CreateFormConfig<T>);
}
