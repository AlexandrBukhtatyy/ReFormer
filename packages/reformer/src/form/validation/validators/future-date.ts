/**
 * Валидатор даты в будущем (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/future-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, getToday, normalizeDate } from './date-utils';

/**
 * Фабрика валидатора, проверяющего что дата не в прошлом.
 *
 * Дата не должна быть раньше сегодняшнего дня (сравнение по нормализованным датам).
 * Пустые и невалидные даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Чистый валидатор {@link Validator} для поля даты (`string | Date`)
 *
 * @example Дата не в прошлом
 * ```typescript
 * import { required, futureDate } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * appointmentDate: {
 *   value: model.$.appointmentDate,
 *   component: DatePicker,
 *   validators: [required(), futureDate({ message: 'Дата записи должна быть в будущем' })],
 * },
 * ```
 */
export function futureDate<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const normalizedValue = normalizeDate(parsed);
    const today = getToday();

    if (normalizedValue < today) {
      return {
        code: 'date_past',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
