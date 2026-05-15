/**
 * Типы для validation schema.
 *
 * Контракт валидаторов: операторы vs валидаторы.
 * - Операторы (validate, validateAsync, validateGroup, apply, applyWhen, validateItems)
 *   регистрируют валидаторы в схеме. Единственная точка контакта с реестром.
 * - Валидаторы — чистые функции (value, control, root) => error | null.
 *   Не знают про реестр. Импортируются как фабрики из `@reformer/core/validators`.
 *
 * См. docs/plans/atomic-meandering-wreath.md для деталей.
 */

import type { FormFields, ValidationError } from './index';
import type { FieldPath, FieldPathNode } from './field-path';
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
 * @example
 * ```typescript
 * const isAdult: Validator<MyForm, number> = (value, control, root) => {
 *   if (value < 18) return { code: 'tooYoung', message: '18+' };
 *   return null;
 * };
 * validate(path.age, isAdult);
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
 * Cross-field валидатор. Принимает scope (поддерево формы или корень) и корень формы.
 *
 * По умолчанию `TScope = TForm` — валидация всей формы.
 * Scope можно ограничить поддеревом, передав в `validateGroup` соответствующий путь.
 *
 * @example
 * ```typescript
 * // Scope = root form
 * validateGroup(path, (scope, root) => {
 *   const v = scope.getValue();
 *   if (v.startDate > v.endDate) return { code: 'badRange', message: '...' };
 *   return null;
 * });
 *
 * // Scope = поддерево
 * validateGroup(path.address, (address, root) => {
 *   if (address.city.value.value === '' && address.region.value.value !== '') {
 *     return { code: 'inconsistent', message: '...' };
 *   }
 *   return null;
 * });
 * ```
 */
export type GroupValidator<TForm, TScope = TForm> = (
  scope: FormProxy<TScope>,
  root: FormProxy<TForm>
) => ValidationError | null;

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

/**
 * Опции для функции validateGroup.
 *
 * @remarks
 * `targetField` принимает любой `FieldPathNode`, так как при доступе к вложенным
 * полям (`path.foo.bar`) первый generic становится типом ближайшего родителя
 * (`FieldPathNode<Foo, …>`), а не корня формы. Строгая привязка к `TForm`
 * приводит к type errors на legitimate use cases вроде `targetField: path.passportData.issueDate`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface ValidateGroupOptions<TForm = unknown> {
  /** Поле, к которому привязать ошибку. */
  targetField?: FieldPathNode<unknown, unknown>;
}

// ============================================================================
// Тип функции validation schema
// ============================================================================

/**
 * Функция validation schema.
 *
 * Принимает FieldPath и определяет все правила валидации для формы.
 */
export type ValidationSchemaFn<T> = (path: FieldPath<T>) => void;

// ============================================================================
// Внутренние типы для реализации
// ============================================================================

/**
 * Регистрация валидатора в системе
 * @internal
 */
export interface ValidatorRegistration {
  fieldPath: string;
  type: 'sync' | 'async' | 'group' | 'array-items';
  validator:
    | Validator<unknown, unknown>
    | AsyncValidator<unknown, unknown>
    | GroupValidator<unknown, unknown>;
  options?: ValidateOptions | ValidateAsyncOptions | ValidateGroupOptions<unknown>;
  /** Для group-валидатора — путь до scope (для root формы — пустая строка ''). */
  scopePath?: string;
  /** Для условной валидации (applyWhen). */
  condition?: {
    fieldPath: string;
    conditionFn: ConditionFn<unknown>;
  };
}
