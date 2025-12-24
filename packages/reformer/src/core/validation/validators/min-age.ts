/**
 * Валидатор минимального возраста
 *
 * @group Validation
 * @category Validators
 * @module validators/min-age
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';
import { parseDate, calculateAge } from './date-utils';

/**
 * Проверяет, что возраст (вычисленный из даты рождения) не меньше указанного
 *
 * Пустые значения и невалидные даты пропускаются (используйте `required` и `isDate`).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации (дата рождения)
 * @param minAgeValue - Минимально допустимый возраст в годах
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование - минимум 18 лет
 * validationSchema: (path) => [
 *   minAge(path.birthDate, 18),
 * ]
 *
 * // С кастомным сообщением
 * minAge(path.birthDate, 21, { message: 'Вам должно быть не менее 21 года' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'date_min_age',
 *   message: 'Минимальный возраст: 18 лет',
 *   params: { minAge: 18, currentAge: 16 }
 * }
 * ```
 */
export function minAge<TForm, TField extends string | Date | undefined = string | Date>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  minAgeValue: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null; // Невалидные даты пропускаем, это проверяет isDate
    }

    const age = calculateAge(parsed);

    if (age < minAgeValue) {
      return {
        code: 'date_min_age',
        message: options?.message || `Минимальный возраст: ${minAgeValue} лет`,
        params: { minAge: minAgeValue, currentAge: age, ...options?.params },
      };
    }

    return null;
  });
}
