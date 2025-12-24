/**
 * Валидатор максимального возраста
 *
 * @group Validation
 * @category Validators
 * @module validators/max-age
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';
import { parseDate, calculateAge } from './date-utils';

/**
 * Проверяет, что возраст (вычисленный из даты рождения) не больше указанного
 *
 * Пустые значения и невалидные даты пропускаются (используйте `required` и `isDate`).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации (дата рождения)
 * @param maxAgeValue - Максимально допустимый возраст в годах
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование - максимум 65 лет
 * validationSchema: (path) => [
 *   maxAge(path.birthDate, 65),
 * ]
 *
 * // С кастомным сообщением
 * maxAge(path.birthDate, 100, { message: 'Проверьте правильность даты рождения' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'date_max_age',
 *   message: 'Максимальный возраст: 65 лет',
 *   params: { maxAge: 65, currentAge: 70 }
 * }
 * ```
 */
export function maxAge<TForm, TField extends string | Date | undefined = string | Date>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  maxAgeValue: number,
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

    if (age > maxAgeValue) {
      return {
        code: 'date_max_age',
        message: options?.message || `Максимальный возраст: ${maxAgeValue} лет`,
        params: { maxAge: maxAgeValue, currentAge: age, ...options?.params },
      };
    }

    return null;
  });
}
