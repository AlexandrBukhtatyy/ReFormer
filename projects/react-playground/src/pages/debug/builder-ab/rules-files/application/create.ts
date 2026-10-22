// @reformer-generated 48e19713fe48
// application/create.ts — сборка формы: одна на все места подключения (страница, реестр
// форм, тесты). Регенерируется билдером; правки будут перезаписаны.

import { createForm, type CreateFormConfig, type FormBundle } from '@reformer/core';
import { defineFormBehavior, type FormBehavior } from '@reformer/core/behaviors';
import {
  composeJsonFormSchema,
  type JsonFormSchema,
  type JsonFormStep,
} from '@reformer/renderer-json';
import { behaviorRules } from '../behavior';
import { formFlow } from '../flow/reformer-multi-step-form-flow';
import { createReformerMultiStepFormModel } from '../model/model';
import rawSchema from '../schema/form.schema.json';
import step1Schema from '../schema/steps/dannye/form.schema.json';
import step2Schema from '../schema/steps/kontakty/form.schema.json';
import step3Schema from '../schema/steps/dopolnitelno/form.schema.json';
import { createRegistry } from '../schema/registry';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';
import { formValidation } from '../validation/form';
import { wireSubmit, type SubmitOptions } from './submit';

// Шаги визарда лежат в своих файлах: корневой документ держит ссылки (`$ref`), а форма
// собирается здесь. Ключ — ссылка как она записана в корневом документе.
const stepSchemas: Record<string, JsonFormStep> = {
  './steps/dannye/form.schema.json': step1Schema as unknown as JsonFormStep,
  './steps/kontakty/form.schema.json': step2Schema as unknown as JsonFormStep,
  './steps/dopolnitelno/form.schema.json': step3Schema as unknown as JsonFormStep,
};

// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
export const formSchema = composeJsonFormSchema(
  rawSchema as unknown as JsonFormSchema,
  stepSchemas
) as unknown as JsonFormSchema<ReformerMultiStepForm>;

/** Поведение сборки: правила формы и отправка. Фабрика — настройки приходят от места подключения. */
export function createFormBehavior(
  options: SubmitOptions = {}
): FormBehavior<ReformerMultiStepForm> {
  return defineFormBehavior<ReformerMultiStepForm>((scope) => {
    behaviorRules(scope);
    wireSubmit(scope, options);
  });
}

type Overrides = Pick<CreateFormConfig<ReformerMultiStepForm>, 'model' | 'schema' | 'registry'>;

/** Сборка формы — одна на все места подключения. */
export function createReformerMultiStepForm(
  options: SubmitOptions = {},
  overrides: Overrides = {}
): FormBundle<ReformerMultiStepForm> {
  return createForm<ReformerMultiStepForm>({
    model: createReformerMultiStepFormModel(),
    schema: formSchema,
    registry: createRegistry(),
    behavior: createFormBehavior(options),
    validation: formValidation,
    flow: formFlow,
    ...overrides,
  });
}
