import type { LoanType } from '../../types/credit-application';

const BASE_RATES: Record<LoanType, number> = {
  consumer: 15.5,
  mortgage: 8.5,
  car: 12.0,
  business: 18.0,
  refinancing: 14.0,
};
const DEFAULT_RATE = 15.0;

/** Процентная ставка (%): базовая по типу кредита с надбавками и скидками. */
export function computeInterestRate({
  loanType,
  region,
  hasProperty,
  propertyCount,
}: {
  loanType: LoanType;
  region: string;
  hasProperty: boolean;
  propertyCount: number;
}): number {
  let rate = BASE_RATES[loanType] ?? DEFAULT_RATE;
  // Надбавка за регион: Москва дороже
  if (loanType === 'mortgage' && region === 'moscow') rate += 0.5;
  // TODO: скидка за КАСКО для автокредита — нужен параметр carInsurance
  // Скидка за обеспечение имуществом
  if (hasProperty && propertyCount > 0) rate -= 0.5;
  return Math.max(rate, 0);
}
