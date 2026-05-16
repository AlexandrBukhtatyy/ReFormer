/**
 * Примеры валидации с ReFormer
 * Демонстрирует встроенные валидаторы
 */

import { useMemo } from 'react';
import { GroupNode, type FormProxy, type FormSchema, type FieldPath } from '@reformer/core';
import {
  required,
  email,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  url,
  phone,
  integer,
  pastDate,
  validate,
} from '@reformer/core/validators';
import { Input } from '@/components/ui/input';
import { ExampleCard } from '@/components/ui/example-card';
import { FormField } from '@/components/ui/form-field';

// Тип формы для демонстрации валидаторов
interface ValidationDemoForm {
  requiredField: string;
  emailField: string;
  minLengthField: string;
  maxLengthField: string;
  minField: number;
  maxField: number;
  patternField: string;
  urlField: string;
  phoneField: string;
  numberField: number;
  dateField: string;
  customField: string;
}

// Схема формы
const validationFormSchema: FormSchema<ValidationDemoForm> = {
  requiredField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Обязательное поле' },
  },
  emailField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'email@example.com', type: 'email' },
  },
  minLengthField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Минимум 5 символов' },
  },
  maxLengthField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Максимум 10 символов' },
  },
  minField: {
    value: 0,
    component: Input,
    componentProps: { placeholder: 'Минимум 10', type: 'number' },
  },
  maxField: {
    value: 0,
    component: Input,
    componentProps: { placeholder: 'Максимум 100', type: 'number' },
  },
  patternField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Только буквы' },
  },
  urlField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'https://example.com' },
  },
  phoneField: {
    value: '',
    component: Input,
    componentProps: { placeholder: '+7 900 123-45-67', type: 'tel' },
  },
  numberField: {
    value: 0,
    component: Input,
    componentProps: { placeholder: 'Целое число', type: 'number' },
  },
  dateField: {
    value: '',
    component: Input,
    componentProps: { type: 'date' },
  },
  customField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Пароль (мин. 8 символов, цифра, буква)' },
  },
};

// Валидация формы - path это FieldPath<T>
const validationFormValidation = (path: FieldPath<ValidationDemoForm>) => {
  // Required
  validate(path.requiredField, required({ message: 'Это поле обязательно' }));

  // Email
  validate(path.emailField, required({ message: 'Email обязателен' }));
  validate(path.emailField, email({ message: 'Введите корректный email' }));

  // MinLength
  validate(path.minLengthField, required({ message: 'Поле обязательно' }));
  validate(path.minLengthField, minLength(5, { message: 'Минимум 5 символов' }));

  // MaxLength
  validate(path.maxLengthField, maxLength(10, { message: 'Максимум 10 символов' }));

  // Min
  validate(path.minField, required({ message: 'Введите число' }));
  validate(path.minField, min(10, { message: 'Минимум 10' }));

  // Max
  validate(path.maxField, required({ message: 'Введите число' }));
  validate(path.maxField, max(100, { message: 'Максимум 100' }));

  // Pattern
  validate(path.patternField, required({ message: 'Поле обязательно' }));
  validate(path.patternField, pattern(/^[a-zA-Zа-яА-Я]+$/, { message: 'Только буквы' }));

  // URL
  validate(path.urlField, required({ message: 'URL обязателен' }));
  validate(path.urlField, url({ message: 'Введите корректный URL' }));

  // Phone
  validate(path.phoneField, required({ message: 'Телефон обязателен' }));
  validate(path.phoneField, phone({ format: 'ru', message: 'Введите российский номер телефона' }));

  // Number (композиция атомарных валидаторов)
  validate(path.numberField, required({ message: 'Число обязательно' }));
  validate(path.numberField, integer({ message: 'Должно быть целым числом' }));
  validate(path.numberField, min(1, { message: 'Не менее 1' }));
  validate(path.numberField, max(100, { message: 'Не более 100' }));

  // Date
  validate(path.dateField, required({ message: 'Дата обязательна' }));
  validate(path.dateField, pastDate({ message: 'Дата не может быть в будущем' }));

  // Validate
  validate(path.customField, required({ message: 'Пароль обязателен' }));
  validate(path.customField, (value) => {
    const v = value as string;
    if (!v || v.length < 8) {
      return { code: 'too-short', message: 'Минимум 8 символов' };
    }
    if (!/[0-9]/.test(v)) {
      return { code: 'no-digit', message: 'Должна быть хотя бы одна цифра' };
    }
    if (!/[a-zA-Z]/.test(v)) {
      return { code: 'no-letter', message: 'Должна быть хотя бы одна буква' };
    }
    return null;
  });
};

function createValidationForm(): FormProxy<ValidationDemoForm> {
  return new GroupNode<ValidationDemoForm>({
    form: validationFormSchema,
    validation: validationFormValidation,
  });
}

export default function ValidationExamples() {
  const form = useMemo(() => createValidationForm(), []);

  const handleValidateAll = async () => {
    form.markAsTouched();
    await form.validate();
  };

  const handleReset = () => {
    form.reset();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">Примеры валидации</h2>
      <p className="text-gray-600 mb-6">Демонстрация встроенных валидаторов ReFormer</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ExampleCard
          title="Required"
          description="Обязательное поле"
          bgColor="bg-white"
          code={`required(path.requiredField, {
  message: 'Это поле обязательно'
})`}
        >
          <FormField control={form.requiredField} />
        </ExampleCard>

        <ExampleCard
          title="Email"
          description="Валидация email адреса"
          bgColor="bg-white"
          code={`required(path.emailField, { message: 'Email обязателен' });
email(path.emailField, {
  message: 'Введите корректный email'
})`}
        >
          <FormField control={form.emailField} />
        </ExampleCard>

        <ExampleCard
          title="MinLength"
          description="Минимум 5 символов"
          bgColor="bg-white"
          code={`minLength(path.minLengthField, 5, {
  message: 'Минимум 5 символов'
})`}
        >
          <FormField control={form.minLengthField} />
        </ExampleCard>

        <ExampleCard
          title="MaxLength"
          description="Максимум 10 символов"
          bgColor="bg-white"
          code={`maxLength(path.maxLengthField, 10, {
  message: 'Максимум 10 символов'
})`}
        >
          <FormField control={form.maxLengthField} />
        </ExampleCard>

        <ExampleCard
          title="Min"
          description="Минимальное значение 10"
          bgColor="bg-white"
          code={`min(path.minField, 10, {
  message: 'Минимум 10'
})`}
        >
          <FormField control={form.minField} />
        </ExampleCard>

        <ExampleCard
          title="Max"
          description="Максимальное значение 100"
          bgColor="bg-white"
          code={`max(path.maxField, 100, {
  message: 'Максимум 100'
})`}
        >
          <FormField control={form.maxField} />
        </ExampleCard>

        <ExampleCard
          title="Pattern"
          description="Только буквы (regex)"
          bgColor="bg-white"
          code={`pattern(path.patternField, /^[a-zA-Zа-яА-Я]+$/, {
  message: 'Только буквы'
})`}
        >
          <FormField control={form.patternField} />
        </ExampleCard>

        <ExampleCard
          title="URL"
          description="Валидация URL адреса"
          bgColor="bg-white"
          code={`url(path.urlField, {
  message: 'Введите корректный URL'
})`}
        >
          <FormField control={form.urlField} />
        </ExampleCard>

        <ExampleCard
          title="Phone"
          description="Номер телефона (формат РФ)"
          bgColor="bg-white"
          code={`phone(path.phoneField, {
  format: 'ru',
  message: 'Введите российский номер'
})`}
        >
          <FormField control={form.phoneField} />
        </ExampleCard>

        <ExampleCard
          title="Number"
          description="Целое число от 1 до 100"
          bgColor="bg-white"
          code={`validate(path.numberField, integer());
validate(path.numberField, min(1));
validate(path.numberField, max(100));`}
        >
          <FormField control={form.numberField} />
        </ExampleCard>

        <ExampleCard
          title="Date"
          description="Дата (не в будущем)"
          bgColor="bg-white"
          code={`date(path.dateField, {
  noFuture: true,
  message: 'Дата не может быть в будущем'
})`}
        >
          <FormField control={form.dateField} />
        </ExampleCard>

        <ExampleCard
          title="Validate"
          description="Кастомная валидация пароля через validate"
          bgColor="bg-white"
          code={`validate(path.customField, (value) => {
  if (!value || value.length < 8)
    return { code: 'too-short', message: 'Минимум 8 символов' };
  if (!/[0-9]/.test(value))
    return { code: 'no-digit', message: 'Должна быть хотя бы одна цифра' };
  if (!/[a-zA-Z]/.test(value))
    return { code: 'no-letter', message: 'Должна быть хотя бы одна буква' };
  return null;
})`}
        >
          <FormField control={form.customField} />
        </ExampleCard>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={handleValidateAll}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Проверить все
        </button>
        <button onClick={handleReset} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
          Сбросить
        </button>
      </div>
    </div>
  );
}
