/**
 * Функции валидации для validation schema
 */

import { extractPath, createFieldPath } from './field-path';
import type { FieldPath } from '../types/field-path';
import { getCurrentValidationRegistry } from '../utils/registry-helpers';
import type {
  ContextualValidatorFn,
  ContextualAsyncValidatorFn,
  TreeValidatorFn,
  ConditionFn,
  ValidateOptions,
  ValidateAsyncOptions,
  ValidateTreeOptions,
} from '../types/validation-schema';
import type { FieldPathNode } from '../types';

// ============================================================================
// validate - Кастомная валидация поля
// ============================================================================

/**
 * Зарегистрировать кастомный синхронный валидатор для поля
 * Поддерживает опциональные поля
 *
 * @example
 * ```typescript
 * validate(path.birthDate, (ctx) => {
 *   const birthDate = new Date(ctx.value());
 *   const age = calculateAge(birthDate);
 *
 *   if (age < 18) {
 *     return {
 *       code: 'tooYoung',
 *       message: 'Заемщику должно быть не менее 18 лет',
 *     };
 *   }
 *
 *   return null;
 * });
 * ```
 */
export function validate<TForm = any, TField = any>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  validatorFn: ContextualValidatorFn<TForm, TField>,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath
  const path = extractPath(fieldPath as any);
  getCurrentValidationRegistry().registerSync(path, validatorFn, options);
}

// ============================================================================
// validateAsync - Асинхронная валидация поля
// ============================================================================

/**
 * Зарегистрировать асинхронный валидатор для поля
 *
 * @example
 * ```typescript
 * validateAsync(
 *   path.inn,
 *   async (ctx) => {
 *     const inn = ctx.value();
 *     if (!inn) return null;
 *
 *     const response = await fetch('/api/validate-inn', {
 *       method: 'POST',
 *       body: JSON.stringify({ inn }),
 *     });
 *
 *     const data = await response.json();
 *     if (!data.valid) {
 *       return {
 *         code: 'invalidInn',
 *         message: 'ИНН не найден в базе данных ФНС',
 *       };
 *     }
 *
 *     return null;
 *   },
 *   { debounce: 1000 }
 * );
 * ```
 */
export function validateAsync<TForm = any, TField = any>(
  fieldPath: FieldPathNode<TForm, TField>,
  validatorFn: ContextualAsyncValidatorFn<TForm, TField>,
  options?: ValidateAsyncOptions
): void {
  const path = extractPath(fieldPath);
  getCurrentValidationRegistry().registerAsync(path, validatorFn, options);
}

// ============================================================================
// validateTree - Cross-field валидация
// ============================================================================

/**
 * Зарегистрировать cross-field валидатор
 *
 * Используется для валидации, которая зависит от нескольких полей
 *
 * @example
 * ```typescript
 * validateTree(
 *   (ctx) => {
 *     const form = ctx.formValue();
 *     if (form.initialPayment && form.propertyValue) {
 *       if (form.initialPayment > form.propertyValue) {
 *         return {
 *           code: 'initialPaymentTooHigh',
 *           message: 'Первоначальный взнос не может превышать стоимость',
 *         };
 *       }
 *     }
 *     return null;
 *   },
 *   { targetField: 'initialPayment' }
 * );
 * ```
 */
export function validateTree<TForm = any>(
  validatorFn: TreeValidatorFn<TForm>,
  options?: ValidateTreeOptions
): void {
  getCurrentValidationRegistry().registerTree(validatorFn, options);
}

// ============================================================================
// applyWhen - Условная валидация
// ============================================================================

/**
 * Применить валидацию только при выполнении условия
 *
 * @example
 * ```typescript
 * applyWhen(
 *   path.loanType,
 *   (type) => type === 'mortgage',
 *   (path) => {
 *     required(path.propertyValue, { message: 'Укажите стоимость' });
 *     min(path.propertyValue, 1000000);
 *   }
 * );
 * ```
 */
export function applyWhen<TForm = any, TField = any>(
  fieldPath: FieldPathNode<TForm, TField>,
  condition: ConditionFn<TField>,
  validationFn: (path: FieldPath<TForm>) => void
): void {
  const path = extractPath(fieldPath);

  // Входим в условный блок
  getCurrentValidationRegistry().enterCondition(path, condition);

  try {
    // Выполняем вложенную валидацию
    // Создаем новый FieldPath proxy для вложенной функции
    const nestedPath = createFieldPath<TForm>();
    validationFn(nestedPath);
  } finally {
    // Выходим из условного блока
    getCurrentValidationRegistry().exitCondition();
  }
}

// ============================================================================
// Переиспользуемые валидаторы (адаптеры для old-style validators)
// ============================================================================

/**
 * Адаптер для required валидатора
 * Поддерживает опциональные поля (TField | undefined)
 */
export function required<TForm = any, TField = any>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    // Проверка на пустое значение
    if (value === null || value === undefined || value === '') {
      return {
        code: 'required',
        message: options?.message || 'Поле обязательно для заполнения',
        params: options?.params,
      };
    }

    // Для булевых значений требуем true
    if (typeof value === 'boolean' && value !== true) {
      return {
        code: 'required',
        message: options?.message || 'Поле обязательно для заполнения',
        params: options?.params,
      };
    }

    return null;
  });
}

/**
 * Адаптер для min валидатора
 * Поддерживает опциональные поля (number | undefined)
 */
export function min<TForm = any, TField extends number | undefined = number>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  minValue: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (value === null || value === undefined) {
      return null; // Пропускаем, если пусто (используйте required для обязательности)
    }

    if (value < minValue) {
      return {
        code: 'min',
        message: options?.message || `Минимальное значение: ${minValue}`,
        params: { min: minValue, actual: value, ...options?.params },
      };
    }

    return null;
  });
}

/**
 * Адаптер для max валидатора
 * Поддерживает опциональные поля (number | undefined)
 */
export function max<TForm = any, TField extends number | undefined = number>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  maxValue: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (value === null || value === undefined) {
      return null;
    }

    if (value > maxValue) {
      return {
        code: 'max',
        message: options?.message || `Максимальное значение: ${maxValue}`,
        params: { max: maxValue, actual: value, ...options?.params },
      };
    }

    return null;
  });
}

/**
 * Адаптер для minLength валидатора
 * Поддерживает опциональные поля (string | undefined)
 */
export function minLength<TForm = any, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  minLen: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (!value) {
      return null;
    }

    if (value.length < minLen) {
      return {
        code: 'minLength',
        message: options?.message || `Минимальная длина: ${minLen} символов`,
        params: { minLength: minLen, actualLength: value.length, ...options?.params },
      };
    }

    return null;
  });
}

/**
 * Адаптер для maxLength валидатора
 * Поддерживает опциональные поля (string | undefined)
 */
export function maxLength<TForm = any, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  maxLen: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (!value) {
      return null;
    }

    if (value.length > maxLen) {
      return {
        code: 'maxLength',
        message: options?.message || `Максимальная длина: ${maxLen} символов`,
        params: { maxLength: maxLen, actualLength: value.length, ...options?.params },
      };
    }

    return null;
  });
}

/**
 * Адаптер для email валидатора
 * Поддерживает опциональные поля (string | undefined)
 */
export function email<TForm = any, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (!value) {
      return null;
    }

    if (!emailRegex.test(value)) {
      return {
        code: 'email',
        message: options?.message || 'Неверный формат email',
        params: options?.params,
      };
    }

    return null;
  });
}

/**
 * Адаптер для pattern валидатора
 * Поддерживает опциональные поля (string | undefined)
 */
export function pattern<TForm = any, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  regex: RegExp,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (!value) {
      return null;
    }

    if (!regex.test(value)) {
      return {
        code: 'pattern',
        message: options?.message || 'Значение не соответствует требуемому формату',
        params: { pattern: regex.source, ...options?.params },
      };
    }

    return null;
  });
}

// ============================================================================
// apply - Применить validation schema (композиция схем)
// ============================================================================

/**
 * Применить другую validation schema внутри текущей
 *
 * Позволяет композировать validation схемы, используя их повторно.
 * Контракты схожи с applyWhen, но без условия.
 *
 * @example
 * ```typescript
 * // Базовые схемы валидации
 * const emailValidation = (path: FieldPath<MyForm>) => {
 *   required(path.email, { message: 'Email обязателен' });
 *   email(path.email);
 * };
 *
 * const passwordValidation = (path: FieldPath<MyForm>) => {
 *   required(path.password);
 *   minLength(path.password, 8);
 * };
 *
 * // Композиция схем через apply
 * const authValidation = (path: FieldPath<MyForm>) => {
 *   apply(path, emailValidation);
 *   apply(path, passwordValidation);
 * };
 *
 * // Применение к форме
 * form.applyValidationSchema(authValidation);
 * ```
 */
export function apply<TForm = any>(
  path: FieldPath<TForm>,
  validationFn: (path: FieldPath<TForm>) => void
): void {
  validationFn(path);
}
