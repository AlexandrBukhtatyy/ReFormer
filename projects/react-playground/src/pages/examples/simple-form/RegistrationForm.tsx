/**
 * Форма регистрации с ReFormer
 * Демонстрирует:
 * - Асинхронную валидацию (username, email)
 * - Behaviors (confirmPassword проверяет совпадение с password)
 * - Индикатор сложности пароля
 * - Маску для телефона
 * - Captcha валидацию
 */

import { useMemo } from 'react';
import { createForm, type FormProxy, type FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { InputPassword } from '@/components/ui/input-password';
import { InputMask } from '@/components/ui/input-mask';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { FormStateDisplay } from './FormSateDisplay';
import { registrationValidation } from './validation/registration-validation';
import { registrationBehavior } from './behaviors/registration-behavior';

// Определение типа формы регистрации
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

// Схема формы регистрации
const registrationFormSchema: FormSchema<RegistrationFormData> = {
  username: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Имя пользователя',
      placeholder: 'Введите логин (только латиница)',
      testId: 'username',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      placeholder: 'your@email.com',
      type: 'email',
      testId: 'email',
    },
  },
  password: {
    value: '',
    component: InputPassword,
    componentProps: {
      label: 'Пароль',
      placeholder: 'Минимум 8 символов',
      testId: 'password',
    },
  },
  confirmPassword: {
    value: '',
    component: InputPassword,
    componentProps: {
      label: 'Подтвердите пароль',
      placeholder: 'Повторите пароль',
      testId: 'confirmPassword',
    },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Полное имя',
      placeholder: 'Иван Иванов',
      testId: 'fullName',
    },
  },
  phone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон',
      placeholder: '+7 (999) 123-45-67',
      mask: '+7 (999) 999-99-99',
      testId: 'phone',
    },
  },
  captcha: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Введите captcha',
      placeholder: 'Подсказка: ABC123',
      testId: 'captcha',
    },
  },
  acceptTerms: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Я принимаю условия использования',
      testId: 'acceptTerms',
    },
  },
};

// Фабрика для создания формы
function createRegistrationForm(): FormProxy<RegistrationFormData> {
  const form = createForm<RegistrationFormData>({
    form: registrationFormSchema,
    validation: registrationValidation,
    behavior: registrationBehavior,
  });

  return form;
}

// Основной компонент формы регистрации
export default function RegistrationForm() {
  const form = useMemo(() => createRegistrationForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      const formData = form.getValue();

      // Отправка данных на сервер (API мок)
      try {
        const response = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
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

  const handleReset = () => {
    form.reset();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
      {/* Форма */}
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
              disabled={form.invalid.value || form.pending.value}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.pending.value ? 'Проверка...' : 'Зарегистрироваться'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Очистить
            </button>
          </div>
        </form>
      </div>

      {/* Состояние формы */}
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
              • Занятые email: <code>john@example.com</code>, <code>jane@example.com</code>,{' '}
              <code>admin@example.com</code>
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
