import { useState, type FormEvent } from 'react';
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { createLocaleLoader, msg } from '@reformer/core/i18n';
import { I18nProvider, useFormBundle, useI18n } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';
import { loadKitLocale } from '@reformer/ui-kit/locale';

type Signup = { name: string; email: string; password: string };
type Lang = 'ru' | 'en';

// Тексты приложения по языкам. В приложении их обычно отдаёт сервер: fetchMessages(...).
const APP_MESSAGES: Record<Lang, Record<string, string>> = {
  ru: {
    'signup.name': 'Имя',
    'signup.email': 'Почта',
    'signup.password': 'Придумайте пароль',
    'signup.submit': 'Создать аккаунт',
    'signup.done': 'Аккаунт для {name} создан',
  },
  en: {
    'signup.name': 'Name',
    'signup.email': 'Email',
    'signup.password': 'Create a password',
    'signup.submit': 'Create account',
    'signup.done': 'Account for {name} is ready',
  },
};

// Загрузчик — константа модуля: один кэш языков. Словари кита уже включают ядро (тексты
// замечаний) и cdk; ключи приложения — вторым источником, он перекрывает первый.
const loadLocale = createLocaleLoader([
  loadKitLocale,
  (code) => APP_MESSAGES[code as Lang] ?? null,
]);

// Подпись — описатель `msg(ключ)`: строку по активному языку подставит поле, и при смене языка
// подписи меняются сами.
const signupSchema = (model: FormModel<Signup>): FormSchemaNode => ({
  children: [
    { model: model.$.name, component: Input, componentProps: { label: msg('signup.name') } },
    {
      model: model.$.email,
      component: Input,
      componentProps: { type: 'email', label: msg('signup.email') },
    },
    // Плейсхолдер «Пароль» / «Password» — строка кита, её переводит словарь кита.
    {
      model: model.$.password,
      component: InputPassword,
      componentProps: { label: msg('signup.password') },
    },
  ],
});

// Правила несут только коды замечаний; текст по коду даёт словарь активного языка.
const signupValidation = defineValidation<Signup>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

const createSignup = () =>
  createForm<Signup>({
    initial: { name: '', email: '', password: '' },
    schema: signupSchema,
    validation: signupValidation,
  });

// Вместо запроса к серверу — задержка: пример работает прямо в браузере.
const createAccount = (values: Signup) =>
  new Promise<string>((resolve) => setTimeout(() => resolve(values.name), 600));

function SignupForm() {
  const { t } = useI18n();
  const signup = useFormBundle(createSignup);
  const { form } = signup;
  const [createdFor, setCreatedFor] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setCreatedFor(null);
    const outcome = await signup.submission.submit(createAccount);
    if (outcome.status === 'submitted') {
      setCreatedFor(outcome.result);
      form.reset();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField control={form.name} />
      <FormField control={form.email} />
      <FormField control={form.password} />
      <Button type="submit" className="self-start">
        {t('signup.submit')}
      </Button>
      {createdFor && <p className="text-sm">{t('signup.done', { name: createdFor })}</p>}
    </form>
  );
}

export default function LanguageSwitchExample() {
  const [lang, setLang] = useState<Lang>('ru');

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex gap-2">
        {(['ru', 'en'] as const).map((code) => (
          <Button
            key={code}
            type="button"
            size="sm"
            variant={code === lang ? 'default' : 'outline'}
            aria-pressed={code === lang}
            onClick={() => setLang(code)}
          >
            {code.toUpperCase()}
          </Button>
        ))}
      </div>
      {/* Свой провайдер: язык формы задаёт переключатель. Форма при смене языка не пересоздаётся. */}
      <I18nProvider lang={lang} load={loadLocale}>
        <SignupForm />
      </I18nProvider>
    </div>
  );
}
