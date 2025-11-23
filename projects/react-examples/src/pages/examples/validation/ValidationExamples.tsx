/**
 * Примеры валидации с ReFormer
 * Демонстрирует встроенные валидаторы
 */

import { useMemo } from 'react';
import { GroupNode, useFormControl, type GroupNodeWithControls, type FormSchema, type FieldNode, type FieldPath } from 'reformer';
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
  number,
  date,
  custom,
} from 'reformer/validators';
import { Input } from '@/components/ui/input';
import { ExampleCard } from '@/components/ui/example-card';

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
  required(path.requiredField, { message: 'Это поле обязательно' });

  // Email
  required(path.emailField, { message: 'Email обязателен' });
  email(path.emailField, { message: 'Введите корректный email' });

  // MinLength
  required(path.minLengthField, { message: 'Поле обязательно' });
  minLength(path.minLengthField, 5, { message: 'Минимум 5 символов' });

  // MaxLength
  maxLength(path.maxLengthField, 10, { message: 'Максимум 10 символов' });

  // Min
  required(path.minField, { message: 'Введите число' });
  min(path.minField, 10, { message: 'Минимум 10' });

  // Max
  required(path.maxField, { message: 'Введите число' });
  max(path.maxField, 100, { message: 'Максимум 100' });

  // Pattern
  required(path.patternField, { message: 'Поле обязательно' });
  pattern(path.patternField, /^[a-zA-Zа-яА-Я]+$/, { message: 'Только буквы' });

  // URL
  required(path.urlField, { message: 'URL обязателен' });
  url(path.urlField, { message: 'Введите корректный URL' });

  // Phone
  required(path.phoneField, { message: 'Телефон обязателен' });
  phone(path.phoneField, { format: 'ru', message: 'Введите российский номер телефона' });

  // Number (с расширенными опциями)
  required(path.numberField, { message: 'Число обязательно' });
  number(path.numberField, { integer: true, min: 1, max: 100, message: 'Целое число от 1 до 100' });

  // Date
  required(path.dateField, { message: 'Дата обязательна' });
  date(path.dateField, { noFuture: true, message: 'Дата не может быть в будущем' });

  // Custom
  required(path.customField, { message: 'Пароль обязателен' });
  custom(path.customField, (value: string) => {
    if (!value || value.length < 8) return 'Минимум 8 символов';
    if (!/[0-9]/.test(value)) return 'Должна быть хотя бы одна цифра';
    if (!/[a-zA-Z]/.test(value)) return 'Должна быть хотя бы одна буква';
    return null;
  });
};

function createValidationForm(): GroupNodeWithControls<ValidationDemoForm> {
  return new GroupNode<ValidationDemoForm>({
    form: validationFormSchema,
    validation: validationFormValidation,
  });
}

// Компонент поля с отображением ошибок
function ValidatedField({
  control,
  type = 'text',
}: {
  control: FieldNode<string | number | null>;
  type?: string;
}) {
  const { value, touched, invalid, valid, errors, disabled } = useFormControl(control);
  const showError = touched.value && invalid.value;

  return (
    <div>
      <input
        type={type}
        value={value.value ?? ''}
        onChange={(e) => {
          const newValue = type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value;
          control.setValue(newValue as string);
        }}
        onBlur={() => control.markAsTouched()}
        disabled={disabled.value}
        className={`w-full p-2 border rounded ${
          showError ? 'border-red-500 bg-red-50' : 'border-gray-300'
        }`}
        placeholder="Введите значение..."
      />
      {showError && errors.value.length > 0 && (
        <p className="text-red-500 text-sm mt-1">
          {errors.value[0]?.message || 'Ошибка валидации'}
        </p>
      )}
      {touched.value && valid.value && (
        <p className="text-green-500 text-sm mt-1">Валидно</p>
      )}
    </div>
  );
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
      <p className="text-gray-600 mb-6">
        Демонстрация встроенных валидаторов ReFormer
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ExampleCard
          title="Required"
          description="Обязательное поле"
          bgColor="bg-white"
          code={`required(path.requiredField, {
  message: 'Это поле обязательно'
})`}
        >
          <ValidatedField control={form.requiredField} type="text" />
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
          <ValidatedField control={form.emailField} type="email" />
        </ExampleCard>

        <ExampleCard
          title="MinLength"
          description="Минимум 5 символов"
          bgColor="bg-white"
          code={`minLength(path.minLengthField, 5, {
  message: 'Минимум 5 символов'
})`}
        >
          <ValidatedField control={form.minLengthField} type="text" />
        </ExampleCard>

        <ExampleCard
          title="MaxLength"
          description="Максимум 10 символов"
          bgColor="bg-white"
          code={`maxLength(path.maxLengthField, 10, {
  message: 'Максимум 10 символов'
})`}
        >
          <ValidatedField control={form.maxLengthField} type="text" />
        </ExampleCard>

        <ExampleCard
          title="Min"
          description="Минимальное значение 10"
          bgColor="bg-white"
          code={`min(path.minField, 10, {
  message: 'Минимум 10'
})`}
        >
          <ValidatedField control={form.minField} type="number" />
        </ExampleCard>

        <ExampleCard
          title="Max"
          description="Максимальное значение 100"
          bgColor="bg-white"
          code={`max(path.maxField, 100, {
  message: 'Максимум 100'
})`}
        >
          <ValidatedField control={form.maxField} type="number" />
        </ExampleCard>

        <ExampleCard
          title="Pattern"
          description="Только буквы (regex)"
          bgColor="bg-white"
          code={`pattern(path.patternField, /^[a-zA-Zа-яА-Я]+$/, {
  message: 'Только буквы'
})`}
        >
          <ValidatedField control={form.patternField} type="text" />
        </ExampleCard>

        <ExampleCard
          title="URL"
          description="Валидация URL адреса"
          bgColor="bg-white"
          code={`url(path.urlField, {
  message: 'Введите корректный URL'
})`}
        >
          <ValidatedField control={form.urlField} type="text" />
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
          <ValidatedField control={form.phoneField} type="tel" />
        </ExampleCard>

        <ExampleCard
          title="Number"
          description="Целое число от 1 до 100"
          bgColor="bg-white"
          code={`number(path.numberField, {
  integer: true,
  min: 1,
  max: 100
})`}
        >
          <ValidatedField control={form.numberField} type="number" />
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
          <ValidatedField control={form.dateField} type="date" />
        </ExampleCard>

        <ExampleCard
          title="Custom"
          description="Кастомная валидация пароля"
          bgColor="bg-white"
          code={`custom(path.customField, (value) => {
  if (!value || value.length < 8)
    return 'Минимум 8 символов';
  if (!/[0-9]/.test(value))
    return 'Должна быть хотя бы одна цифра';
  if (!/[a-zA-Z]/.test(value))
    return 'Должна быть хотя бы одна буква';
  return null;
})`}
        >
          <ValidatedField control={form.customField} type="password" />
        </ExampleCard>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={handleValidateAll}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Проверить все
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Сбросить
        </button>
      </div>
    </div>
  );
}
