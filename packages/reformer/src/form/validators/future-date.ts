/**
 * Валидатор даты в будущем (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/future-date
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';
import { parseDate, getToday, normalizeDate } from './date-utils';
import { validationError } from './validation-error';

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
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, futureDate } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.appointmentDate, [required(), futureDate({ message: 'Дата записи должна быть в будущем' })]);
 * });
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
      return validationError('date_past', options);
    }
    return null;
  };
}
