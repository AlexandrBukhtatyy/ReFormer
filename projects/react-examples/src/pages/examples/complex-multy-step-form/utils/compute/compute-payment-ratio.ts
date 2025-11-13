/**
 * Вычисление процента платежа от дохода
 */

/**
 * Вычисление процента платежа от дохода
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param monthlyPayment - Ежемесячный платеж (₽)
 * @param totalIncome - Общий доход (₽)
 * @returns процент платежа от дохода (%)
 */
export function computePaymentRatio(monthlyPayment: number, totalIncome: number): number {
  if (!monthlyPayment || !totalIncome || totalIncome === 0) {
    return 0;
  }

  return Math.round((monthlyPayment / totalIncome) * 100);
}
