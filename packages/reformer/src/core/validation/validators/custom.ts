/**
 * Custom validator helper
 */

import { validate } from '../core/validate';
import type { ValidateOptions, ValidationContext } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Функция кастомной валидации
 */
export type CustomValidatorFn<T> = (value: T) => boolean | string | null;

/**
 * Адаптер для создания кастомных валидаторов
 * Упрощает создание собственных правил валидации
 *
 * @example
 * ```typescript
 * // Простая проверка
 * custom(path.password, (value) => {
 *   return value?.includes('@') ? 'Пароль не должен содержать @' : null;
 * });
 *
 * // С кодом ошибки
 * custom(
 *   path.username,
 *   (value) => value?.length >= 3,
 *   { code: 'username_too_short', message: 'Имя пользователя слишком короткое' }
 * );
 *
 * // Сложная проверка
 * custom(path.confirmPassword, (value) => {
 *   return value === form.password ? null : 'Пароли не совпадают';
 * });
 * ```
 */
export function custom<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  validatorFn: CustomValidatorFn<TField>,
  options?: ValidateOptions & {
    /** Код ошибки */
    code?: string;
  }
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as FieldPathNode<TForm, TField>, (ctx: ValidationContext<TForm, TField>) => {
    const value = ctx.value();

    // Выполняем кастомную функцию
    const result = validatorFn(value);

    // null или true - валидация пройдена
    if (result === null || result === true) {
      return null;
    }

    // false - валидация не пройдена, используем дефолтное сообщение
    if (result === false) {
      return {
        code: options?.code || 'custom',
        message: options?.message || 'Значение не прошло валидацию',
        params: options?.params,
      };
    }

    // string - валидация не пройдена, результат = сообщение об ошибке
    if (typeof result === 'string') {
      return {
        code: options?.code || 'custom',
        message: result,
        params: options?.params,
      };
    }

    return null;
  });
}

/**
 * Хелпер для создания переиспользуемых кастомных валидаторов
 *
 * @example
 * ```typescript
 * // Создаем переиспользуемый валидатор
 * const strongPassword = createCustomValidator<string>(
 *   (value) => {
 *     if (!value) return null;
 *     const hasUpper = /[A-Z]/.test(value);
 *     const hasLower = /[a-z]/.test(value);
 *     const hasNumber = /[0-9]/.test(value);
 *     const hasSpecial = /[!@#$%^&*]/.test(value);
 *
 *     if (!hasUpper) return 'Пароль должен содержать заглавную букву';
 *     if (!hasLower) return 'Пароль должен содержать строчную букву';
 *     if (!hasNumber) return 'Пароль должен содержать цифру';
 *     if (!hasSpecial) return 'Пароль должен содержать специальный символ';
 *
 *     return null;
 *   },
 *   { code: 'strong_password' }
 * );
 *
 * // Используем в форме
 * strongPassword(path.password);
 * ```
 */
export function createCustomValidator<TField>(
  validatorFn: CustomValidatorFn<TField>,
  defaultOptions?: ValidateOptions & { code?: string }
) {
  return <TForm>(
    fieldPath: FieldPathNode<TForm, TField> | undefined,
    options?: ValidateOptions & { code?: string }
  ) => {
    custom(fieldPath, validatorFn, { ...defaultOptions, ...options });
  };
}
