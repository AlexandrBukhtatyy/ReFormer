/**
 * Валидатор даты в прошлом (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/past-date
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';
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
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, pastDate } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.birthDate, [required(), pastDate({ message: 'Дата рождения не может быть в будущем' })]);
 * });
 * ```
 */
export function pastDate<
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
