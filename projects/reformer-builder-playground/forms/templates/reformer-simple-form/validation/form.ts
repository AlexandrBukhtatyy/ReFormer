// @reformer-generated 2839bcd2e974
// validation/form.ts — валидация формы: поле `validation` сборки (application/create.ts).
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import type { FormValidation } from '@reformer/core';
import { validate, defineValidation, applyEach } from '@reformer/core/validation';
import {
  email,
  max,
  maxFileSize,
  maxFiles,
  maxLength,
  min,
  pastDate,
  phone,
  required,
} from '@reformer/core/validators';
import type { ReformerSimpleForm } from '../types/reformer-simple-form';

/** Правила формы: проверяются при отправке. */
export const formRules = defineValidation<ReformerSimpleForm>(({ model }) => {
  validate(model.$.lastName, [required()]);
  validate(model.$.firstName, [required()]);
  validate(model.$.birthDate, [pastDate()]);
  validate(model.$.phone, [phone()]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.skills, [maxLength(3)]);
  validate(model.$.experience, [min(0), max(50)]);
  validate(model.$.about, [maxLength(500)]);
  validate(model.$.documents, [maxFiles(3), maxFileSize(5242880)]);
  applyEach(model.$.references, ({ model: item }) => {
    validate(item.$.name, [required()]);
  });
  validate(model.$.agree, [required()]);
});

/** Валидация формы — поле `validation` сборки. Сюда же — стратегия живой проверки (`strategy`). */
export const formValidation: FormValidation<ReformerSimpleForm> = { rules: formRules };
