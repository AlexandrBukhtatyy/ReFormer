/**
 * Вычисление общего дохода (основной + дополнительный)
 */

/**
 * Вычисление общего дохода (основной + дополнительный)
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param monthlyIncome - Основной доход (₽)
 * @param additionalIncome - Дополнительный доход (₽)
 * @returns общий доход (₽)
 */
export function computeTotalIncome(monthlyIncome: number, additionalIncome: number): number {
  return (monthlyIncome || 0) + (additionalIncome || 0);
}
