/**
 * Примеры валидации с ReFormer
 * Демонстрирует встроенные валидаторы по разделам
 */

import { useMemo, useState } from 'react';
import { createForm, type FormProxy, type FormSchema, type FieldPath } from '@reformer/core';
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
  isDate,
  minDate,
  maxDate,
  pastDate,
  futureDate,
  minAge,
  maxAge,
  validate,
} from '@reformer/core/validators';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input, ExampleCard, FormField } from '@reformer/ui-kit';

interface ValidationDemoForm {
  // Строки
  requiredField: string;
  emailField: string;
  minLengthField: string;
  maxLengthField: string;
  patternField: string;
  urlField: string;
  phoneField: string;
  // Числа
  minField: number;
  maxField: number;
  numberField: number;
  // Дата и время
  dateField: string;
  isDateField: string;
  minDateField: string;
  maxDateField: string;
  futureDateField: string;
  minAgeField: string;
  maxAgeField: string;
  // Другие
  customField: string;
}

const validationFormSchema: FormSchema<ValidationDemoForm> = {
  requiredField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Обязательное поле', testId: 'requiredField' },
  },
  emailField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'email@example.com', type: 'email', testId: 'emailField' },
  },
  minLengthField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Минимум 5 символов', testId: 'minLengthField' },
  },
  maxLengthField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Максимум 10 символов', testId: 'maxLengthField' },
  },
  patternField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Только буквы', testId: 'patternField' },
  },
  urlField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'https://example.com', testId: 'urlField' },
  },
  phoneField: {
    value: '',
    component: Input,
    componentProps: { placeholder: '+7 900 123-45-67', type: 'tel', testId: 'phoneField' },
  },
  minField: {
    value: 0,
    component: Input,
    componentProps: { placeholder: 'Минимум 10', type: 'number', testId: 'minField' },
  },
  maxField: {
    value: 0,
    component: Input,
    componentProps: { placeholder: 'Максимум 100', type: 'number', testId: 'maxField' },
  },
  numberField: {
    value: 0,
    component: Input,
    componentProps: { placeholder: 'Целое число 1–100', type: 'number', testId: 'numberField' },
  },
  dateField: {
    value: '',
    component: Input,
    componentProps: { type: 'date', testId: 'dateField' },
  },
  isDateField: {
    value: '',
    component: Input,
    componentProps: { type: 'date', testId: 'isDateField' },
  },
  minDateField: {
    value: '',
    component: Input,
    componentProps: { type: 'date', testId: 'minDateField' },
  },
  maxDateField: {
    value: '',
    component: Input,
    componentProps: { type: 'date', testId: 'maxDateField' },
  },
  futureDateField: {
    value: '',
    component: Input,
    componentProps: { type: 'date', testId: 'futureDateField' },
  },
  minAgeField: {
    value: '',
    component: Input,
    componentProps: { type: 'date', placeholder: 'Дата рождения', testId: 'minAgeField' },
  },
  maxAgeField: {
    value: '',
    component: Input,
    componentProps: { type: 'date', placeholder: 'Дата рождения', testId: 'maxAgeField' },
  },
  customField: {
    value: '',
    component: Input,
    componentProps: { placeholder: 'Пароль (мин. 8 символов, цифра, буква)', testId: 'customField' },
  },
};

const validationFormValidation = (path: FieldPath<ValidationDemoForm>) => {
  required(path.requiredField, { message: 'Это поле обязательно' });

  required(path.emailField, { message: 'Email обязателен' });
  email(path.emailField, { message: 'Введите корректный email' });

  required(path.minLengthField, { message: 'Поле обязательно' });
  minLength(path.minLengthField, 5, { message: 'Минимум 5 символов' });

  maxLength(path.maxLengthField, 10, { message: 'Максимум 10 символов' });

  required(path.patternField, { message: 'Поле обязательно' });
  pattern(path.patternField, /^[a-zA-Zа-яА-Я]+$/, { message: 'Только буквы' });

  required(path.urlField, { message: 'URL обязателен' });
  url(path.urlField, { message: 'Введите корректный URL' });

  required(path.phoneField, { message: 'Телефон обязателен' });
  phone(path.phoneField, { format: 'ru', message: 'Введите российский номер телефона' });

  required(path.minField, { message: 'Введите число' });
  min(path.minField, 10, { message: 'Минимум 10' });

  required(path.maxField, { message: 'Введите число' });
  max(path.maxField, 100, { message: 'Максимум 100' });

  required(path.numberField, { message: 'Число обязательно' });
  number(path.numberField, { integer: true, min: 1, max: 100, message: 'Целое число от 1 до 100' });

  required(path.dateField, { message: 'Дата обязательна' });
  pastDate(path.dateField, { message: 'Дата не может быть в будущем' });

  required(path.isDateField, { message: 'Дата обязательна' });
  isDate(path.isDateField, { message: 'Введите корректную дату' });

  required(path.minDateField, { message: 'Дата обязательна' });
  minDate(path.minDateField, new Date('2020-01-01'), {
    message: 'Дата не может быть раньше 01.01.2020',
  });

  required(path.maxDateField, { message: 'Дата обязательна' });
  maxDate(path.maxDateField, new Date(), { message: 'Дата не может быть позже сегодня' });

  required(path.futureDateField, { message: 'Дата обязательна' });
  futureDate(path.futureDateField, { message: 'Дата должна быть в будущем' });

  required(path.minAgeField, { message: 'Дата рождения обязательна' });
  minAge(path.minAgeField, 18, { message: 'Минимальный возраст: 18 лет' });

  required(path.maxAgeField, { message: 'Дата рождения обязательна' });
  maxAge(path.maxAgeField, 65, { message: 'Максимальный возраст: 65 лет' });

  required(path.customField, { message: 'Пароль обязателен' });
  validate(path.customField, (value: string) => {
    if (!value || value.length < 8) return { code: 'too-short', message: 'Минимум 8 символов' };
    if (!/[0-9]/.test(value))
      return { code: 'no-digit', message: 'Должна быть хотя бы одна цифра' };
    if (!/[a-zA-Z]/.test(value))
      return { code: 'no-letter', message: 'Должна быть хотя бы одна буква' };
    return null;
  });
};

function createValidationForm(): FormProxy<ValidationDemoForm> {
  return createForm<ValidationDemoForm>({
    form: validationFormSchema,
    validation: validationFormValidation,
  });
}

function SectionTitle({
  title,
  description,
  isOpen,
  onToggle,
}: {
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="col-span-full mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left group"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        )}
        <span className="text-lg font-semibold text-gray-800 group-hover:text-gray-600">
          {title}
        </span>
        {description && (
          <span className="text-sm text-gray-400 font-normal ml-1">{description}</span>
        )}
      </button>
      <div className="mt-2 border-t border-gray-200" />
    </div>
  );
}

export default function ValidationExamples() {
  const form = useMemo(() => createValidationForm(), []);
  const [open, setOpen] = useState({ strings: true, numbers: true, dates: true, other: true });

  const allOpen = Object.values(open).every(Boolean);
  const toggleAll = () => {
    const next = !allOpen;
    setOpen({ strings: next, numbers: next, dates: next, other: next });
  };
  const toggle = (key: keyof typeof open) => setOpen((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-2xl font-bold">Примеры валидации</h2>
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-blue-600 hover:text-blue-800 mt-1"
        >
          {allOpen ? 'Свернуть все' : 'Развернуть все'}
        </button>
      </div>
      <p className="text-gray-600 mb-3">Демонстрация встроенных валидаторов ReFormer</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* ── Строки ── */}
        <SectionTitle
          title="Строки"
          description="Валидаторы для текстовых полей"
          isOpen={open.strings}
          onToggle={() => toggle('strings')}
        />

        {open.strings && (
          <>
            <ExampleCard
              title="Required"
              description="Обязательное поле"
              bgColor="bg-white"
              code={`required(path.field, {
message: 'Это поле обязательно'
})`}
            >
              <FormField control={form.requiredField} />
            </ExampleCard>

            <ExampleCard
              title="Email"
              description="Формат email адреса"
              bgColor="bg-white"
              code={`email(path.emailField, {
  message: 'Введите корректный email'
})`}
            >
              <FormField control={form.emailField} />
            </ExampleCard>

            <ExampleCard
              title="MinLength"
              description="Минимум 5 символов"
              bgColor="bg-white"
              code={`minLength(path.field, 5, {
  message: 'Минимум 5 символов'
})`}
            >
              <FormField control={form.minLengthField} />
            </ExampleCard>

            <ExampleCard
              title="MaxLength"
              description="Максимум 10 символов"
              bgColor="bg-white"
              code={`maxLength(path.field, 10, {
  message: 'Максимум 10 символов'
})`}
            >
              <FormField control={form.maxLengthField} />
            </ExampleCard>

            <ExampleCard
              title="Pattern"
              description="Только буквы (regex)"
              bgColor="bg-white"
              code={`pattern(path.field, /^[a-zA-Zа-яА-Я]+$/, {
  message: 'Только буквы'
})`}
            >
              <FormField control={form.patternField} />
            </ExampleCard>

            <ExampleCard
              title="URL"
              description="Корректный URL адрес"
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
          </>
        )}

        {/* ── Числа ── */}
        <SectionTitle
          title="Числа"
          description="Валидаторы для числовых полей"
          isOpen={open.numbers}
          onToggle={() => toggle('numbers')}
        />

        {open.numbers && (
          <>
            <ExampleCard
              title="Min"
              description="Минимальное значение 10"
              bgColor="bg-white"
              code={`min(path.field, 10, {
  message: 'Минимум 10'
})`}
            >
              <FormField control={form.minField} />
            </ExampleCard>

            <ExampleCard
              title="Max"
              description="Максимальное значение 100"
              bgColor="bg-white"
              code={`max(path.field, 100, {
  message: 'Максимум 100'
})`}
            >
              <FormField control={form.maxField} />
            </ExampleCard>

            <ExampleCard
              title="Number"
              description="Целое число от 1 до 100"
              bgColor="bg-white"
              code={`number(path.field, {
  integer: true,
  min: 1,
  max: 100,
  message: 'Целое число от 1 до 100'
})`}
            >
              <FormField control={form.numberField} />
            </ExampleCard>
          </>
        )}

        {/* ── Дата и время ── */}
        <SectionTitle
          title="Дата и время"
          description="Валидаторы для полей даты"
          isOpen={open.dates}
          onToggle={() => toggle('dates')}
        />

        {open.dates && (
          <>
            <ExampleCard
              title="PastDate"
              description="Дата не может быть в будущем"
              bgColor="bg-white"
              code={`pastDate(path.dateField, {
  message: 'Дата не может быть в будущем'
})`}
            >
              <FormField control={form.dateField} />
            </ExampleCard>

            <ExampleCard
              title="IsDate"
              description="Корректный формат даты"
              bgColor="bg-white"
              code={`isDate(path.field, {
  message: 'Введите корректную дату'
})`}
            >
              <FormField control={form.isDateField} />
            </ExampleCard>

            <ExampleCard
              title="MinDate"
              description="Дата не раньше 01.01.2020"
              bgColor="bg-white"
              code={`minDate(path.field, new Date('2020-01-01'), {
  message: 'Дата не раньше 01.01.2020'
})`}
            >
              <FormField control={form.minDateField} />
            </ExampleCard>

            <ExampleCard
              title="MaxDate"
              description="Дата не позже сегодня"
              bgColor="bg-white"
              code={`maxDate(path.field, new Date(), {
  message: 'Дата не позже сегодня'
})`}
            >
              <FormField control={form.maxDateField} />
            </ExampleCard>

            <ExampleCard
              title="FutureDate"
              description="Дата должна быть в будущем"
              bgColor="bg-white"
              code={`futureDate(path.field, {
  message: 'Дата должна быть в будущем'
})`}
            >
              <FormField control={form.futureDateField} />
            </ExampleCard>

            <ExampleCard
              title="MinAge"
              description="Возраст не менее 18 лет (дата рождения)"
              bgColor="bg-white"
              code={`minAge(path.birthDate, 18, {
  message: 'Минимальный возраст: 18 лет'
})`}
            >
              <FormField control={form.minAgeField} />
            </ExampleCard>

            <ExampleCard
              title="MaxAge"
              description="Возраст не более 65 лет (дата рождения)"
              bgColor="bg-white"
              code={`maxAge(path.birthDate, 65, {
  message: 'Максимальный возраст: 65 лет'
})`}
            >
              <FormField control={form.maxAgeField} />
            </ExampleCard>
          </>
        )}

        {/* ── Другие ── */}
        <SectionTitle
          title="Другие"
          description="Кастомная валидация"
          isOpen={open.other}
          onToggle={() => toggle('other')}
        />

        {open.other && (
          <>
            <ExampleCard
              title="Validate"
              description="Кастомная валидация пароля"
              bgColor="bg-white"
              code={`validate(path.field, (value) => {
  if (value.length < 8)
    return { code: 'too-short', message: 'Минимум 8 символов' };
  if (!/[0-9]/.test(value))
    return { code: 'no-digit', message: 'Нужна цифра' };
  if (!/[a-zA-Z]/.test(value))
    return { code: 'no-letter', message: 'Нужна буква' };
  return null;
})`}
            >
              <FormField control={form.customField} />
            </ExampleCard>
          </>
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={() => {
            form.markAsTouched();
            form.validate();
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Проверить все
        </button>
        <button
          onClick={() => form.reset()}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Сбросить
        </button>
      </div>
    </div>
  );
}
