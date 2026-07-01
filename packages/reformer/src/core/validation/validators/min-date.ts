/**
 * Валидатор минимальной даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/min-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, normalizeDate } from './date-utils';

/**
 * Фабрика валидатора минимальной даты (включительно).
 *
 * Сравнение по нормализованным датам (время обнуляется). Пустые и невалидные даты
 * пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param minDateValue - Минимально допустимая дата (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадает `minDate`.
 * @returns Чистый валидатор {@link Validator} для поля даты (`string | Date`)
 *
 * @example Минимальная дата
 * ```typescript
 * import { required, minDate } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * startDate: {
 *   value: model.$.startDate,
 *   component: DatePicker,
 *   validators: [required(), minDate(new Date(), { message: 'Дата не раньше сегодня' })],
 * },
 * ```
 */
export function minDate<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(minDateValue: Date, options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const normalizedValue = normalizeDate(parsed);
    const normalizedMin = normalizeDate(minDateValue);

    if (normalizedValue < normalizedMin) {
      return {
        code: 'date_min',
        message: options?.message ?? 'invalid',
        params: { minDate: minDateValue, ...options?.params },
      };
    }
    return null;
  };
}
