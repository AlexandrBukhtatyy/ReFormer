// @reformer-generated 8724cd820829
// application/create.ts — сборка формы: одна на все места подключения (страница, реестр
// форм, тесты). Регенерируется билдером; правки будут перезаписаны.

import { createForm, type CreateFormConfig, type FormBundle } from '@reformer/core';
import { defineFormBehavior, type FormBehavior } from '@reformer/core/behaviors';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { behaviorRules } from '../behavior';
import { createContactFormModel } from '../model/model';
import rawSchema from '../schema/form.schema.json';
import { createRegistry } from '../schema/registry';
import type { ContactForm } from '../types/contact';
import { formValidation } from '../validation/form';
import { wireSubmit, type SubmitOptions } from './submit';

// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
export const formSchema = rawSchema as unknown as JsonFormSchema<ContactForm>;

/** Поведение сборки: правила формы и отправка. Фабрика — настройки приходят от места подключения. */
export function createFormBehavior(options: SubmitOptions = {}): FormBehavior<ContactForm> {
  return defineFormBehavior<ContactForm>((scope) => {
    behaviorRules(scope);
    wireSubmit(scope, options);
  });
}

type Overrides = Pick<CreateFormConfig<ContactForm>, 'model' | 'schema' | 'registry'>;

/** Сборка формы — одна на все места подключения. */
export function createContactForm(
  options: SubmitOptions = {},
  overrides: Overrides = {}
): FormBundle<ContactForm> {
  return createForm<ContactForm>({
    model: createContactFormModel(),
    schema: formSchema,
    registry: createRegistry(),
    behavior: createFormBehavior(options),
    validation: formValidation,
    ...overrides,
  });
}
