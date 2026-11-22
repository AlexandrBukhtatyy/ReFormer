/** Суммарный доход созаёмщиков (₽). */
export function computeCoBorrowersIncome(monthlyIncomes: readonly number[]): number {
  return monthlyIncomes.reduce((total, monthlyIncome) => total + (monthlyIncome || 0), 0);
}
