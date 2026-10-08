import type { CreditApplicationForm } from '../../types/credit-application';

/** Доля платежа в доходе (%). */
export function computePaymentRatio({
  monthlyPayment,
  totalIncome,
}: Pick<CreditApplicationForm, 'monthlyPayment' | 'totalIncome'>): number {
  if (!monthlyPayment || !totalIncome) return 0;
  return Math.round((monthlyPayment / totalIncome) * 100);
}
