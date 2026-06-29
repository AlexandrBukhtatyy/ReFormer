/**
 * Утилиты формы кредитной заявки.
 *
 * Содержит compute-функции для вычисляемых полей. Валидация переехала в
 * `schemas/m1/validation.ts` (контракт `(value, model, root)` + `validateFormModel`).
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
