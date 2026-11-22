import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { formBehavior } from './form.behavior';
import { formSchema } from './form.schema';
import { formValidation } from './form.validation';
import { createFormModel, type FormaRegistratsiiShape } from './model';
import { Button, FormField } from '@reformer/ui-kit';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { formMessages } from './form.messages';
import { submitForm } from './api';

// Markup written by form_edit {"op":"markup"}.

export function FormaRegistratsiiForm() {
  // Фабрика выполняется один раз: `useMemo` здесь неверен — React вправе сбросить кэш.
  const bundle = useFormBundle(() =>
    createForm<FormaRegistratsiiShape>({
      model: createFormModel(),
      schema: formSchema,
      behavior: formBehavior,
      validation: formValidation,
    })
  );

  return (
    <ValidationMessagesProvider messages={formMessages}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void bundle.submission.submit(submitForm);
          }}
        >
            <FormField control={bundle.form.login} />
            <FormField control={bundle.form.email} />
            <FormField control={bundle.form.password} />
            <FormField control={bundle.form.confirmPassword} />
            <FormField control={bundle.form.captcha} />
            <Button type="submit">Зарегистрироваться</Button>
        </form>
    </ValidationMessagesProvider>
  );
}
