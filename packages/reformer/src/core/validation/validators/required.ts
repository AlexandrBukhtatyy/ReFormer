/**
 * Валидатор обязательного поля
 * @module validators/required
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Валидатор обязательного поля
 *
 * Проверяет, что поле имеет непустое значение.
 * Пустыми считаются: `null`, `undefined`, `''` (пустая строка).
 * Для boolean полей требуется значение `true`.
 *
 * @param fieldPath - Путь к полю для валидации
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path, { validate }) => [
 *   required(path.name),
 *   required(path.email),
 * ]
 *
 * // С кастомным сообщением
 * required(path.phone, { message: 'Укажите номер телефона' })
 *
 * // Для checkbox (требует true)
 * required(path.agreeToTerms, { message: 'Необходимо принять условия' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'required',
 *   message: 'Поле обязательно для заполнения',
 *   params: {}
 * }
 * ```
 */
export function required<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath, (value) => {
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
