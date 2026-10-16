/**
 * Валидатор кратности (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/multiple-of
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора, проверяющего что число кратно заданному.
 *
 * Пустые значения и не-числа пропускаются (используйте {@link required} и {@link isNumber}).
 *
 * @param divisor - Делитель: значение должно быть кратно ему. Конечное число, не равное нулю, —
 *   иначе ошибка конфигурации (`RangeError`) при создании правила: кратность нулю вырождена.
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадает `multipleOf` (делитель).
 * @returns Правило {@link Rule} для числового поля
 *
 * @example Проверка кратности
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { multipleOf } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.rating, [multipleOf(0.5, { code: 'rating.multipleOf' })]);
 * });
 * ```
 */
export function multipleOf(
  divisor: number,
  options?: RuleOptions
): Rule<number | null | undefined> {
  if (!Number.isFinite(divisor) || divisor === 0) {
    throw new RangeError(
      `[@reformer/core] multipleOf(${String(divisor)}): делитель должен быть конечным числом, ` +
        'не равным нулю.'
    );
  }
  // `%` точен только для двоично-представимых чисел: 0.3 % 0.1 === 0.0999…, поэтому частное
  // сравнивается с ближайшим целым с допуском. Допуск относительный: ошибка округления растёт с
  // величиной, и абсолютный 1e-9 давал ложные ошибки на суммах около десяти миллионов с шагом 0.01.
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value)) return null;
    const quotient = value / divisor;
    const isMultiple =
      Math.abs(quotient - Math.round(quotient)) <=
      8 * Number.EPSILON * Math.max(1, Math.abs(quotient));
    if (!isMultiple) {
      return validationIssue('multipleOf', options, { multipleOf: divisor });
    }
    return null;
  };
}
