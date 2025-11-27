/**
 * Валидация возраста заемщика (18-70 лет)
 */

import type { FormContext, ValidationError } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application';

/**
 * Валидация возраста заемщика (18-70 лет)
 * @param ctx - контекст валидации с доступом к полям формы
 * @returns ошибка валидации или null
 */
export function validateAge(ctx: FormContext<CreditApplicationForm>): ValidationError | null {
  const form = ctx.form.getValue();
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
}
