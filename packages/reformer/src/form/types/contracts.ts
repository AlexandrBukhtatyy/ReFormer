/**
 * Общие контракт-типы значения и валидации.
 *
 * Базовый словарь «значение + ошибка + статус», на который опираются узлы формы
 * (`FormNode.getErrors`, `FieldNode`, `FormStatusMachine`, `aggregate-signals`), слой валидации
 * и платформенные биндинги. Файл не импортирует ничего — это лист графа зависимостей.
 *
 * Живёт в `form/types/`, а не в state-слое: `FieldStatus`/`ErrorFilterOptions` — понятия формы,
 * а state этих типов не использует (и импортировать их оттуда запрещено границей state⇏form).
 * Наружу отдаётся через `form/types/index`.
 *
 * @group Types
 * @module form/types/contracts
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
