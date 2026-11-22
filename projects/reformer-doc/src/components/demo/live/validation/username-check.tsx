import { useState, type FormEvent } from 'react';
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import { useFormBundle } from '@reformer/core/react';
import {
  defineValidation,
  validate,
  validateAsync,
  type AsyncRule,
} from '@reformer/core/validation';
import { minLength, required } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { Button, FormField, Input } from '@reformer/ui-kit';

type Signup = { username: string };

const TAKEN = ['admin', 'root', 'reformer'];

// Вместо запроса к серверу — задержка. Отмена устаревшего прогона обрывает и «запрос».
const askServer = (username: string, signal: AbortSignal) =>
  new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => resolve(!TAKEN.includes(username.toLowerCase())), 800);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

const usernameFree: AsyncRule<string> = async (value, { signal }) => {
  // Короткое имя отсеет синхронное правило — сервер не спрашиваем.
  if (value.length < 3) return null;
  const free = await askServer(value, signal);
  return free ? null : { code: 'username.taken', params: { username: value } };
};

const signupSchema = (model: FormModel<Signup>): FormSchemaNode => ({
  children: [{ model: model.$.username, component: Input, componentProps: { label: 'Логин' } }],
});

const signupValidation = defineValidation<Signup>(({ model }) => {
  validate(model.$.username, [required(), minLength(3)]);
  validateAsync(model.$.username, [usernameFree]);
});

const signupMessages = defineIssueMessages({
  'username.taken': 'Логин «{username}» уже занят',
});

const register = (values: Signup) =>
  new Promise<Signup>((resolve) => setTimeout(() => resolve(values), 400));

export default function UsernameCheckExample() {
  const signup = useFormBundle(() =>
    createForm<Signup>({
      initial: { username: '' },
      schema: signupSchema,
      // Живая проверка с паузой: запрос уходит, когда пользователь перестал печатать.
      validation: { rules: signupValidation, strategy: 'change', debounce: 500 },
    })
  );
  const { form } = signup;
  const [registered, setRegistered] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setRegistered(null);
    // Отправка дожидается и асинхронных правил.
    const outcome = await signup.submission.submit(register);
    if (outcome.status === 'submitted') setRegistered(outcome.result.username);
  };

  return (
    <ValidationMessagesProvider messages={signupMessages}>
      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <FormField control={form.username} />
        <Button type="submit" className="self-start">
          Зарегистрироваться
        </Button>
        {registered && <p className="text-sm">Логин «{registered}» свободен — готово.</p>}
      </form>
    </ValidationMessagesProvider>
  );
}
