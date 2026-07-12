/**
 * Валидатор минимального возраста (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/min-age
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, calculateAge } from './date-utils';

/**
 * Фабрика валидатора минимального возраста (по дате рождения).
 *
 * Возраст вычисляется по дате рождения относительно сегодняшнего дня. Пустые и невалидные
 * даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param minAgeValue - Минимально допустимый возраст (в полных годах)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `minAge` и `currentAge`.
 * @returns Чистый валидатор {@link Validator} для поля даты рождения (`string | Date`)
 *
 * @example Минимальный возраст
 * ```typescript
 * import { required, minAge } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * birthDate: {
 *   value: model.$.birthDate,
 *   component: DatePicker,
 *   validators: [required(), minAge(18, { message: 'Вам должно быть не менее 18 лет' })],
 * },
 * ```
 */
export function minAge<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(minAgeValue: number, options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const age = calculateAge(parsed);
    if (age < minAgeValue) {
      return {
        code: 'date_min_age',
        message: options?.message ?? 'invalid',
        params: { minAge: minAgeValue, currentAge: age, ...options?.params },
      };
    }
    return null;
  };
}
