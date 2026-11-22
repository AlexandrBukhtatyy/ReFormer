// @reformer-generated 6a37762f2c7e
// validation/kontakty.ts — правила шага «Контакты»: их проверяет «Далее», отправка — все шаги сразу.
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import { validate, defineValidation } from '@reformer/core/validation';
import { email, maxLength, phone, required } from '@reformer/core/validators';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';

/** Правила шага «Контакты»: их проверяет «Далее». */
export const stepRules = defineValidation<ReformerMultiStepForm>(({ model }) => {
  validate(model.$.phone, [phone()]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.skills, [maxLength(3)]);
  validate(model.$.city, [required()]);
});
