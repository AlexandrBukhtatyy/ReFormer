// @reformer-form-build 0a5745bb657376ee собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormRenderer } from '@reformer/renderer-react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { formBehavior } from './form.behavior';
import { formMessages } from './form.messages';
import schemaDocument from './form.schema.json';
import { formValidation } from './form.validation';
import { createFormModel, type RegistratsiyaShape } from './model';
import { createRegistry } from './registry';

const registry = createRegistry();
const formSchema = schemaDocument as unknown as JsonFormSchema<RegistratsiyaShape>;

export function RegistratsiyaForm() {
  // Фабрика выполняется один раз: `useMemo` здесь неверен — React вправе сбросить кэш.
  const bundle = useFormBundle(() =>
    createForm<RegistratsiyaShape>({
      model: createFormModel(),
      schema: formSchema,
      registry,
      behavior: formBehavior,
      validation: formValidation,
    })
  );

  // Обёртка поля приходит из реестра (`FIELD_WRAPPER`).
  return (
    <ValidationMessagesProvider messages={formMessages}>
      <FormRenderer form={bundle} />
    </ValidationMessagesProvider>
  );
}
