// @reformer-generated 96bf298485a9
// application/create.ts — сборка формы: одна на все места подключения (страница, реестр
// форм, тесты). Регенерируется билдером; правки будут перезаписаны.

import { createForm, type CreateFormConfig, type FormBundle } from '@reformer/core';
import { defineFormBehavior, type FormBehavior } from '@reformer/core/behaviors';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { behaviorRules } from '../behavior';
import { createReformerSimpleFormModel } from '../model/model';
import rawSchema from '../schema/form.schema.json';
import { createRegistry } from '../schema/registry';
import type { ReformerSimpleForm } from '../types/reformer-simple-form';
import { formValidation } from '../validation/form';
import { wireSubmit, type SubmitOptions } from './submit';

// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
export const formSchema = rawSchema as unknown as JsonFormSchema<ReformerSimpleForm>;

/** Поведение сборки: правила формы и отправка. Фабрика — настройки приходят от места подключения. */
export function createFormBehavior(options: SubmitOptions = {}): FormBehavior<ReformerSimpleForm> {
  return defineFormBehavior<ReformerSimpleForm>((scope) => {
    behaviorRules(scope);
    wireSubmit(scope, options);
  });
}

type Overrides = Pick<CreateFormConfig<ReformerSimpleForm>, 'model' | 'schema' | 'registry'>;

/** Сборка формы — одна на все места подключения. */
export function createReformerSimpleForm(
  options: SubmitOptions = {},
  overrides: Overrides = {}
): FormBundle<ReformerSimpleForm> {
  return createForm<ReformerSimpleForm>({
    model: createReformerSimpleFormModel(),
    schema: formSchema,
    registry: createRegistry(),
    behavior: createFormBehavior(options),
    validation: formValidation,
    ...overrides,
  });
}
