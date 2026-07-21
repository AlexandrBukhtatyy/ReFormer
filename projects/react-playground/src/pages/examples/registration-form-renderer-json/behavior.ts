/**
 * Реактивное поведение ДАННЫХ формы регистрации (третий слой рядом с JSON-layout и TS-валидацией).
 *
 * Передаётся в `createForm({ behavior })`. В отличие от валидации (запускается на submit),
 * behavior реагирует на изменения модели немедленно.
 *
 * Здесь один сценарий — снятие устаревшей ошибки «Пароли не совпадают». Правило `passwordsMatch`
 * (validation.ts) исполняется только на submit и роутит ошибку в ноду `confirmPassword`. Если после
 * этого пользователь начинает править ПЕРВЫЙ пароль, ошибка на `confirmPassword` повисла бы ложной
 * до следующего submit. `onChange(password)` снимает её сразу, как только исходное поле меняется.
 */

import { defineFormBehavior, onChange } from '@reformer/core/behaviors';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';

export const registrationBehavior = defineFormBehavior<RegistrationFormData>(({ model, form }) => {
  // Правка пароля делает прежний вердикт «совпадают/не совпадают» неактуальным — убираем ошибку
  // с подтверждения, чтобы она не висела до следующей отправки. Свежую проверку даст submit.
  onChange(model.$.password, () => {
    form.confirmPassword.clearErrors();
  });
});
