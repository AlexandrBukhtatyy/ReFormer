import { useState } from 'react';
import {
  createForm,
  type FormModel,
  type FormSchemaNode,
  type ValidationIssue,
} from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { Button, FormField, Input } from '@reformer/ui-kit';

type Signup = { email: string; password: string; confirm: string };

const signupSchema = (model: FormModel<Signup>): FormSchemaNode => ({
  children: [
    { model: model.$.email, component: Input, componentProps: { label: 'Email', type: 'email' } },
    {
      model: model.$.password,
      component: Input,
      componentProps: { label: 'Пароль', type: 'password' },
    },
    {
      model: model.$.confirm,
      component: Input,
      componentProps: { label: 'Повторите пароль', type: 'password' },
    },
  ],
});

// Правило над двумя полями получает снимок всей формы.
const passwordsMatch = (values: Signup): ValidationIssue | null =>
  values.confirm !== '' && values.confirm !== values.password ? { code: 'confirm.mismatch' } : null;

const signupValidation = defineValidation<Signup>(({ model, cross }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirm, [required()]);
  // Замечание ляжет на confirm — у этого поля его и покажут.
  cross(model.$.confirm, passwordsMatch);
});

// Текст своего кода. Встроенные коды (required, email, minLength) переводит локаль.
const signupMessages = defineIssueMessages({
  'confirm.mismatch': 'Пароли не совпадают',
});

export default function SignupFormExample() {
  const signup = useFormBundle(() =>
    createForm<Signup>({
      initial: { email: '', password: '', confirm: '' },
      schema: signupSchema,
      // Перепроверять на каждый ввод: правка пароля сразу перепроверит и повтор.
      validation: { rules: signupValidation, strategy: 'change' },
    })
  );
  const { form } = signup;
  const [verdict, setVerdict] = useState<string | null>(null);

  const handleCheck = async () => {
    // Проверка всей формы: замечания показываются и у полей, которых ещё не касались.
    const result = await signup.validate();
    setVerdict(result.status === 'valid' ? 'Ошибок нет' : 'Есть замечания — они у полей');
  };

  return (
    <ValidationMessagesProvider messages={signupMessages}>
      <div className="flex max-w-md flex-col gap-4">
        <FormField control={form.email} />
        <FormField control={form.password} />
        <FormField control={form.confirm} />
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => void handleCheck()}>
            Проверить
          </Button>
          {verdict && <span className="text-sm">{verdict}</span>}
        </div>
      </div>
    </ValidationMessagesProvider>
  );
}
