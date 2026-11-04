// @reformer-form-build a40d3ff31c69a5a4 собран из form.intent.json; правка руками отсоединит файл от сборки
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { formBehavior } from './form.behavior';
import { formMessages } from './form.messages';
import { formSchema } from './form.schema';
import { formFlow } from './form.flow';
import { formValidation } from './form.validation';
import { createFormModel, type CreditApplication } from './model';

export function ZayavkaNaKreditForm() {
  // Фабрика выполняется один раз: `useMemo` здесь неверен — React вправе сбросить кэш.
  const bundle = useFormBundle(() =>
    createForm<CreditApplication>({
      model: createFormModel(),
      schema: formSchema,
      behavior: formBehavior,
      validation: formValidation,
      flow: formFlow,
    })
  );

  return (
    <ValidationMessagesProvider messages={formMessages}>
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
    </ValidationMessagesProvider>
  );
}
