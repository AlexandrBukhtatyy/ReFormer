// @reformer-generated f36bbf4f8537
/**
 * Валидация формы «Test04Break» — правила над МОДЕЛЬЮ, не в layout-схеме.
 * Запуск: validateModel(model, formValidation).
 */
import { validate, defineValidationSchema } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import type { Test04BreakForm } from './types';

export const formValidation = defineValidationSchema<Test04BreakForm>(({ model }) => {
  validate(model.$.lastName, [required()]);
  validate(model.$.firstName, [required()]);
  validate(model.$.email, [required(), email()]);
});
