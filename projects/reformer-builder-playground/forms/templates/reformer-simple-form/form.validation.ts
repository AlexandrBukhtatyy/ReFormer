// @reformer-generated f36bbf4f8537
/**
 * Валидация формы «ReformerSimpleForm» — правила над МОДЕЛЬЮ, не в layout-схеме.
 * Запуск: validateModel(model, formValidation).
 */
import { validate, defineValidationSchema } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import type { ReformerSimpleFormForm } from './types';

export const formValidation = defineValidationSchema<ReformerSimpleFormForm>(({ model }) => {
  validate(model.$.lastName, [required()]);
  validate(model.$.firstName, [required()]);
  validate(model.$.email, [required(), email()]);
});
