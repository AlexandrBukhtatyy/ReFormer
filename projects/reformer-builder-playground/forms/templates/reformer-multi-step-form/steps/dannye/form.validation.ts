// @reformer-generated d15987e01622
/**
 * Шаг «Данные» — правила полей шага. «Далее» проверяет только их.
 */
import { validate, defineValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { ReformerMultiStepFormForm } from '../../types';

export const stepValidation = defineValidationSchema<ReformerMultiStepFormForm>(({ model }) => {
  validate(model.$.lastName, [required()]);
  validate(model.$.firstName, [required()]);
});
