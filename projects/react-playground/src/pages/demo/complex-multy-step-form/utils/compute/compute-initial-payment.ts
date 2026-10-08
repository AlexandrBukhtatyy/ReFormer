import type { CreditApplicationForm } from '../../types/credit-application';

/** Первоначальный взнос (₽): 20 % стоимости недвижимости. */
export function computeInitialPayment({
  propertyValue,
}: Pick<CreditApplicationForm, 'propertyValue'>): number {
  return propertyValue ? Math.round(propertyValue * 0.2) : 0;
}
