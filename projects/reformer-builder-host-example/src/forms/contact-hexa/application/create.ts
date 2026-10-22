// @reformer-generated c0d04c1915e5
// application/create.ts — сборка формы: одна на все места подключения (страница, реестр
// форм, тесты). Регенерируется билдером; правки будут перезаписаны.

import { createForm, type CreateFormConfig, type FormBundle } from '@reformer/core';
import { defineFormBehavior, type FormBehavior } from '@reformer/core/behaviors';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { behaviorRules } from '../behavior';
import { createContactHexaFormModel } from '../model/model';
import rawSchema from '../schema/form.schema.json';
import { createRegistry } from '../schema/registry';
import type { ContactHexaForm } from '../types/contact-hexa';
import { formValidation } from '../validation/form';
import { wireSubmit, type SubmitOptions } from './submit';

// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
export const formSchema = rawSchema as unknown as JsonFormSchema<ContactHexaForm>;

/** Поведение сборки: правила формы и отправка. Фабрика — настройки приходят от места подключения. */
export function createFormBehavior(options: SubmitOptions = {}): FormBehavior<ContactHexaForm> {
  return defineFormBehavior<ContactHexaForm>((scope) => {
    behaviorRules(scope);
    wireSubmit(scope, options);
  });
}

type Overrides = Pick<CreateFormConfig<ContactHexaForm>, 'model' | 'schema' | 'registry'>;

/** Сборка формы — одна на все места подключения. */
export function createContactHexaForm(
  options: SubmitOptions = {},
  overrides: Overrides = {}
): FormBundle<ContactHexaForm> {
  return createForm<ContactHexaForm>({
    model: createContactHexaFormModel(),
    schema: formSchema,
    registry: createRegistry(),
    behavior: createFormBehavior(options),
    validation: formValidation,
    ...overrides,
  });
}
