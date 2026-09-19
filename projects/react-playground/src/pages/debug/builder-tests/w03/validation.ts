// @reformer-generated 0f0ca9c6a62e
// validation.ts — валидация модели по шагам визарда. МОК: required выведены из схемы,
// допишите правила. Пишется один раз и при регенерации не затирается.

import { type FormModel } from '@reformer/core';
import { apply, validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { W03Form } from './types';

type Root = W03Form;

/** Шаг 1 — dannye-section. «Далее» проверяет только эти правила. */
export const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.lastName, [required({ message: 'Обязательное поле' })]);
  validate(model.$.firstName, [required({ message: 'Обязательное поле' })]);
});

/** Шаг 2 — kontakty-section. «Далее» проверяет только эти правила. */
export const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.email, [required({ message: 'Обязательное поле' })]);
});

/** Полная проверка (отправка): правила всех шагов. */
export const formValidation = defineValidationSchema<Root>(() => {
  apply(step1, step2);
});

/** Под-схемы по порядку шагов: индекс — номер шага минус один. */
const stepValidations = [step1, step2];

/**
 * Пошаговый контракт визарда (`FormWizard` → `config`). `touch: true` обязателен: киты показывают
 * ошибку только у тронутого поля, и без него остановленный шаг выглядел бы как неработающая кнопка.
 */
export function makeValidationConfig(model: FormModel<Root>) {
  return {
    validateStep: (step: number): Promise<boolean> => {
      const schema = stepValidations[step - 1];
      return schema === undefined
        ? Promise.resolve(true)
        : validateModel(model, schema, { touch: true });
    },
    validateAll: (): Promise<boolean> => validateModel(model, formValidation, { touch: true }),
  };
}
