// @reformer-form-build 1d7ac610388f0f6b собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Валидация формы «Форма регистрации» — правила над МОДЕЛЬЮ, не в схеме разметки.
 * Подключение: createForm({ …, validation: formValidation }).
 */
import { defineValidation, validate, validateAsync } from '@reformer/core/validation';
import { email, maxLength, minLength, pattern, required } from '@reformer/core/validators';
import type { FormaRegistratsiiShape } from './model';

export const formValidation = defineValidation<FormaRegistratsiiShape>(({ model, cross }) => {
  validate(model.$.login, [required({ code: 'login.required' }), minLength(3, { code: 'login.minLength' }), maxLength(20, { code: 'login.maxLength' }), pattern(/^[A-Za-z0-9_]+$/, { code: 'login.pattern' })]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.captcha, [required(), minLength(6), maxLength(6)]);
  validateAsync(model.$.captcha, [async (value) => { if (!value) return null; await new Promise((resolve) => setTimeout(resolve, 300)); return (String(value).toUpperCase() === "ABC123") ? null : { code: 'captcha.async' }; }]);
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, (values) => ((values.confirmPassword === values.password) ? null : { code: 'confirmPassword.cross' }));
});
