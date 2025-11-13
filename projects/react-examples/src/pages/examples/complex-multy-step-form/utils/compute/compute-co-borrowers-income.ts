/**
 * Вычисление общего дохода созаемщиков
 */

/**
 * Вычисление общего дохода созаемщиков
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param coBorrowers - Массив созаемщиков
 * @returns общий доход созаемщиков (₽)
 */
export function computeCoBorrowersIncome(coBorrowers: any[]): number {
  if (!coBorrowers || !Array.isArray(coBorrowers)) {
    return 0;
  }

  return coBorrowers.reduce((sum, coBorrower) => {
    const income = coBorrower?.monthlyIncome || 0;
    return sum + income;
  }, 0);
}
