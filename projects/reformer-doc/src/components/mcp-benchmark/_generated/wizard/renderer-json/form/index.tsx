// @reformer-form-build 9c19ffbb171c08ca собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormRenderer } from '@reformer/renderer-react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { formBehavior } from './form.behavior';
import { formMessages } from './form.messages';
import schemaDocument from './form.schema.json';
import { formFlow } from './form.flow';
import { formValidation } from './form.validation';
import { createFormModel, type OformlenieZakazaShape } from './model';
import { createRegistry } from './registry';

const registry = createRegistry();
const formSchema = schemaDocument as unknown as JsonFormSchema<OformlenieZakazaShape>;

export function OformlenieZakazaForm() {
  // Фабрика выполняется один раз: `useMemo` здесь неверен — React вправе сбросить кэш.
  const bundle = useFormBundle(() =>
    createForm<OformlenieZakazaShape>({
      model: createFormModel(),
      schema: formSchema,
      registry,
      behavior: formBehavior,
      validation: formValidation,
      flow: formFlow,
    })
  );

  // Обёртка поля приходит из реестра (`FIELD_WRAPPER`).
  return (
    <ValidationMessagesProvider messages={formMessages}>
      <FormRenderer form={bundle} />
    </ValidationMessagesProvider>
  );
}
