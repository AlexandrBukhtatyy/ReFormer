/**
 * Валидатор минимальной длины (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min-length
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора минимальной длины строки или массива.
 *
 * Работает со строкой или массивом (проверяется `value.length`). Пустые значения
 * (`null`/`undefined`/`''`) и значения без числового `length` пропускаются
 * (используйте {@link required} для обязательности).
 *
 * Длина строки — в единицах UTF-16, как `String.length` и атрибут `minlength` браузера: эмодзи и
 * другие символы вне BMP считаются за 2, графемы не склеиваются.
 *
 * У строки замечание — `minLength` (символы), у массива — `minItems` (элементы): мультивыбор и
 * список считают выбранное, и текст «не меньше 3 символов» под ними был бы бессмыслицей.
 *
 * @param minLen - Минимально допустимая длина (включительно)
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадают `minLength` и `actualLength`.
 * @returns Правило {@link Rule} для строки или массива
 *
 * @example Минимальная длина строки
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, minLength } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.name, [minLength(2)]);
 *   validate(model.$.password, [required(), minLength(8, { code: 'password.minLength' })]);
 * });
 * ```
 */
export function minLength(minLen: number, options?: RuleOptions): Rule<unknown> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const len = (value as { length?: number }).length;
    if (typeof len !== 'number') return null;
    if (len < minLen) {
      return Array.isArray(value)
        ? validationIssue('minItems', options, { minLength: minLen, actualLength: len })
        : validationIssue('minLength', options, { minLength: minLen, actualLength: len });
    }
    return null;
  };
}
