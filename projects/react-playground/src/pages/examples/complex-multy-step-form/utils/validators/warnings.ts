/**
 * Warnings (предупреждения) для формы заявки на кредит.
 *
 * severity: 'warning' — показываются пользователю, но не блокируют отправку.
 */

import type { GroupValidator } from '@reformer/core';
import type { CreditApplicationForm } from '../../types/credit-application';

/**
 * Предупреждение о высокой долговой нагрузке (> 40%, ≤ 50%).
 */
export const warnHighDebtLoad: GroupValidator<CreditApplicationForm> = (scope) => {
  const form = scope.getValue();
  const ratio = form.paymentToIncomeRatio;

  if (!ratio) return null;

  if (ratio > 40 && ratio <= 50) {
    return {
      code: 'highDebtLoad',
      message: 'Высокая долговая нагрузка. Рекомендуем уменьшить сумму кредита или увеличить срок.',
      severity: 'warning',
    };
  }

  return null;
};

/**
 * Предупреждение о возрасте > 60 лет.
 */
export const warnSeniorAge: GroupValidator<CreditApplicationForm> = (scope) => {
  const form = scope.getValue();
  const age = form.age;

  if (!age) return null;

  if (age > 60 && age <= 70) {
    return {
      code: 'seniorAge',
      message: 'Могут потребоваться дополнительные гарантии в связи с возрастом.',
      severity: 'warning',
    };
  }

  return null;
};

/**
 * Предупреждение о малом стаже на текущем месте работы (< 3 месяцев).
 */
export const warnLowWorkExperience: GroupValidator<CreditApplicationForm> = (scope) => {
  const form = scope.getValue();
  const experience = form.workExperienceCurrent;

  if (experience === null || experience === undefined) return null;

  if (experience < 3) {
    return {
      code: 'lowWorkExperience',
      message: 'Малый стаж на текущем месте работы может повлиять на решение по заявке.',
      severity: 'warning',
    };
  }

  return null;
};
