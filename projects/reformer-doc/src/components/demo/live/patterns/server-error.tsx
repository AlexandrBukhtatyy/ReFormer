import { useState, type FormEvent } from 'react';
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { Button, FormField, Input } from '@reformer/ui-kit';

type Signup = { username: string; email: string };

// Ответ сервера: error — код ошибки поля, null — регистрация прошла.
type ServerReply = { error: string | null };

const signupSchema = (model: FormModel<Signup>): FormSchemaNode => ({
  children: [
    { model: model.$.username, component: Input, componentProps: { label: 'Логин' } },
    { model: model.$.email, component: Input, componentProps: { label: 'Email', type: 'email' } },
  ],
});

const signupRules = defineValidation<Signup>(({ model }) => {
  validate(model.$.username, [required(), minLength(3)]);
  validate(model.$.email, [required(), email()]);
});

// Код ошибки сервера получает текст так же, как код правила.
const signupMessages = defineIssueMessages({
  'username.taken': 'Логин «{username}» уже занят',
});

// Вместо запроса к серверу — задержка. Логин admin «занят».
const register = (values: Signup) =>
  new Promise<ServerReply>((resolve) =>
    setTimeout(
      () =>
        resolve(
          values.username.toLowerCase() === 'admin' ? { error: 'username.taken' } : { error: null }
        ),
      600
    )
  );

export default function ServerErrorExample() {
  const signup = useFormBundle(() =>
    createForm<Signup>({
      initial: { username: '', email: '' },
      schema: signupSchema,
      // После первой отправки поля перепроверяются на ввод — правка снимет и ошибку сервера.
      validation: { rules: signupRules, strategy: 'afterFirstSubmit' },
    })
  );
  const { form } = signup;
  const [report, setReport] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setReport(null);
    const outcome = await signup.submission.submit(async (values) => {
      const reply = await register(values);
      // Ошибка сервера — замечание на поле. Значения не трогаем: пользователь их поправит.
      if (reply.error) {
        form.username.setIssues([{ code: reply.error, params: { username: values.username } }]);
      }
      return reply;
    });

    if (outcome.status === 'submitted' && !outcome.result.error) {
      setReport('submitted: регистрация прошла, форма очищена');
      form.reset();
    } else if (outcome.status === 'submitted') {
      setReport('submitted: сервер вернул ошибку поля');
    } else if (outcome.status === 'failed') {
      setReport('failed: сервер недоступен');
    } else {
      setReport(`${outcome.status}: обработчик не вызывался`);
    }
  };

  return (
    <ValidationMessagesProvider messages={signupMessages}>
      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <FormField control={form.username} />
        <FormField control={form.email} />
        <Button type="submit" className="self-start">
          Зарегистрироваться
        </Button>
        {report && <p className="text-sm">Итог: {report}</p>}
      </form>
    </ValidationMessagesProvider>
  );
}
