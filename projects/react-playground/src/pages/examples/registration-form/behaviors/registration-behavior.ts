/**
 * Behaviors для формы регистрации
 * Определяет взаимодействия между полями
 */

import { watchField, revalidateWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
import type { RegistrationFormData } from '../RegistrationForm';
import type { FieldPath } from '@reformer/core';

/**
 * Behavior schema для формы регистрации
 * Связывает confirmPassword с password для проверки совпадения
 */
export const registrationBehavior: BehaviorSchemaFn<RegistrationFormData> = (
  path: FieldPath<RegistrationFormData>
) => {
  // Behavior: при изменении password - автоматически проверять confirmPassword
  watchField(path.password, (passwordValue, ctx) => {
    const confirmPasswordValue = ctx.form.confirmPassword.value.value;

    // Если confirmPassword уже заполнен, проверяем совпадение
    if (confirmPasswordValue) {
      if (passwordValue !== confirmPasswordValue) {
        ctx.form.confirmPassword.setErrors([
          {
            code: 'passwords-mismatch',
            message: 'Пароли не совпадают',
          },
        ]);
      } else {
        // Очищаем ошибку совпадения, если пароли совпали
        ctx.form.confirmPassword.clearErrors({ code: 'passwords-mismatch' });
      }
    }
  });

  // Behavior: при вводе confirmPassword - проверять совпадение с password
  watchField(path.confirmPassword, (confirmPasswordValue, ctx) => {
    const passwordValue = ctx.form.password.value.value;

    if (confirmPasswordValue && passwordValue) {
      if (passwordValue !== confirmPasswordValue) {
        ctx.form.confirmPassword.setErrors([
          {
            code: 'passwords-mismatch',
            message: 'Пароли не совпадают',
          },
        ]);
      } else {
        // Очищаем ошибку совпадения, если пароли совпали
        ctx.form.confirmPassword.clearErrors({ code: 'passwords-mismatch' });
      }
    }
  });

  // При изменении password - автоматически ревалидировать confirmPassword
  revalidateWhen(path.confirmPassword, [path.password]);
};
