// @reformer-generated 54da984177c5
// validation/dopolnitelno.ts — правила шага «Дополнительно»: их проверяет «Далее», отправка — все шаги сразу.
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import { validate, defineValidation, applyEach } from '@reformer/core/validation';
import { max, maxFileSize, maxFiles, maxLength, min, required } from '@reformer/core/validators';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';

/** Правила шага «Дополнительно»: их проверяет «Далее». */
export const stepRules = defineValidation<ReformerMultiStepForm>(({ model }) => {
  validate(model.$.experience, [min(0), max(50)]);
  validate(model.$.about, [maxLength(500)]);
  validate(model.$.documents, [maxFiles(3), maxFileSize(5242880)]);
  applyEach(model.$.references, ({ model: item }) => {
    validate(item.$.name, [required()]);
  });
  validate(model.$.agree, [required()]);
});
