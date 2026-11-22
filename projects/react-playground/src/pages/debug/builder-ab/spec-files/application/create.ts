// @reformer-generated bfe982e06bf1
// application/create.ts — сборка формы: одна на все места подключения (страница, реестр
// форм, тесты). Регенерируется билдером; правки будут перезаписаны.

import { createForm, type CreateFormConfig, type FormBundle } from '@reformer/core';
import { defineFormBehavior, type FormBehavior } from '@reformer/core/behaviors';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { behaviorRules } from '../behavior';
import { createCreditApplicationFormModel } from '../model/model';
import rawSchema from '../schema/form.schema.json';
import { createRegistry } from '../schema/registry';
import type { CreditApplicationForm } from '../types/credit-application';
import { formValidation } from '../validation/form';
import { wireSubmit, type SubmitOptions } from './submit';

// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
export const formSchema = rawSchema as unknown as JsonFormSchema<CreditApplicationForm>;

/** Поведение сборки: правила формы и отправка. Фабрика — настройки приходят от места подключения. */
export function createFormBehavior(
  options: SubmitOptions = {}
): FormBehavior<CreditApplicationForm> {
  return defineFormBehavior<CreditApplicationForm>((scope) => {
    behaviorRules(scope);
    wireSubmit(scope, options);
  });
}

type Overrides = Pick<CreateFormConfig<CreditApplicationForm>, 'model' | 'schema' | 'registry'>;

/** Сборка формы — одна на все места подключения. */
export function createCreditApplicationForm(
  options: SubmitOptions = {},
  overrides: Overrides = {}
): FormBundle<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    model: createCreditApplicationFormModel(),
    schema: formSchema,
    registry: createRegistry(),
    behavior: createFormBehavior(options),
    validation: formValidation,
    ...overrides,
  });
}
