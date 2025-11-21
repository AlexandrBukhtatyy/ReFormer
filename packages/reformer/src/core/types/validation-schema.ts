/**
 * Типы для validation schema паттерна
 *
 * Основано на Angular Signal Forms подходе:
 * - Валидация определяется отдельно от схемы полей
 * - Поддержка условной валидации (applyWhen)
 * - Cross-field валидация (validateTree)
 * - Асинхронная валидация с контекстом
 */

import type { FormFields, ValidationError } from './index';
import type { FieldPath } from './field-path';
import type { FormContext } from './form-context';

// ============================================================================
// Функции валидации
// ============================================================================

/**
 * Функция валидации поля с контекстом
 *
 * Новый паттерн: (value, ctx: FormContext) => ValidationError | null
 *
 * @example
 * ```typescript
 * validate(path.email, (value, ctx) => {
 *   if (!value) return { code: 'required', message: 'Email required' };
 *   const confirm = ctx.form.confirmEmail.value.value;
 *   if (value !== confirm) return { code: 'mismatch', message: 'Must match' };
 *   return null;
 * });
 * ```
 */
export type ContextualValidatorFn<TForm, TField> = (
  value: TField,
  ctx: FormContext<TForm>
) => ValidationError | null;

/**
 * Асинхронная функция валидации поля с контекстом
 *
 * @example
 * ```typescript
 * validateAsync(path.email, async (value, ctx) => {
 *   const exists = await checkEmailExists(value);
 *   if (exists) return { code: 'exists', message: 'Email already taken' };
 *   return null;
 * });
 * ```
 */
export type ContextualAsyncValidatorFn<TForm, TField> = (
  value: TField,
  ctx: FormContext<TForm>
) => Promise<ValidationError | null>;

/**
 * Функция cross-field валидации
 *
 * @example
 * ```typescript
 * validateTree((ctx) => {
 *   const password = ctx.form.password.value.value;
 *   const confirm = ctx.form.confirmPassword.value.value;
 *   if (password !== confirm) {
 *     return { code: 'mismatch', message: 'Passwords must match' };
 *   }
 *   return null;
 * });
 * ```
 */
export type TreeValidatorFn<TForm> = (ctx: FormContext<TForm>) => ValidationError | null;

/**
 * Функция условия для applyWhen
 */
export type ConditionFn<T> = (value: T) => boolean;

// ============================================================================
// Опции валидации
// ============================================================================

/**
 * Опции для функции validate
 */
export interface ValidateOptions {
  /** Сообщение об ошибке */
  message?: string;
  /** Параметры ошибки */
  params?: FormFields;
}

/**
 * Опции для функции validateAsync
 */
export interface ValidateAsyncOptions extends ValidateOptions {
  /** Задержка перед выполнением валидации (в мс) */
  debounce?: number;
}

/**
 * Опции для функции validateTree
 */
export interface ValidateTreeOptions {
  /** Поле, к которому привязать ошибку */
  targetField?: string;
}

// ============================================================================
// Тип функции validation schema
// ============================================================================

/**
 * Функция validation schema
 *
 * Принимает FieldPath и определяет все правила валидации для формы
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
  type: 'sync' | 'async' | 'tree';
  validator:
    | ContextualValidatorFn<unknown, unknown>
    | ContextualAsyncValidatorFn<unknown, unknown>
    | TreeValidatorFn<unknown>;
  options?: ValidateOptions | ValidateAsyncOptions | ValidateTreeOptions;
  condition?: {
    fieldPath: string;
    conditionFn: ConditionFn<unknown>;
  };
}
