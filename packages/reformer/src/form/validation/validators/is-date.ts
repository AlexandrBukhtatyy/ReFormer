/**
 * Валидатор проверки формата даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/is-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate } from './date-utils';

/**
 * Фабрика валидатора, проверяющего что значение — валидная дата.
 *
 * Принимает `Date` или строку, парсимую в дату. Пустые значения (`''`/`null`/`undefined`)
 * пропускаются (используйте {@link required} для обязательности).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Чистый валидатор {@link Validator} для поля даты (`string | Date`)
 *
 * @example Проверка валидности даты
 * ```typescript
 * import { required, isDate } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * eventDate: {
 *   value: model.$.eventDate,
 *   component: DatePicker,
 *   validators: [required(), isDate({ message: 'Введите корректную дату' })],
 * },
 * ```
 */
export function isDate<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return {
        code: 'date_invalid',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
