/**
 * Валидация возраста заемщика (18-70 лет)
 */

import type { Validator } from '@reformer/core';
import type { CreditApplicationForm } from '../../types/credit-application';

/**
 * Валидация возраста заемщика (18-70 лет).
 *
 * Cross-field validator: вычисляет возраст из birthDate (если age — computed) или берёт age напрямую.
 */
export const validateAge: Validator<CreditApplicationForm, unknown> = (_value, _control, root) => {
  const form = root.getValue();
  const age = form.age;

  if (!age) {
    return null;
  }

  if (age < 18) {
    return {
      code: 'ageTooYoung',
      message: 'Заемщик должен быть старше 18 лет',
    };
  }

  if (age > 70) {
    return {
      code: 'ageTooOld',
      message: 'Заемщик должен быть младше 70 лет',
    };
  }

  return null;
};
