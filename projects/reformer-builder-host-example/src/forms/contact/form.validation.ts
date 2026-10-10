// form.validation.ts — валидация модели. МОК: required выведены из схемы, допишите правила.
// Пишется один раз и при регенерации не затирается.

import { type FormModel } from '@reformer/core';
import {
  applyValidationResult,
  validate,
  defineValidation,
  runValidation,
  type ValidationResult,
} from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import type { ContactForm } from './types';

type Root = ContactForm;

export const formValidation = defineValidation<Root>(({ model }) => {
  // Тексты замечаний — по коду правила из локали формы (`validation.required`, `validation.email`).
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});

/** Проверка шага визарда: правила шагам не разложены — каждый шаг проверяет всю форму. */
export function makeStepCheck(model: FormModel<Root>) {
  return async (_step: number): Promise<ValidationResult> => {
    const result = await runValidation(model, formValidation);
    applyValidationResult(result);
    return result;
  };
}
