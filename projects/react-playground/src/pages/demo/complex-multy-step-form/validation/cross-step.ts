/**
 * Правила и предупреждения всей формы: проверяются целиком, при отправке.
 */

import type { ValidationError } from '@reformer/core';
import { defineValidationSchema } from '@reformer/core/validation';
import type { CreditApplicationForm } from '../types/credit-application';

const paymentWithinIncome = (application: CreditApplicationForm): ValidationError | null =>
  application.paymentToIncomeRatio > 50
    ? {
        code: 'paymentTooHigh',
        message: `Ежемесячный платеж не должен превышать 50% дохода (сейчас ${application.paymentToIncomeRatio}%)`,
      }
    : null;

const applicantAgeAllowed = (application: CreditApplicationForm): ValidationError | null => {
  const { age } = application;
  if (!age) return null;
  if (age < 18) return { code: 'ageTooYoung', message: 'Заемщик должен быть старше 18 лет' };
  if (age > 70) return { code: 'ageTooOld', message: 'Заемщик должен быть младше 70 лет' };
  return null;
};

const warnHighDebtLoad = (application: CreditApplicationForm): ValidationError | null =>
  application.paymentToIncomeRatio > 40 && application.paymentToIncomeRatio <= 50
    ? {
        code: 'highDebtLoad',
        message: 'Высокая долговая нагрузка. Рекомендуем уменьшить сумму или увеличить срок.',
        severity: 'warning',
      }
    : null;

const warnSeniorAge = (application: CreditApplicationForm): ValidationError | null =>
  application.age !== null && application.age > 60 && application.age <= 70
    ? {
        code: 'seniorAge',
        message: 'Могут потребоваться дополнительные гарантии в связи с возрастом.',
        severity: 'warning',
      }
    : null;

const warnLowExperience = (application: CreditApplicationForm): ValidationError | null =>
  application.workExperienceCurrent !== null && application.workExperienceCurrent < 3
    ? {
        code: 'lowWorkExperience',
        message: 'Малый стаж на текущем месте может повлиять на решение.',
        severity: 'warning',
      }
    : null;

export const crossStepRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  cross(model.$.monthlyPayment, paymentWithinIncome);
  cross(model.$.age, applicantAgeAllowed);
  cross(model.$.age, warnSeniorAge);
  cross(model.$.paymentToIncomeRatio, warnHighDebtLoad);
  cross(model.$.workExperienceCurrent, warnLowExperience);
});
