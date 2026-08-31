/**
 * Вычисление процента платежа от дохода
 */

/**
 * Вычисление процента платежа от дохода
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param params - Объект с параметрами
 * @param params.monthlyPayment - Ежемесячный платеж (₽)
 * @param params.totalIncome - Общий доход (₽)
 * @returns процент платежа от дохода (%)
 */
export function computePaymentRatio({
  monthlyPayment,
  totalIncome,
}: {
  monthlyPayment: number;
  totalIncome: number;
}): number {
  if (!monthlyPayment || !totalIncome || totalIncome === 0) {
    return 0;
  }

  return Math.round((monthlyPayment / totalIncome) * 100);
}
