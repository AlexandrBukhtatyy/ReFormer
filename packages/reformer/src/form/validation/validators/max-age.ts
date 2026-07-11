/**
 * Валидатор максимального возраста (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/max-age
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, calculateAge } from './date-utils';

/**
 * Фабрика валидатора максимального возраста (по дате рождения).
 *
 * Возраст вычисляется по дате рождения относительно сегодняшнего дня. Пустые и невалидные
 * даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param maxAgeValue - Максимально допустимый возраст (в полных годах)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `maxAge` и `currentAge`.
 * @returns Чистый валидатор {@link Validator} для поля даты рождения (`string | Date`)
 *
 * @example Максимальный возраст
 * ```typescript
 * import { maxAge } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * birthDate: {
 *   value: model.$.birthDate,
 *   component: DatePicker,
 *   validators: [maxAge(100, { message: 'Проверьте дату рождения' })],
 * },
 * ```
 */
export function maxAge<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(maxAgeValue: number, options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const age = calculateAge(parsed);
    if (age > maxAgeValue) {
      return {
        code: 'date_max_age',
        message: options?.message ?? 'invalid',
        params: { maxAge: maxAgeValue, currentAge: age, ...options?.params },
      };
    }
    return null;
  };
}
