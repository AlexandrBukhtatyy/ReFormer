/**
 * Валидатор регулярного выражения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/pattern
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора регулярного выражения.
 *
 * Пустые значения (`''`/`null`/`undefined`) пропускаются (используйте {@link required}
 * для обязательности).
 *
 * @param regex - Регулярное выражение для проверки значения
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадает `pattern` (строка-источник regex).
 * @returns Правило {@link Rule} для строкового поля
 *
 * @example Проверка по регулярному выражению
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, pattern } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.name, [pattern(/^[a-zA-Zа-яА-Я]+$/, { code: 'name.pattern' })]);
 *   validate(model.$.phone, [required(), pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { code: 'phone.pattern' })]);
 * });
 * ```
 */
export function pattern(regex: RegExp, options?: RuleOptions): Rule<string | null | undefined> {
  // Клонируем regex: с флагами /g или /y `RegExp.test` stateful (двигает `lastIndex`
  // между вызовами), из-за чего один и тот же ввод чередовал бы valid/invalid. Клон
  // изолирует состояние от экземпляра вызывающего кода; `lastIndex` сбрасываем на каждый вызов.
  const re = new RegExp(regex.source, regex.flags);
  return (value) => {
    if (!value) {
      return null;
    }
    re.lastIndex = 0;
    if (!re.test(value)) {
      return validationIssue('pattern', options, { pattern: regex.source });
    }
    return null;
  };
}
