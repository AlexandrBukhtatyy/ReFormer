/**
 * Валидатор формата email (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/email
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Фабрика валидатора формата email.
 *
 * Проверяет по упрощённому regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Пустые значения
 * (`''`/`null`/`undefined`) пропускаются (используйте {@link required} для обязательности).
 *
 * @param options - Опции валидатора ({@link RuleOptions}): `code`, `params`
 * @returns Правило {@link Rule} для строкового поля
 *
 * @example Проверка формата email
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, email } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.email, [required(), email({ code: 'email.email' })]);
 * });
 * ```
 */
export function email(options?: RuleOptions): Rule<string | null | undefined> {
  return (value) => {
    if (!value) {
      return null;
    }
    if (!EMAIL_REGEX.test(value)) {
      return validationIssue('email', options);
    }
    return null;
  };
}
