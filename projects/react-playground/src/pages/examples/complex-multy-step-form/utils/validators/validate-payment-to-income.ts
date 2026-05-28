/**
 * Валидация платежеспособности (процент платежа от дохода ≤ 50%).
 */

import type { Validator } from '@reformer/core';
import type { CreditApplicationForm } from '../../types/credit-application';

export const validatePaymentToIncome: Validator<CreditApplicationForm, unknown> = (
  _value,
  _control,
  root
) => {
  const form = root.getValue();
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
