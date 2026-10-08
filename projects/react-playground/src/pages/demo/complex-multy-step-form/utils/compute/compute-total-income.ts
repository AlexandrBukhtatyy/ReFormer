import type { CreditApplicationForm } from '../../types/credit-application';

/** Общий доход (₽): основной, дополнительный и доход созаёмщиков. */
export function computeTotalIncome({
  monthlyIncome,
  additionalIncome,
  coBorrowersIncome,
}: Pick<
  CreditApplicationForm,
  'monthlyIncome' | 'additionalIncome' | 'coBorrowersIncome'
>): number {
  return (monthlyIncome ?? 0) + (additionalIncome ?? 0) + coBorrowersIncome;
}
