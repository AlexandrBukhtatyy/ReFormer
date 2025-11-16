/**
 * Вычисление общего дохода созаемщиков
 */

/**
 * Вычисление общего дохода созаемщиков
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param params - Объект с параметрами
 * @param params.coBorrowers - Массив созаемщиков
 * @returns общий доход созаемщиков (₽)
 */
export function computeCoBorrowersIncome({ coBorrowers }: { coBorrowers: unknown[] }): number {
  if (!coBorrowers || !Array.isArray(coBorrowers)) {
    return 0;
  }

  return coBorrowers.reduce((sum, coBorrower) => {
    const income = (coBorrower as Record<string, unknown>)?.monthlyIncome || 0;
    return sum + (typeof income === 'number' ? income : 0);
  }, 0);
}
