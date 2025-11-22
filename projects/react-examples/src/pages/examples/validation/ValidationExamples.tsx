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
} from 'reformer/validators';
import { Input } from '@/components/ui/input';

// Тип формы для демонстрации валидаторов
interface ValidationDemoForm {
  requiredField: string;
  emailField: string;
  minLengthField: string;
  maxLengthField: string;
  minField: number;
  maxField: number;
  patternField: string;
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
  label,
  description,
  type = 'text',
}: {
  control: FieldNode<string | number | null>;
  label: string;
  description: string;
  type?: string;
}) {
  const { value, touched, invalid, valid, errors, disabled } = useFormControl(control);
  const showError = touched.value && invalid.value;

  return (
    <div className="mb-6 p-4 border rounded-lg bg-white">
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
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
        placeholder={`Пример: ${label}`}
      />
      {showError && errors.value.length > 0 && (
        <p className="text-red-500 text-sm mt-1">
          ❌ {errors.value[0]?.message || 'Ошибка валидации'}
        </p>
      )}
      {touched.value && valid.value && (
        <p className="text-green-500 text-sm mt-1">✅ Валидно</p>
      )}
    </div>
  );
}

export default function ValidationExamples() {
  const form = useMemo(() => createValidationForm(), []);

  const handleValidateAll = () => {
    form.markAllAsTouched();
  };

  const handleReset = () => {
    form.reset();
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">Примеры валидации</h2>
      <p className="text-gray-600 mb-6">
        Демонстрация встроенных валидаторов ReFormer
      </p>

      <div className="grid gap-4">
        <ValidatedField
          control={form.requiredField}
          label="Required (обязательное поле)"
          description="required(path.field, { message: '...' })"
        />

        <ValidatedField
          control={form.emailField}
          label="Email"
          description="email(path.field, { message: '...' })"
          type="email"
        />

        <ValidatedField
          control={form.minLengthField}
          label="MinLength (минимум 5 символов)"
          description="minLength(path.field, 5, { message: '...' })"
        />

        <ValidatedField
          control={form.maxLengthField}
          label="MaxLength (максимум 10 символов)"
          description="maxLength(path.field, 10, { message: '...' })"
        />

        <ValidatedField
          control={form.minField}
          label="Min (минимум 10)"
          description="min(path.field, 10, { message: '...' })"
          type="number"
        />

        <ValidatedField
          control={form.maxField}
          label="Max (максимум 100)"
          description="max(path.field, 100, { message: '...' })"
          type="number"
        />

        <ValidatedField
          control={form.patternField}
          label="Pattern (только буквы)"
          description="pattern(path.field, /^[a-zA-Z]+$/, { message: '...' })"
        />
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
