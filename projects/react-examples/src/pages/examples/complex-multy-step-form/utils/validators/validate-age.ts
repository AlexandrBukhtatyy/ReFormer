/**
 * Валидация возраста заемщика (18-70 лет)
 */

import type { TreeValidationContext, ValidationError } from '@/lib/forms';

/**
 * Валидация возраста заемщика (18-70 лет)
 * @param ctx - контекст валидации с доступом к полям формы
 * @returns ошибка валидации или null
 */
export function validateAge(ctx: TreeValidationContext): ValidationError | null {
  const age = ctx.getField('age');

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
