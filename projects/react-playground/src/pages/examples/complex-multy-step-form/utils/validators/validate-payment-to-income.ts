/**
 * Валидация платежеспособности (процент платежа от дохода <= 50%)
 */

import type { FormContext, ValidationError } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application';

/**
 * Валидация платежеспособности (процент платежа от дохода <= 50%)
 * @param ctx - контекст валидации с доступом к полям формы
 * @returns ошибка валидации или null
 */
export function validatePaymentToIncome(
  ctx: FormContext<CreditApplicationForm>
): ValidationError | null {
  const form = ctx.form.getValue();
  const paymentRatio = form.paymentToIncomeRatio;

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
