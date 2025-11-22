/**
 * Простой пример формы с ReFormer
 * Демонстрирует базовое использование GroupNode, FieldNode и валидации
 */

import { useMemo } from 'react';
import { GroupNode, useFormControl, type GroupNodeWithControls, type FormSchema, type FieldNode, type FieldPath } from 'reformer';
import { required, email, minLength } from 'reformer/validators';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

// Компонент поля ввода
function FormField({
  control,
  label,
  type = 'text',
  multiline = false,
}: {
  control: FieldNode<string>;
  label: string;
  type?: string;
  multiline?: boolean;
}) {
  const { value, touched, invalid, errors, disabled } = useFormControl(control);
  const showError = touched.value && invalid.value;

  const inputProps = {
    value: value.value ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      control.setValue(e.target.value),
    onBlur: () => control.markAsTouched(),
    disabled: disabled.value,
    className: `w-full p-2 border rounded ${showError ? 'border-red-500' : 'border-gray-300'}`,
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">{label}</label>
      {multiline ? (
        <textarea {...inputProps} rows={4} />
      ) : (
        <input type={type} {...inputProps} />
      )}
      {showError && errors.value.length > 0 && (
        <p className="text-red-500 text-sm mt-1">
          {errors.value[0]?.message || 'Ошибка валидации'}
        </p>
      )}
    </div>
  );
}

// Основной компонент формы
export default function SimpleForm() {
  const form = useMemo(() => createContactForm(), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.valid.value) {
      alert(`Отправлено!\n${JSON.stringify(form.getValue(), null, 2)}`);
      form.reset();
    }
  };

  const handleReset = () => {
    form.reset();
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Контактная форма</h2>
      <p className="text-gray-600 mb-4">
        Простой пример формы с валидацией
      </p>

      <form onSubmit={handleSubmit}>
        <FormField control={form.name} label="Имя" />
        <FormField control={form.email} label="Email" type="email" />
        <FormField control={form.message} label="Сообщение" multiline />

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

      {/* Debug info */}
      <div className="mt-6 p-4 bg-gray-100 rounded text-sm">
        <h3 className="font-bold mb-2">Состояние формы:</h3>
        <pre className="overflow-auto">
          {JSON.stringify(
            {
              value: form.getValue(),
              valid: form.valid.value,
              touched: form.touched.value,
              dirty: form.dirty.value,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}
