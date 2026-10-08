/**
 * Валидатор проверки формата даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/is-date
 */

import type { ValidateOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate } from './date-utils';
import { validationError } from './validation-error';

/**
 * Фабрика валидатора, проверяющего что значение — валидная дата.
 *
 * Принимает `Date` или строку, парсимую в дату. Пустые значения (`''`/`null`/`undefined`)
 * пропускаются (используйте {@link required} для обязательности).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Правило {@link Rule} для поля даты (`string | Date`)
 *
 * @example Проверка валидности даты
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, isDate } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.eventDate, [required(), isDate({ message: 'Введите корректную дату' })]);
 * });
 * ```
 */
export function isDate(options?: ValidateOptions): Rule<string | Date | null | undefined> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value);
    if (parsed === null) {
      return validationError('date_invalid', options);
    }
    return null;
  };
}
