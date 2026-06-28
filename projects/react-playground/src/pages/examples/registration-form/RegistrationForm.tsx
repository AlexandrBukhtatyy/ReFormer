/**
 * Форма регистрации с ReFormer — новая архитектура (M1).
 *
 * Демонстрирует:
 * - FormModel (данные) + единая Schema (component + componentProps + validators)
 * - createForm({ model, schema }) → FormProxy (ноды привязаны к сигналам модели)
 * - validateFormModel(model, schema) на submit (sync + async, контракт (value, model))
 * - рендер через существующий <FormField control={form.x} /> (нода = сигнал модели)
 */

import { useMemo, useState } from 'react';
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, email, minLength, pattern } from '@reformer/core/validators';
import { Input, InputPassword, InputMask, Checkbox, FormField } from '@reformer/ui-kit';
import { FormStateDisplay } from './FormSateDisplay';

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

// ── Валидаторы слоя данных (value, model) ───────────────────────────────────
const passwordStrength: ModelValidator<string> = (value) => {
  if (!value) return null;
  const ok = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  return ok ? null : { code: 'weak-password', message: 'Нужны заглавные, строчные буквы и цифры' };
};

const passwordsMatch: ModelValidator<string, RegistrationFormData> = (value, model) =>
  value && model.password && value !== model.password
    ? { code: 'passwords-mismatch', message: 'Пароли не совпадают' }
    : null;

const captchaCode: ModelValidator<string> = (value) =>
  value !== 'ABC123'
    ? { code: 'invalid-captcha', message: 'Неверная captcha. Попробуйте ABC123' }
    : null;

const termsAccepted: ModelValidator<boolean> = (value) =>
  value ? null : { code: 'terms-required', message: 'Необходимо принять условия' };

const usernameAvailable: ModelValidator<string> = async (value) => {
  if (!value || value.length < 3) return null;
  try {
    await new Promise((r) => setTimeout(r, 300));
    const res = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(value)}`);
    const json = await res.json();
    return json.available
      ? null
      : { code: 'username-taken', message: json.message || 'Имя занято' };
  } catch {
    return null; // сетевой сбой не блокирует валидацию
  }
};

const emailAvailable: ModelValidator<string> = async (value) => {
  if (!value || !value.includes('@')) return null;
  try {
    await new Promise((r) => setTimeout(r, 300));
    const res = await fetch(`/api/v1/auth/check-email?email=${encodeURIComponent(value)}`);
    const json = await res.json();
    return json.available ? null : { code: 'email-taken', message: json.message || 'Email занят' };
  } catch {
    return null;
  }
};

// ── Единая схема: данные из модели, конфиг поля и валидаторы — здесь ─────────
function buildSchema(model: ReturnType<typeof createModel<RegistrationFormData>>) {
  return {
    children: [
      {
        value: model.$.username,
        component: Input,
        componentProps: {
          label: 'Имя пользователя',
          placeholder: 'Логин (латиница)',
          testId: 'username',
        },
        validators: [
          required({ message: 'Имя пользователя обязательно' }),
          minLength(3, { message: 'Минимум 3 символа' }),
          pattern(/^[a-zA-Z0-9_]{3,20}$/, { message: 'Латиница, цифры, _ (3-20)' }),
          usernameAvailable,
        ],
      },
      {
        value: model.$.email,
        component: Input,
        componentProps: {
          label: 'Email',
          placeholder: 'your@email.com',
          type: 'email',
          testId: 'email',
        },
        validators: [
          required({ message: 'Email обязателен' }),
          email({ message: 'Некорректный email' }),
          emailAvailable,
        ],
      },
      {
        value: model.$.password,
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Минимум 8 символов', testId: 'password' },
        validators: [
          required({ message: 'Пароль обязателен' }),
          minLength(8, { message: 'Минимум 8 символов' }),
          passwordStrength,
        ],
      },
      {
        value: model.$.confirmPassword,
        component: InputPassword,
        componentProps: {
          label: 'Подтвердите пароль',
          placeholder: 'Повторите пароль',
          testId: 'confirmPassword',
        },
        validators: [required({ message: 'Подтвердите пароль' }), passwordsMatch],
      },
      {
        value: model.$.fullName,
        component: Input,
        componentProps: { label: 'Полное имя', placeholder: 'Иван Иванов', testId: 'fullName' },
        validators: [
          required({ message: 'Полное имя обязательно' }),
          minLength(2, { message: 'Минимум 2 символа' }),
        ],
      },
      {
        value: model.$.phone,
        component: InputMask,
        componentProps: {
          label: 'Телефон',
          placeholder: '+7 (999) 123-45-67',
          mask: '+7 (999) 999-99-99',
          testId: 'phone',
        },
        validators: [
          required({ message: 'Телефон обязателен' }),
          pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Формат +7 (999) 123-45-67' }),
        ],
      },
      {
        value: model.$.captcha,
        component: Input,
        componentProps: {
          label: 'Введите captcha',
          placeholder: 'Подсказка: ABC123',
          testId: 'captcha',
        },
        validators: [required({ message: 'Введите captcha' }), captchaCode],
      },
      {
        value: model.$.acceptTerms,
        component: Checkbox,
        componentProps: { label: 'Я принимаю условия использования', testId: 'acceptTerms' },
        validators: [termsAccepted],
      },
    ],
  };
}

export default function RegistrationForm() {
  const { model, form, schema } = useMemo(() => {
    const m = createModel<RegistrationFormData>({ ...INITIAL });
    const s = buildSchema(m);
    const f = createForm<RegistrationFormData>({ model: m, schema: s });
    return { model: m, form: f, schema: s };
  }, []);

  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    setPending(true);
    const res = await validateFormModel(model, schema);
    setPending(false);

    if (res.valid) {
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
    <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
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
              disabled={pending}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? 'Проверка...' : 'Зарегистрироваться'}
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
  );
}
