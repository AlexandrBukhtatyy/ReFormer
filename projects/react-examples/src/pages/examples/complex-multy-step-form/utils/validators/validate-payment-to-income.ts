/**
 * Валидация платежеспособности (процент платежа от дохода <= 50%)
 */

import type { TreeValidationContext, ValidationError } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application';

/**
 * Валидация платежеспособности (процент платежа от дохода <= 50%)
 * @param ctx - контекст валидации с доступом к полям формы
 * @returns ошибка валидации или null
 */
export function validatePaymentToIncome(
  ctx: TreeValidationContext<CreditApplicationForm>
): ValidationError | null {
  const paymentRatio = ctx.getField('paymentToIncomeRatio');

  if (!paymentRatio) {
    return null;
  }

  if (paymentRatio > 50) {
    return {
      code: 'paymentTooHigh',
      message: `Ежемесячный платеж не должен превышать 50% дохода (сейчас ${paymentRatio}%)`,
    };
  }

  return null;
}
