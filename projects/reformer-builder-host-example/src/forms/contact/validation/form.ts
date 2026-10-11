// validation/form.ts — валидация формы: поле `validation` сборки (application/create.ts).
// Ваш файл: правлен руками, при регенерации не затирается.

import type { FormValidation } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import type { ContactForm } from '../types/contact';

/** Правила формы: проверяются при отправке. */
export const formRules = defineValidation<ContactForm>(({ model }) => {
  // Тексты замечаний — по коду правила из локали формы (`validation.required`, `validation.email`).
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});

/** Валидация формы — поле `validation` сборки. Сюда же — стратегия живой проверки (`strategy`). */
export const formValidation: FormValidation<ContactForm> = { rules: formRules };
