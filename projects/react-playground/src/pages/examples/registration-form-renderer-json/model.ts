/**
 * Данные формы регистрации: начальные значения, фабрика модели, реактивность данных.
 *
 * Вынесено из `form-setup.ts`, потому что этими же частями пользуется запись реестра форм
 * (`form-entry.ts`). Держать их в одном месте обязательно: разъехавшийся `INITIAL` означал бы, что
 * страница и запись реестра собирают РАЗНЫЕ формы под одним именем.
 *
 * @module react-playground/examples/registration-form-renderer-json/model
 */

import { createModel, type FormModel } from '@reformer/core';
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';

export const INITIAL: RegistrationFormData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  phone: '',
  captcha: '',
  acceptTerms: false,
};

/** Свежая модель на каждый монтаж: общий объект `INITIAL` наружу не отдаётся. */
export function createRegistrationModel(): FormModel<RegistrationFormData> {
  return createModel<RegistrationFormData>({ ...INITIAL });
}

/**
 * Реактивность ДАННЫХ (`createJsonForm({ behavior })`): реагирует на изменения модели немедленно,
 * в отличие от валидации (только на submit). Здесь один сценарий — снятие устаревшей ошибки
 * «Пароли не совпадают»: `passwordsMatch` роутит её в ноду `confirmPassword` на submit, а правка
 * первого пароля делает вердикт неактуальным, поэтому ошибку убираем сразу.
 */
export const registrationBehavior = defineFormBehavior<RegistrationFormData>(({ model, form }) => {
  onChange(model.$.password, () => {
    form.confirmPassword.clearErrors();
  });
});
