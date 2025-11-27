/**
 * Вычисление общего дохода созаемщиков
 */

import type { CoBorrower } from '../../components/nested-forms/CoBorrower/CoBorrowerForm';

/**
 * Вычисление общего дохода созаемщиков
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param params - Объект с параметрами
 * @param params.coBorrowers - Массив созаемщиков
 * @returns общий доход созаемщиков (₽)
 */
export function computeCoBorrowersIncome({ coBorrowers }: { coBorrowers: CoBorrower[] }): number {
  if (!coBorrowers || !Array.isArray(coBorrowers)) {
    return 0;
  }

  return coBorrowers.reduce((sum, coBorrower) => {
    const income = coBorrower.monthlyIncome || 0;
    return sum + (typeof income === 'number' ? income : 0);
  }, 0);
}
