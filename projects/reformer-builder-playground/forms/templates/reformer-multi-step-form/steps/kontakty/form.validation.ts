// @reformer-generated 73011d5a0d2f
/**
 * Шаг «Контакты» — правила полей шага. «Далее» проверяет только их.
 */
import { validate, defineValidation } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import type { ReformerMultiStepFormForm } from '../../types';

export const stepValidation = defineValidation<ReformerMultiStepFormForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});
