/**
 * Вычисление первоначального взноса (20% от стоимости недвижимости)
 */

/**
 * Вычисление первоначального взноса (20% от стоимости недвижимости)
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param propertyValue - Стоимость недвижимости (₽)
 * @returns первоначальный взнос (₽)
 */
export function computeInitialPayment(propertyValue: number): number {
  if (!propertyValue) {
    return 0;
  }

  return Math.round(propertyValue * 0.2);
}
