/**
 * Валидация первоначального взноса (должен быть >= 20% от стоимости недвижимости)
 */

import type { FormContext, ValidationError } from '@reformer/core';
import type { CreditApplicationForm } from '../../types/credit-application';

/**
 * Валидация первоначального взноса (должен быть >= 20% от стоимости недвижимости)
 * @param ctx - контекст валидации с доступом к полям формы
 * @returns ошибка валидации или null
 */
export function validateInitialPayment(
  ctx: FormContext<CreditApplicationForm>
): ValidationError | null {
  const form = ctx.form.getValue();
  const propertyValue = form.propertyValue;
  const initialPayment = form.initialPayment;
  const loanType = form.loanType;

  // Валидация только для ипотеки
  if (loanType !== 'mortgage') {
    return null;
  }

  if (!propertyValue || !initialPayment) {
    return null;
  }

  const minPayment = propertyValue * 0.2;

  if (initialPayment < minPayment) {
    return {
      code: 'initialPaymentTooLow',
      message: `Первоначальный взнос должен быть не менее 20% от стоимости недвижимости (${Math.round(minPayment)} ₽)`,
    };
  }

  return null;
}
