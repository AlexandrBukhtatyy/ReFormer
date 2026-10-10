/**
 * Форма регистрации с ReFormer — контракт `@reformer/core/validation`.
 *
 * Демонстрирует РАЗДЕЛЕНИЕ схемы формы и валидации:
 * - схема (`buildSchema`) — только поля: `{ model, component, componentProps }`, без правил.
 * - VALIDATION-схема (`registrationValidation`) — стабильный module-level `const`
 *   `defineValidation(({ model }) => …)` с операторами `validate` / `validateAsync` / `cross`.
 * - сборка `createForm({ initial, schema })` → бандл `{ model, form }` (ноды привязаны к модели).
 * - Стратегия валидации выбрана декларативно через `useFormValidation({ strategy: 'afterFirstSubmit' })`:
 *   тихо до первой отправки, затем живая проверка при вводе. `submit()` сам метит touched.
 * - Рендер через существующий <FormField control={form.x} /> (нода = сигнал модели).
 */

import { createForm, type FormModel, type ValidationIssue } from '@reformer/core';
import { useFormBundle, useFormValidation } from '@reformer/core/react';
import {
  validate,
  validateAsync,
  defineValidation,
  type Rule,
  type AsyncRule,
} from '@reformer/core/validation';
import { required, email, minLength, pattern } from '@reformer/core/validators';
import { Input, InputPassword, InputMask, CheckboxWithLabel, FormField } from '@reformer/ui-kit';
import { FormStateDisplay } from './FormSateDisplay';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { registrationMessages } from './messages';

export interface RegistrationFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  captcha: string;
  acceptTerms: boolean;
}

const INITIAL: RegistrationFormData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  phone: '',
  captcha: '',
  acceptTerms: false,
};

// ── Кастомные value-only правила (Rule<T> под validate) ──────────────────────
const passwordStrength: Rule<string> = (value) => {
  if (!value) return null;
  const ok = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  return ok ? null : { code: 'weak-password' };
};

const captchaCode: Rule<string> = (value) =>
  value !== 'ABC123' ? { code: 'invalid-captcha' } : null;

const termsAccepted: Rule<boolean> = (value) => (value ? null : { code: 'terms-required' });

// ── Cross-field правило (читает другое поле → через cross) ───────────────────
const passwordsMatch = (f: RegistrationFormData): ValidationIssue | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwords-mismatch' }
    : null;

// ── Async-правила (AsyncRule<T> под validateAsync) ───────────────────────────
const usernameAvailable: AsyncRule<string> = async (value) => {
  if (!value || value.length < 3) return null;
  try {
    await new Promise((r) => setTimeout(r, 300));
    const res = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(value)}`);
    const json = await res.json();
    return json.available
      ? null
      : { code: 'username-taken', params: { serverMessage: json.message } };
  } catch {
    return null; // сетевой сбой не блокирует валидацию
  }
};

const emailAvailable: AsyncRule<string> = async (value) => {
  if (!value || !value.includes('@')) return null;
  try {
    await new Promise((r) => setTimeout(r, 300));
    const res = await fetch(`/api/v1/auth/check-email?email=${encodeURIComponent(value)}`);
    const json = await res.json();
    return json.available ? null : { code: 'email-taken', params: { serverMessage: json.message } };
  } catch {
    return null;
  }
};

// ── Схема валидации (стабильный module-level const) ──────────────────────────
const registrationValidation = defineValidation<RegistrationFormData>(({ model, cross }) => {
  validate(model.$.username, [
    required({ code: 'username.required' }),
    minLength(3, { code: 'username.minLength' }),
    pattern(/^[a-zA-Z0-9_]{3,20}$/, { code: 'username.pattern' }),
  ]);
  validateAsync(model.$.username, [usernameAvailable]);

  validate(model.$.email, [required({ code: 'email.required' }), email({ code: 'email.email' })]);
  validateAsync(model.$.email, [emailAvailable]);

  validate(model.$.password, [
    required({ code: 'password.required' }),
    minLength(8, { code: 'password.minLength' }),
    passwordStrength,
  ]);

  validate(model.$.confirmPassword, [required({ code: 'confirmPassword.required' })]);
  cross(model.$.confirmPassword, passwordsMatch);

  validate(model.$.fullName, [
    required({ code: 'fullName.required' }),
    minLength(2, { code: 'fullName.minLength' }),
  ]);

  validate(model.$.phone, [
    required({ code: 'phone.required' }),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { code: 'phone.pattern' }),
  ]);

  validate(model.$.captcha, [required({ code: 'captcha.required' }), captchaCode]);

  validate(model.$.acceptTerms, [termsAccepted]);
});

// ── Схема формы: только поля (component + componentProps), без правил ────────
function buildSchema(model: FormModel<RegistrationFormData>) {
  return {
    children: [
      {
        model: model.$.username,
        component: Input,
        componentProps: {
          label: 'Имя пользователя',
          placeholder: 'Логин (латиница)',
          testId: 'username',
        },
      },
      {
        model: model.$.email,
        component: Input,
        componentProps: {
          label: 'Email',
          placeholder: 'your@email.com',
          type: 'email',
          testId: 'email',
        },
      },
      {
        model: model.$.password,
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Минимум 8 символов', testId: 'password' },
      },
      {
        model: model.$.confirmPassword,
        component: InputPassword,
        componentProps: {
          label: 'Подтвердите пароль',
          placeholder: 'Повторите пароль',
          testId: 'confirmPassword',
        },
      },
      {
        model: model.$.fullName,
        component: Input,
        componentProps: { label: 'Полное имя', placeholder: 'Иван Иванов', testId: 'fullName' },
      },
      {
        model: model.$.phone,
        component: InputMask,
        componentProps: {
          label: 'Телефон',
          placeholder: '+7 (999) 123-45-67',
          mask: '+7 (999) 999-99-99',
          testId: 'phone',
        },
      },
      {
        model: model.$.captcha,
        component: Input,
        componentProps: {
          label: 'Введите captcha',
          placeholder: 'Подсказка: ABC123',
          testId: 'captcha',
        },
      },
      {
        model: model.$.acceptTerms,
        component: CheckboxWithLabel,
        componentProps: { label: 'Я принимаю условия использования', testId: 'acceptTerms' },
      },
    ],
  };
}

export default function RegistrationForm() {
  // Сборка одним вызовом: модель из initial + форма по схеме. Правила валидации здесь НЕ в конфиге
  // намеренно — пример показывает второй путь, `useFormValidation`: он даёт реактивный
  // `isValidating` для кнопки. Смешивать оба нельзя: два контроллера на одну пару (model, schema)
  // отменяли бы прогоны друг друга.
  const { model, form } = useFormBundle(() =>
    createForm<RegistrationFormData>({ initial: { ...INITIAL }, schema: buildSchema })
  );

  // Единый выбор стратегии (§7): afterFirstSubmit — тихо до первой отправки, затем живая проверка
  // при вводе (debounce 400мс). submit() внутри метит touched (раскрывает ошибки), поэтому ручной
  // form.markAsTouched()/validateModel больше не нужны. isValidating заменяет прежний pending.
  const { submit, isValidating } = useFormValidation({
    model,
    schema: registrationValidation,
    strategy: 'afterFirstSubmit',
    debounce: 400,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submit();

    if (ok) {
      try {
        const response = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(model.get()),
        });
        const result = await response.json();
        if (result.success) {
          alert(`Регистрация успешна!\n\nUser ID: ${result.userId}\n\n${result.message}`);
          form.reset();
        } else {
          alert(`Ошибка: ${result.message}`);
        }
      } catch (error) {
        alert(`Ошибка сети: ${error}`);
      }
    }
  };

  return (
    <ValidationMessagesProvider messages={registrationMessages}>
      <div className="flex flex-col md:flex-row gap-6 mx-auto">
        <div className="flex-1 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Регистрация</h2>
          <p className="text-sm text-gray-600 mb-6">
            Заполните форму для создания нового аккаунта. Все поля обязательны.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.username} className="mb-4" />
              <FormField control={form.email} className="mb-4" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.password} className="mb-4" />
              <FormField control={form.confirmPassword} className="mb-4" />
            </div>
            <FormField control={form.fullName} className="mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.phone} className="mb-4" />
              <FormField control={form.captcha} className="mb-4" />
            </div>
            <FormField control={form.acceptTerms} className="mb-6" />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isValidating}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? 'Проверка...' : 'Зарегистрироваться'}
              </button>
              <button
                type="button"
                onClick={() => form.reset()}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Очистить
              </button>
            </div>
          </form>
        </div>

        <div className="flex-1 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Состояние формы</h2>
          <FormStateDisplay form={form} />
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <h3 className="font-semibold mb-2">💡 Подсказки для тестирования:</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>
                • Занятые username: <code>johndoe</code>, <code>janedoe</code>, <code>admin</code>
              </li>
              <li>
                • Занятые email: <code>john@example.com</code>, <code>admin@example.com</code>
              </li>
              <li>
                • Правильная captcha: <code>ABC123</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </ValidationMessagesProvider>
  );
}
