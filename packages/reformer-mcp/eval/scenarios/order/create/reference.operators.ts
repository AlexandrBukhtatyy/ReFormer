/**
 * Свои операторы формы «OrderForm»: тело правила пишет автор формы, сборка только проверяет типы.
 */
import type { Rule } from '@reformer/core/validation';

/** Весовые коэффициенты контрольной цифры ИНН юридического лица (10 цифр). */
const INN_WEIGHTS = [2, 4, 10, 3, 5, 9, 4, 6, 8];

/**
 * Контрольная сумма ИНН юрлица: десятая цифра — остаток суммы первых девяти цифр с весами по модулю
 * 11, затем по модулю 10. Пустое значение и не 10 цифр — не её забота (`required`, `pattern`).
 */
export function innChecksum(options: { code: string }): Rule<string | null> {
  return (value) => {
    if (!value || !/^\d{10}$/.test(value)) return null;
    const digits = value.split('').map(Number);
    const sum = INN_WEIGHTS.reduce((total, weight, index) => total + weight * digits[index], 0);
    return (sum % 11) % 10 === digits[9] ? null : { code: options.code };
  };
}
