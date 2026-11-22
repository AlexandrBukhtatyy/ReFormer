/**
 * Утилиты формы кредитной заявки: расчётные функции вычисляемых полей.
 */

// Реэкспорт типов
export type { Option } from '../types/option';

// Реэкспорт compute функций
export {
  computeInterestRate,
  computeMonthlyPayment,
  computeInitialPayment,
  computeFullName,
  computeAge,
  computeTotalIncome,
  computePaymentRatio,
  computeCoBorrowersIncome,
} from './compute';
