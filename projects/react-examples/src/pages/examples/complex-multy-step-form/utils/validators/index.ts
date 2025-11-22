/**
 * Validator функции для кросс-полевой валидации
 */

export { validateInitialPayment } from './validate-initial-payment';
export { validatePaymentToIncome } from './validate-payment-to-income';
export { validateAge } from './validate-age';

// Warnings (предупреждения, не блокируют отправку)
export { warnHighDebtLoad, warnSeniorAge, warnLowWorkExperience } from './warnings';
