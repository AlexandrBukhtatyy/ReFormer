/**
 * Условия кредитной заявки — по одному определению на форму.
 *
 * Чистые функции над значениями: ими пользуются поведение (`enableWhen`, `hideWhen`), правила
 * (`validateWhen`) и JSX шагов.
 */

import type { EmploymentStatus, LoanType } from '../types/credit-application';

export const isMortgage = (loanType: LoanType): boolean => loanType === 'mortgage';
export const isCarLoan = (loanType: LoanType): boolean => loanType === 'car';
export const isBusinessLoan = (loanType: LoanType): boolean => loanType === 'business';

export const isEmployed = (employmentStatus: EmploymentStatus): boolean =>
  employmentStatus === 'employed';
export const isSelfEmployed = (employmentStatus: EmploymentStatus): boolean =>
  employmentStatus === 'selfEmployed';
export const isUnemployed = (employmentStatus: EmploymentStatus): boolean =>
  employmentStatus === 'unemployed';

/** Адрес проживания отличается от адреса регистрации. */
export const livesElsewhere = (sameAsRegistration: boolean): boolean =>
  sameAsRegistration === false;
