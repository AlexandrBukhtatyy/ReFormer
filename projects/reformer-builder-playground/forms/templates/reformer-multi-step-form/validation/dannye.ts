// @reformer-generated 512bb79ba265
// validation/dannye.ts — правила шага «Данные»: их проверяет «Далее», отправка — все шаги сразу.
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import { validate, defineValidation } from '@reformer/core/validation';
import { pastDate, required } from '@reformer/core/validators';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';

/** Правила шага «Данные»: их проверяет «Далее». */
export const stepRules = defineValidation<ReformerMultiStepForm>(({ model }) => {
  validate(model.$.lastName, [required()]);
  validate(model.$.firstName, [required()]);
  validate(model.$.birthDate, [pastDate()]);
});
