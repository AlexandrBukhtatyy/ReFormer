/**
 * Вычисление общего дохода (основной + дополнительный)
 */

/**
 * Вычисление общего дохода (основной + дополнительный)
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param params - Объект с параметрами
 * @param params.monthlyIncome - Основной доход (₽)
 * @param params.additionalIncome - Дополнительный доход (₽)
 * @returns общий доход (₽)
 */
export function computeTotalIncome({
  monthlyIncome,
  additionalIncome,
}: {
  monthlyIncome: number;
  additionalIncome: number;
}): number {
  return (monthlyIncome || 0) + (additionalIncome || 0);
}
