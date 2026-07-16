/**
 * Примеры валидации с ReFormer — новая архитектура (M1).
 * Демонстрирует встроенные валидаторы через единую schema + validateFormModel.
 */

import { useMemo } from 'react';
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
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
  isNumber,
  integer,
  pastDate,
} from '@reformer/core/validators';
import { InputField, FormField, ExampleCard } from '@reformer/ui-kit';

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

const INITIAL: ValidationDemoForm = {
  requiredField: '',
  emailField: '',
  minLengthField: '',
  maxLengthField: '',
  minField: 0,
  maxField: 0,
  patternField: '',
  urlField: '',
  phoneField: '',
  numberField: 0,
  dateField: '',
  customField: '',
};

// Кастомный валидатор пароля (value, model) — здесь использует только value.
const customPassword: ModelValidator<string> = (value) => {
  const v = value;
  if (!v || v.length < 8) return { code: 'too-short', message: 'Минимум 8 символов' };
  if (!/[0-9]/.test(v)) return { code: 'no-digit', message: 'Должна быть хотя бы одна цифра' };
  if (!/[a-zA-Z]/.test(v)) return { code: 'no-letter', message: 'Должна быть хотя бы одна буква' };
  return null;
};

function buildSchema(model: ReturnType<typeof createModel<ValidationDemoForm>>) {
  return {
    children: [
      {
        value: model.$.requiredField,
        component: InputField,
        componentProps: { placeholder: 'Обязательное поле' },
        validators: [required({ message: 'Это поле обязательно' })],
      },
      {
        value: model.$.emailField,
        component: InputField,
        componentProps: { placeholder: 'email@example.com', type: 'email' },
        validators: [
          required({ message: 'Email обязателен' }),
          email({ message: 'Введите корректный email' }),
        ],
      },
      {
        value: model.$.minLengthField,
        component: InputField,
        componentProps: { placeholder: 'Минимум 5 символов' },
        validators: [
          required({ message: 'Поле обязательно' }),
          minLength(5, { message: 'Минимум 5 символов' }),
        ],
      },
      {
        value: model.$.maxLengthField,
        component: InputField,
        componentProps: { placeholder: 'Максимум 10 символов' },
        validators: [maxLength(10, { message: 'Максимум 10 символов' })],
      },
      {
        value: model.$.minField,
        component: InputField,
        componentProps: { placeholder: 'Минимум 10', type: 'number' },
        validators: [required({ message: 'Введите число' }), min(10, { message: 'Минимум 10' })],
      },
      {
        value: model.$.maxField,
        component: InputField,
        componentProps: { placeholder: 'Максимум 100', type: 'number' },
        validators: [required({ message: 'Введите число' }), max(100, { message: 'Максимум 100' })],
      },
      {
        value: model.$.patternField,
        component: InputField,
        componentProps: { placeholder: 'Только буквы' },
        validators: [
          required({ message: 'Поле обязательно' }),
          pattern(/^[a-zA-Zа-яА-Я]+$/, { message: 'Только буквы' }),
        ],
      },
      {
        value: model.$.urlField,
        component: InputField,
        componentProps: { placeholder: 'https://example.com' },
        validators: [
          required({ message: 'URL обязателен' }),
          url({ message: 'Введите корректный URL' }),
        ],
      },
      {
        value: model.$.phoneField,
        component: InputField,
        componentProps: { placeholder: '+7 900 123-45-67', type: 'tel' },
        validators: [
          required({ message: 'Телефон обязателен' }),
          phone({ format: 'ru', message: 'Введите российский номер телефона' }),
        ],
      },
      {
        value: model.$.numberField,
        component: InputField,
        componentProps: { placeholder: 'Целое число', type: 'number' },
        validators: [
          required({ message: 'Число обязательно' }),
          isNumber({ message: 'Должно быть числом' }),
          integer({ message: 'Только целое число' }),
          min(1, { message: 'Минимум 1' }),
          max(100, { message: 'Максимум 100' }),
        ],
      },
      {
        value: model.$.dateField,
        component: InputField,
        componentProps: { type: 'date' },
        validators: [
          required({ message: 'Дата обязательна' }),
          pastDate({ message: 'Дата не может быть в будущем' }),
        ],
      },
      {
        value: model.$.customField,
        component: InputField,
        componentProps: { placeholder: 'Пароль (мин. 8 символов, цифра, буква)' },
        validators: [required({ message: 'Пароль обязателен' }), customPassword],
      },
    ],
  };
}

export default function ValidationExamples() {
  const { form, model, schema } = useMemo(() => {
    const m = createModel<ValidationDemoForm>({ ...INITIAL });
    const s = buildSchema(m);
    const f = createForm<ValidationDemoForm>({ model: m, schema: s });
    return { form: f, model: m, schema: s };
  }, []);

  const handleValidateAll = async () => {
    form.markAsTouched();
    await validateFormModel(model, schema);
  };

  const handleReset = () => form.reset();

  return (
    <div className="mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">Примеры валидации</h2>
      <p className="text-gray-600 mb-6">Демонстрация встроенных валидаторов ReFormer</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ExampleCard
          title="Required"
          description="Обязательное поле"
          bgColor="bg-white"
          code={`validators: [required()]`}
        >
          <FormField control={form.requiredField} />
        </ExampleCard>
        <ExampleCard
          title="Email"
          description="Валидация email адреса"
          bgColor="bg-white"
          code={`validators: [required(), email()]`}
        >
          <FormField control={form.emailField} />
        </ExampleCard>
        <ExampleCard
          title="MinLength"
          description="Минимум 5 символов"
          bgColor="bg-white"
          code={`validators: [minLength(5)]`}
        >
          <FormField control={form.minLengthField} />
        </ExampleCard>
        <ExampleCard
          title="MaxLength"
          description="Максимум 10 символов"
          bgColor="bg-white"
          code={`validators: [maxLength(10)]`}
        >
          <FormField control={form.maxLengthField} />
        </ExampleCard>
        <ExampleCard
          title="Min"
          description="Минимальное значение 10"
          bgColor="bg-white"
          code={`validators: [min(10)]`}
        >
          <FormField control={form.minField} />
        </ExampleCard>
        <ExampleCard
          title="Max"
          description="Максимальное значение 100"
          bgColor="bg-white"
          code={`validators: [max(100)]`}
        >
          <FormField control={form.maxField} />
        </ExampleCard>
        <ExampleCard
          title="Pattern"
          description="Только буквы (regex)"
          bgColor="bg-white"
          code={`validators: [pattern(/^[a-zA-Zа-яА-Я]+$/)]`}
        >
          <FormField control={form.patternField} />
        </ExampleCard>
        <ExampleCard
          title="URL"
          description="Валидация URL адреса"
          bgColor="bg-white"
          code={`validators: [url()]`}
        >
          <FormField control={form.urlField} />
        </ExampleCard>
        <ExampleCard
          title="Phone"
          description="Номер телефона (формат РФ)"
          bgColor="bg-white"
          code={`validators: [phone({ format: 'ru' })]`}
        >
          <FormField control={form.phoneField} />
        </ExampleCard>
        <ExampleCard
          title="Number"
          description="Целое число от 1 до 100"
          bgColor="bg-white"
          code={`validators: [isNumber(), integer(), min(1), max(100)]`}
        >
          <FormField control={form.numberField} />
        </ExampleCard>
        <ExampleCard
          title="Date"
          description="Дата (не в будущем)"
          bgColor="bg-white"
          code={`validators: [pastDate()]`}
        >
          <FormField control={form.dateField} />
        </ExampleCard>
        <ExampleCard
          title="Custom"
          description="Кастомная валидация (value, model)"
          bgColor="bg-white"
          code={`validators: [(v) => v.length < 8 ? err : null]`}
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
