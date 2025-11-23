/**
 * Простой пример формы с ReFormer
 * Демонстрирует базовое использование GroupNode, FieldNode и валидации
 */

import { useMemo } from 'react';
import { GroupNode, type GroupNodeWithControls, type FormSchema, type FieldPath } from 'reformer';
import { required, email, minLength } from 'reformer/validators';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { FormStateDisplay } from './FormSateDisplay';

// Определение типа формы
interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

// Схема формы
const contactFormSchema: FormSchema<ContactFormData> = {
  name: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Имя',
      placeholder: 'Введите ваше имя',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      placeholder: 'email@example.com',
      type: 'email',
    },
  },
  message: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Сообщение',
      placeholder: 'Введите ваше сообщение...',
      rows: 4,
    },
  },
};

// Валидация формы - path это FieldPath<T>, не сам T
const contactFormValidation = (path: FieldPath<ContactFormData>) => {
  required(path.name, { message: 'Имя обязательно' });
  minLength(path.name, 2, { message: 'Минимум 2 символа' });

  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Некорректный email' });

  required(path.message, { message: 'Сообщение обязательно' });
  minLength(path.message, 10, { message: 'Минимум 10 символов' });
};

// Фабрика для создания формы
function createContactForm(): GroupNodeWithControls<ContactFormData> {
  return new GroupNode<ContactFormData>({
    form: contactFormSchema,
    validation: contactFormValidation,
  });
}

// Основной компонент формы
export default function SimpleForm() {
  const form = useMemo(() => createContactForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      alert(`Отправлено!\n${JSON.stringify(form.getValue(), null, 2)}`);
      form.reset();
    }
  };

  const handleReset = () => {
    form.reset();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-4xl mx-auto">
      {/* Форма */}
      <div className="flex-1 p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Контактная форма</h2>

        <form onSubmit={handleSubmit}>
          <FormField control={form.name} form={form} className="mb-4" />
          <FormField control={form.email} form={form} className="mb-4" />
          <FormField control={form.message} form={form} className="mb-4" />

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Отправить
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Сбросить
            </button>
          </div>
        </form>
      </div>

      {/* Состояние формы */}
      <div className="flex-1 p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Состояние формы</h2>
        <FormStateDisplay form={form.value.value} />
      </div>
    </div>
  );
}
