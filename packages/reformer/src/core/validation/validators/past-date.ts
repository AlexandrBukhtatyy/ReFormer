/**
 * Валидатор даты в прошлом (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/past-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, getToday, normalizeDate } from './date-utils';

/**
 * Фабрика валидатора, проверяющего что дата не в будущем.
 *
 * Дата не должна быть позже сегодняшнего дня (сравнение по нормализованным датам).
 * Пустые и невалидные даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Чистый валидатор {@link Validator} для поля даты (`string | Date`)
 *
 * @example Дата не в будущем
 * ```typescript
 * import { required, pastDate } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * birthDate: {
 *   value: model.$.birthDate,
 *   component: DatePicker,
 *   validators: [required(), pastDate({ message: 'Дата рождения не может быть в будущем' })],
 * },
 * ```
 */
export function pastDate<TForm = unknown, TField extends string | Date | undefined = string | Date>(
  options?: ValidateOptions
): Validator<TForm, TField> {
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

    if (normalizedValue > today) {
      return {
        code: 'date_future',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
