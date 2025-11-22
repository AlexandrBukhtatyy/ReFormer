/**
 * Утилиты формы кредитной заявки
 *
 * Содержит:
 * - Compute функции для вычисляемых полей
 * - Validator функции для кросс-полевой валидации
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

// Реэкспорт validator функций
export {
  validateInitialPayment,
  validatePaymentToIncome,
  validateAge,
  warnHighDebtLoad,
  warnSeniorAge,
  warnLowWorkExperience,
} from './validators';
