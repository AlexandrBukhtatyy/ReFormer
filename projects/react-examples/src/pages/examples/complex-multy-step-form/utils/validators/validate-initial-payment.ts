/**
 * Валидация первоначального взноса (должен быть >= 20% от стоимости недвижимости)
 */

import type { TreeValidationContext, ValidationError } from 'reformer';

/**
 * Валидация первоначального взноса (должен быть >= 20% от стоимости недвижимости)
 * @param ctx - контекст валидации с доступом к полям формы
 * @returns ошибка валидации или null
 */
export function validateInitialPayment(ctx: TreeValidationContext): ValidationError | null {
  const propertyValue = ctx.getField('propertyValue');
  const initialPayment = ctx.getField('initialPayment');
  const loanType = ctx.getField('loanType');

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
