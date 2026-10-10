// form.validation.ts — валидация модели. МОК: required выведены из схемы, допишите правила.
// Пишется один раз и при регенерации не затирается.

import { type FormModel } from '@reformer/core';
import { validate, defineValidation, validateModel } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import type { ContactForm } from './types';

type Root = ContactForm;

export const formValidation = defineValidation<Root>(({ model }) => {
  // Тексты замечаний — по коду правила из локали формы (`validation.required`, `validation.email`).
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});

/** Пошаговый контракт визарда. Полная проверка — validateModel(model, formValidation). */
export function makeValidationConfig(model: FormModel<Root>) {
  return {
    validateStep: (_step: number): Promise<boolean> => validateModel(model, formValidation),
    validateAll: (): Promise<boolean> => validateModel(model, formValidation),
  };
}
