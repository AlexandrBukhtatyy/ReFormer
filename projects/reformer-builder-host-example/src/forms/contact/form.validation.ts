// form.validation.ts — валидация модели. МОК: required выведены из схемы, допишите правила.
// Пишется один раз и при регенерации не затирается.

import { type FormModel } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import type { ContactForm } from './types';

type Root = ContactForm;

export const formValidation = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.name, [required({ message: 'Обязательное поле' })]);
  validate(model.$.email, [
    required({ message: 'Обязательное поле' }),
    email({ message: 'Похоже, в адресе опечатка' }),
  ]);
});

/** Пошаговый контракт визарда. Полная проверка — validateModel(model, formValidation). */
export function makeValidationConfig(model: FormModel<Root>) {
  return {
    validateStep: (_step: number): Promise<boolean> => validateModel(model, formValidation),
    validateAll: (): Promise<boolean> => validateModel(model, formValidation),
  };
}
