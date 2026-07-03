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

import type { FormFields, ValidationError } from './index';
import type { FormProxy } from './form-proxy';

// ============================================================================
// Validator types (чистые функции)
// ============================================================================

/**
 * Чистый синхронный валидатор поля.
 *
 * Принимает значение поля, прокси текущего поля (control) и прокси корня формы (root).
 * Возвращает ValidationError либо null. Не знает про реестр валидации.
 *
 * Отличие от `ModelValidator`: 2-й/3-й аргументы — `FormProxy`-узлы формы (control/root), а не
 * данные модели. Оба совместимы с полем `validators` узла схемы (см. `SchemaValidator`).
 *
 * @example Кастомный валидатор в массиве `validators` поля схемы
 * ```typescript
 * const isAdult: Validator<MyForm, number> = (value, control, root) => {
 *   if (value < 18) return { code: 'tooYoung', message: '18+' };
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
  control: FormProxy<TField>,
  root: FormProxy<TForm>
) => ValidationError | null;

/**
 * Чистый асинхронный валидатор поля.
 *
 * Регистрируется через `validateAsync(path, validator, { debounce })`.
 */
export type AsyncValidator<TForm, TField> = (
  value: TField,
  control: FormProxy<TField>,
  root: FormProxy<TForm>
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
  params?: FormFields;
}

/**
 * Опции для функции validateAsync.
 */
export interface ValidateAsyncOptions extends ValidateOptions {
  /** Задержка перед выполнением валидации (в мс) */
  debounce?: number;
}
