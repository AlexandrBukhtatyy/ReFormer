/**
 * Типы для validation schema.
 *
 * Контракт валидаторов: операторы vs валидаторы.
 * - Операторы (validate, validateAsync, apply, applyWhen, validateItems)
 *   регистрируют валидаторы в схеме. Единственная точка контакта с реестром.
 * - Валидаторы — чистые функции (value, control, root) => error | null.
 *   Не знают про реестр. Импортируются как фабрики из `@reformer/core/validators`.
 *
 * См. docs/plans/atomic-meandering-wreath.md для деталей.
 */

import type { FormValue, ValidationError } from './index';
import type { FormModel } from '../model/types';

// ============================================================================
// Validator types (чистые функции)
// ============================================================================

/**
 * Чистый синхронный валидатор поля.
 *
 * Сигнатура зеркалит то, что реально вызывает движок M1
 * (`validateModel`/`validateFormModel`/`validateModelSync`): `validator(value, scope, root)`.
 * - `value` — значение поля (`TField`);
 * - `scope` — ближайшая scope-**модель** (под-модель элемента массива или корень). Из `TForm`/`TField`
 *   её тип не выводится, поэтому `unknown` — потребитель сужает сам (для типизированного scope
 *   используйте {@link ModelValidator}`<TField, TScope, TForm>`);
 * - `root` — корневая модель формы `FormModel<TForm>` (реактивный value-proxy: `root.field` читает
 *   значение). Возвращает `ValidationError` либо `null`. Не знает про реестр валидации.
 *
 * Совместим с полем `validators` узла схемы (см. `SchemaValidator`) — там же лежат `ModelValidator`
 * и `ValidatorFn`. Встроенные фабрики (`required()`/`email()`/…) возвращают `(value) => …` и
 * дополнительные аргументы игнорируют.
 *
 * @example Кастомный валидатор в массиве `validators` поля схемы
 * ```typescript
 * const isAdult: Validator<MyForm, number> = (value, _scope, root) => {
 *   if (value < 18) return { code: 'tooYoung', message: '18+' };
 *   // root — FormModel<MyForm>: root.someOtherField читается как значение
 *   return null;
 * };
 *
 * // Фабрики и кастомные валидаторы кладутся в `validators: [...]` поля:
 * const schema = {
 *   children: [
 *     { value: model.$.age, component: Input, validators: [required(), isAdult] },
 *   ],
 * };
 * ```
 */
export type Validator<TForm, TField> = (
  value: TField,
  scope: unknown,
  root: FormModel<TForm>
) => ValidationError | null;

/**
 * Чистый асинхронный валидатор поля. Та же тройка аргументов `(value, scope, root)`, что у
 * {@link Validator}, но возвращает `Promise`. Регистрируется через
 * `validateAsync(path, validator, { debounce })`.
 */
export type AsyncValidator<TForm, TField> = (
  value: TField,
  scope: unknown,
  root: FormModel<TForm>
) => Promise<ValidationError | null>;

/**
 * Функция условия для applyWhen.
 */
export type ConditionFn<T> = (value: T) => boolean;

// ============================================================================
// Опции валидации
// ============================================================================

/**
 * Опции для функции validate.
 */
export interface ValidateOptions {
  /** Сообщение об ошибке */
  message?: string;
  /** Параметры ошибки */
  params?: Record<string, FormValue>;
}

/**
 * Опции для функции validateAsync.
 */
export interface ValidateAsyncOptions extends ValidateOptions {
  /** Задержка перед выполнением валидации (в мс) */
  debounce?: number;
}
