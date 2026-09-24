// @reformer-generated 87a66384a1c4
/**
 * Валидация формы «Test04 break» — правила над МОДЕЛЬЮ, не в layout-схеме.
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
