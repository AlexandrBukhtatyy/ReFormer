/**
 * Правила и предупреждения всей формы: проверяются целиком, при отправке.
 */

import type { ValidationIssue } from '@reformer/core';
import { defineValidation } from '@reformer/core/validation';
import type { CreditApplicationForm } from '../types/credit-application';

const paymentWithinIncome = (application: CreditApplicationForm): ValidationIssue | null =>
  application.paymentToIncomeRatio > 50
    ? { code: 'paymentTooHigh', params: { paymentToIncomeRatio: application.paymentToIncomeRatio } }
    : null;

const applicantAgeAllowed = (application: CreditApplicationForm): ValidationIssue | null => {
  const { age } = application;
  if (!age) return null;
  if (age < 18) return { code: 'ageTooYoung' };
  if (age > 70) return { code: 'ageTooOld' };
  return null;
};

const warnHighDebtLoad = (application: CreditApplicationForm): ValidationIssue | null =>
  application.paymentToIncomeRatio > 40 && application.paymentToIncomeRatio <= 50
    ? {
        code: 'highDebtLoad',
        severity: 'warning',
      }
    : null;

const warnSeniorAge = (application: CreditApplicationForm): ValidationIssue | null =>
  application.age !== null && application.age > 60 && application.age <= 70
    ? {
        code: 'seniorAge',
        severity: 'warning',
      }
    : null;

const warnLowExperience = (application: CreditApplicationForm): ValidationIssue | null =>
  application.workExperienceCurrent !== null && application.workExperienceCurrent < 3
    ? {
        code: 'lowWorkExperience',
        severity: 'warning',
      }
    : null;

export const crossStepRules = defineValidation<CreditApplicationForm>(({ model, cross }) => {
  cross(model.$.monthlyPayment, paymentWithinIncome);
  cross(model.$.age, applicantAgeAllowed);
  cross(model.$.age, warnSeniorAge);
  cross(model.$.paymentToIncomeRatio, warnHighDebtLoad);
  cross(model.$.workExperienceCurrent, warnLowExperience);
});
