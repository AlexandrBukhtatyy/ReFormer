/**
 * Валидатор регулярного выражения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/pattern
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора регулярного выражения.
 *
 * Пустые значения (`''`/`null`/`undefined`) пропускаются (используйте {@link required}
 * для обязательности).
 *
 * @param regex - Регулярное выражение для проверки значения
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадает `pattern` (строка-источник regex).
 * @returns Чистый валидатор {@link Validator} для строкового поля
 *
 * @example Проверка по регулярному выражению
 * ```typescript
 * import { required, pattern } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * name: {
 *   value: model.$.name,
 *   component: Input,
 *   validators: [pattern(/^[a-zA-Zа-яА-Я]+$/, { message: 'Только буквы' })],
 * },
 * phone: {
 *   value: model.$.phone,
 *   component: InputMask,
 *   validators: [
 *     required(),
 *     pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Формат +7 (999) 123-45-67' }),
 *   ],
 * },
 * ```
 */
export function pattern<TForm = unknown, TField extends string | null | undefined = string>(
  regex: RegExp,
  options?: ValidateOptions
): Validator<TForm, TField> {
  // Клонируем regex: с флагами /g или /y `RegExp.test` stateful (двигает `lastIndex`
  // между вызовами), из-за чего один и тот же ввод чередовал бы valid/invalid. Клон
  // изолирует состояние от экземпляра вызывающего кода; `lastIndex` сбрасываем на каждый вызов.
  const re = new RegExp(regex.source, regex.flags);
  return (value) => {
    if (!value) {
      return null;
    }
    re.lastIndex = 0;
    if (!re.test(value as string)) {
      return {
        code: 'pattern',
        message: options?.message ?? '',
        params: { pattern: regex.source, ...options?.params },
      };
    }
    return null;
  };
}
