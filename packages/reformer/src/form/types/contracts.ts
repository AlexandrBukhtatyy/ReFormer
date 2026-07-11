/**
 * Общие контракт-типы значения и валидации (state-слой).
 *
 * Эти типы нужны и headless-движку валидации данных (`validate-model-core`, `schema-node`,
 * `error-handler` — state), и form-слою. Живут в `model/`, поэтому state их импортирует напрямую,
 * а form-слой реэкспортирует из `form/types` (form→state разрешено). Так граница state⇏form не
 * нарушается: общие контракты принадлежат нижнему слою.
 *
 * @group Types
 * @module model/contracts
 */

/**
 * Represents any valid form value type
 * Use this instead of 'any' for form values to maintain type safety
 *
 * @group Types
 * @category Core Types
 */
export type FormValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | File
  | FormValue[]
  | { [key: string]: FormValue };

/**
 * Type-safe alternative to 'any' for unknown form values
 * Requires explicit type checking before use
 * @internal
 */
export type UnknownFormValue = unknown;

/**
 * Синхронная функция валидации
 * @group Types
 * @category Validation Types
 */
export type ValidatorFn<T = FormValue> = (value: T) => ValidationError | null;

/**
 * Опции для асинхронного валидатора
 * @group Types
 * @category Validation Types
 */
export interface AsyncValidatorOptions {
  /**
   * AbortSignal для отмены валидации
   * Позволяет отменить асинхронную операцию при новой валидации
   */
  signal?: AbortSignal;
}

/**
 * Асинхронная функция валидации
 *
 * @param value - Значение для валидации
 * @param options - Опции валидации (опционально)
 * @returns Promise с ошибкой валидации или null если значение валидно
 *
 * @example
 * ```typescript
 * // Простой валидатор (без поддержки отмены)
 * const emailExists: AsyncValidatorFn<string> = async (value) => {
 *   const exists = await checkEmail(value);
 *   return exists ? { code: 'exists', message: 'Email already exists' } : null;
 * };
 *
 * // Валидатор с поддержкой отмены
 * const emailExistsAbortable: AsyncValidatorFn<string> = async (value, options) => {
 *   const exists = await fetch(`/api/check-email?email=${value}`, {
 *     signal: options?.signal // Передаём signal в fetch для отмены запроса
 *   });
 *   return exists ? { code: 'exists', message: 'Email already exists' } : null;
 * };
 * ```
 *
 * @group Types
 * @category Validation Types
 */
export type AsyncValidatorFn<T = FormValue> = (
  value: T,
  options?: AsyncValidatorOptions
) => Promise<ValidationError | null>;

/**
 * Ошибка валидации
 * @group Types
 * @category Validation Types
 */
export interface ValidationError {
  code: string;
  message: string;
  params?: Record<string, FormValue>;
  /** Severity level: 'error' (default) blocks submission, 'warning' shows message but allows submission */
  severity?: 'error' | 'warning';
}

/**
 * Опции для фильтрации ошибок в методе getErrors()
 * @group Types
 * @category Validation Types
 */
export interface ErrorFilterOptions {
  /** Фильтр по коду ошибки */
  code?: string | string[];

  /** Фильтр по сообщению (поддерживает частичное совпадение) */
  message?: string;

  /** Фильтр по параметрам ошибки */
  params?: Record<string, FormValue>;

  /** Кастомный предикат для фильтрации */
  predicate?: (error: ValidationError) => boolean;
}

/**
 * Статус поля формы
 * @group Types
 * @category Core Types
 */
export type FieldStatus = 'valid' | 'invalid' | 'pending' | 'disabled';
