/**
 * Валидатор обязательного поля (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/required
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора обязательного поля.
 *
 * Возвращает чистую функцию-валидатор `(value, control, root)`. Передаётся в `validate()`.
 *
 * Пустыми считаются: `null`, `undefined`, `''` (пустая строка), `[]` (пустой массив —
 * обязательный multi-select / FieldArray без выбранных элементов).
 * Для boolean полей требуется значение `true`.
 *
 * @param options - Опции валидатора ({@link RuleOptions}): `code`, `params`
 * @returns Правило {@link Rule} для поля схемы
 *
 * @example Обязательные поля в схеме формы
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.email, [required()]);
 *   validate(model.$.phone, [required({ code: 'phone.required' })]);
 *   validate(model.$.agreeToTerms, [required({ code: 'agreeToTerms.required' })]);
 * });
 * ```
 */
export function required(options?: RuleOptions): Rule<unknown> {
  return (value) => {
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'boolean' && value !== true);
    if (isEmpty) {
      return validationIssue('required', options);
    }
    return null;
  };
}
