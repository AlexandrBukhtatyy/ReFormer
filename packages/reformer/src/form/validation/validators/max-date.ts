/**
 * Валидатор максимальной даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/max-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, normalizeDate } from './date-utils';

/**
 * Фабрика валидатора максимальной даты (включительно).
 *
 * Сравнение по нормализованным датам (время обнуляется). Пустые и невалидные даты
 * пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param maxDateValue - Максимально допустимая дата (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадает `maxDate`.
 * @returns Чистый валидатор {@link Validator} для поля даты (`string | Date`)
 *
 * @example Максимальная дата
 * ```typescript
 * import { maxDate } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * birthDate: {
 *   value: model.$.birthDate,
 *   component: DatePicker,
 *   validators: [maxDate(new Date(), { message: 'Дата не может быть в будущем' })],
 * },
 * ```
 */
export function maxDate<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(maxDateValue: Date, options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const normalizedValue = normalizeDate(parsed);
    const normalizedMax = normalizeDate(maxDateValue);

    if (normalizedValue > normalizedMax) {
      return {
        code: 'date_max',
        message: options?.message ?? 'invalid',
        params: { maxDate: maxDateValue, ...options?.params },
      };
    }
    return null;
  };
}
