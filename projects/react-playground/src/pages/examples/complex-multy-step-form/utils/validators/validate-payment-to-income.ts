/**
 * Валидация платежеспособности (процент платежа от дохода ≤ 50%).
 */

import type { GroupValidator } from '@reformer/core';
import type { CreditApplicationForm } from '../../types/credit-application';

export const validatePaymentToIncome: GroupValidator<CreditApplicationForm> = (scope) => {
  const form = scope.getValue();
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
};
