// @reformer-generated 443e7d99e3c4
// form.validation.ts — валидация модели визарда. Правила шагов — в steps/<шаг>/form.validation.ts,
// здесь их сборка и поля вне шагов. Пишется один раз и при регенерации не затирается.

import { type FormModel } from '@reformer/core';
import { apply, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { stepValidations } from './steps';
import type { W03Form } from './types';

type Root = W03Form;

/** Полная проверка (отправка): правила всех шагов. */
export const formValidation = defineValidationSchema<Root>(() => {
  apply(...stepValidations);
});

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
