/**
 * Валидатор максимальной длины (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/max-length
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора максимальной длины строки или массива.
 *
 * Работает со строкой или массивом (проверяется `value.length`). Пустые значения
 * (`null`/`undefined`/`''`) и значения без числового `length` пропускаются
 * (используйте {@link required} для обязательности).
 *
 * @param maxLen - Максимально допустимая длина (включительно)
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадают `maxLength` и `actualLength`.
 * @returns Правило {@link Rule} для строки или массива
 *
 * @example Максимальная длина строки
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { maxLength } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.name, [maxLength(50)]);
 *   validate(model.$.bio, [maxLength(500, { code: 'bio.maxLength' })]);
 * });
 * ```
 */
export function maxLength(maxLen: number, options?: RuleOptions): Rule<unknown> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const len = (value as { length?: number }).length;
    if (typeof len !== 'number') return null;
    if (len > maxLen) {
      return validationIssue('maxLength', options, { maxLength: maxLen, actualLength: len });
    }
    return null;
  };
}
