// @reformer-form-build e2c1f5e841fb674b собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { formBehavior } from './form.behavior';
import { formMessages } from './form.messages';
import { formSchema } from './form.schema';
import { formValidation } from './form.validation';
import { createFormModel, type OformlenieZakazaShape } from './model';

export function OformlenieZakazaForm() {
  // Фабрика выполняется один раз: `useMemo` здесь неверен — React вправе сбросить кэш.
  const bundle = useFormBundle(() =>
    createForm<OformlenieZakazaShape>({
      model: createFormModel(),
      schema: formSchema,
      behavior: formBehavior,
      validation: formValidation,
    })
  );

  return (
    <ValidationMessagesProvider messages={formMessages}>
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
    </ValidationMessagesProvider>
  );
}
