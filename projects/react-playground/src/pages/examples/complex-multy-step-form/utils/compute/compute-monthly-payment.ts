/**
 * Вычисление ежемесячного платежа по формуле аннуитета
 */

/**
 * Вычисление ежемесячного платежа по формуле аннуитета
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param params - Объект с параметрами
 * @param params.loanAmount - Сумма кредита (₽)
 * @param params.loanTerm - Срок кредита (месяцев)
 * @param params.interestRate - Процентная ставка (%)
 * @returns ежемесячный платеж (₽)
 *
 * Формула аннуитетного платежа:
 * monthlyPayment = P * (r * (1 + r)^n) / ((1 + r)^n - 1)
 * где:
 * P - сумма кредита (loanAmount)
 * r - месячная ставка (interestRate / 12 / 100)
 * n - срок кредита в месяцах (loanTerm)
 */
export function computeMonthlyPayment({
  loanAmount,
  loanTerm,
  interestRate,
}: {
  loanAmount: number;
  loanTerm: number;
  interestRate: number;
}): number {
  if (!loanAmount || !loanTerm || interestRate === undefined) {
    return 0;
  }

  // Месячная процентная ставка
  const monthlyRate = interestRate / 12 / 100;

  // Если ставка 0, то платеж = сумма / срок
  if (monthlyRate === 0) {
    return loanAmount / loanTerm;
  }

  // Формула аннуитетного платежа
  const coefficient =
    (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) / (Math.pow(1 + monthlyRate, loanTerm) - 1);
  const monthlyPayment = loanAmount * coefficient;

  return Math.round(monthlyPayment);
}
