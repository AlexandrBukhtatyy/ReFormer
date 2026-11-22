import type { CreditApplicationForm } from '../../types/credit-application';

/** Ежемесячный платёж (₽) по формуле аннуитета. */
export function computeMonthlyPayment({
  loanAmount,
  loanTerm,
  interestRate,
}: Pick<CreditApplicationForm, 'loanAmount' | 'loanTerm' | 'interestRate'>): number {
  if (!loanAmount || !loanTerm) return 0;
  const monthlyRate = interestRate / 12 / 100;
  if (monthlyRate === 0) return loanAmount / loanTerm;
  const growth = Math.pow(1 + monthlyRate, loanTerm);
  return Math.round((loanAmount * (monthlyRate * growth)) / (growth - 1));
}
