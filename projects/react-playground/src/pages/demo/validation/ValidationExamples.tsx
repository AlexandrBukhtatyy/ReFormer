/**
 * Примеры валидации с ReFormer — контракт `@reformer/core/validation`.
 *
 * Разделение слоёв: схема формы (`buildSchema`) несёт только поля
 * (`{ model, component, componentProps }`) и уходит в сборку `createForm`. Правила живут отдельно —
 * в стабильной module-level `ValidationDefinition` (`demoValidation`), которую на submit прогоняет
 * внешний раннер `validateModel(model, schema)`.
 */

import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { validate, defineValidation, validateModel, type Rule } from '@reformer/core/validation';
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
  isDate,
  minDate,
  maxDate,
  futureDate,
  minAge,
  maxAge,
} from '@reformer/core/validators';
import { Input, FormField, ExampleCard, InputNumber } from '@reformer/ui-kit';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { validationExamplesMessages } from './messages';

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
  isDateField: string;
  minDateField: string;
  maxDateField: string;
  futureDateField: string;
  minAgeField: string;
  maxAgeField: string;
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
  isDateField: '',
  minDateField: '',
  maxDateField: '',
  futureDateField: '',
  minAgeField: '',
  maxAgeField: '',
  customField: '',
};

/** Нижняя граница примера `minDate`. */
const MIN_DATE = new Date('2020-01-01');

// Кастомный валидатор пароля — value-only `Rule<string>` (используется под `validate`).
const customPassword: Rule<string> = (value) => {
  const v = value;
  if (!v || v.length < 8) return { code: 'too-short' };
  if (!/[0-9]/.test(v)) return { code: 'no-digit' };
  if (!/[a-zA-Z]/.test(v)) return { code: 'no-letter' };
  return null;
};

// Схема формы: только поля, без правил (валидаторы вынесены в demoValidation).
function buildSchema(model: FormModel<ValidationDemoForm>) {
  return {
    children: [
      {
        model: model.$.requiredField,
        component: Input,
        componentProps: { placeholder: 'Обязательное поле' },
      },
      {
        model: model.$.emailField,
        component: Input,
        componentProps: { placeholder: 'email@example.com', type: 'email' },
      },
      {
        model: model.$.minLengthField,
        component: Input,
        componentProps: { placeholder: 'Минимум 5 символов' },
      },
      {
        model: model.$.maxLengthField,
        component: Input,
        componentProps: { placeholder: 'Максимум 10 символов' },
      },
      {
        model: model.$.minField,
        component: InputNumber,
        componentProps: { placeholder: 'Минимум 10' },
      },
      {
        model: model.$.maxField,
        component: InputNumber,
        componentProps: { placeholder: 'Максимум 100' },
      },
      {
        model: model.$.patternField,
        component: Input,
        componentProps: { placeholder: 'Только буквы' },
      },
      {
        model: model.$.urlField,
        component: Input,
        componentProps: { placeholder: 'https://example.com' },
      },
      {
        model: model.$.phoneField,
        component: Input,
        componentProps: { placeholder: '+7 900 123-45-67', type: 'tel' },
      },
      {
        model: model.$.numberField,
        component: InputNumber,
        componentProps: { placeholder: 'Целое число' },
      },
      {
        model: model.$.dateField,
        component: Input,
        componentProps: { type: 'date' },
      },
      {
        model: model.$.isDateField,
        component: Input,
        componentProps: { type: 'date' },
      },
      {
        model: model.$.minDateField,
        component: Input,
        componentProps: { type: 'date' },
      },
      {
        model: model.$.maxDateField,
        component: Input,
        componentProps: { type: 'date' },
      },
      {
        model: model.$.futureDateField,
        component: Input,
        componentProps: { type: 'date' },
      },
      {
        model: model.$.minAgeField,
        component: Input,
        componentProps: { type: 'date', placeholder: 'Дата рождения' },
      },
      {
        model: model.$.maxAgeField,
        component: Input,
        componentProps: { type: 'date', placeholder: 'Дата рождения' },
      },
      {
        model: model.$.customField,
        component: Input,
        componentProps: { placeholder: 'Пароль (мин. 8 символов, цифра, буква)' },
      },
    ],
  };
}

// Слой валидации: стабильная module-level схема, прогоняется по требованию через validateModel.
const demoValidation = defineValidation<ValidationDemoForm>(({ model }) => {
  validate(model.$.requiredField, [required({ code: 'requiredField.required' })]);
  validate(model.$.emailField, [
    required({ code: 'emailField.required' }),
    email({ code: 'emailField.email' }),
  ]);
  validate(model.$.minLengthField, [
    required({ code: 'minLengthField.required' }),
    minLength(5, { code: 'minLengthField.minLength' }),
  ]);
  validate(model.$.maxLengthField, [maxLength(10, { code: 'maxLengthField.maxLength' })]);
  validate(model.$.minField, [
    required({ code: 'minField.required' }),
    min(10, { code: 'minField.min' }),
  ]);
  validate(model.$.maxField, [
    required({ code: 'maxField.required' }),
    max(100, { code: 'maxField.max' }),
  ]);
  validate(model.$.patternField, [
    required({ code: 'patternField.required' }),
    pattern(/^[a-zA-Zа-яА-Я]+$/, { code: 'patternField.pattern' }),
  ]);
  validate(model.$.urlField, [
    required({ code: 'urlField.required' }),
    url({ code: 'urlField.url' }),
  ]);
  validate(model.$.phoneField, [
    required({ code: 'phoneField.required' }),
    phone({ format: 'ru', code: 'phoneField.phone' }),
  ]);
  validate(model.$.numberField, [
    required({ code: 'numberField.required' }),
    isNumber({ code: 'numberField.isNumber' }),
    integer({ code: 'numberField.integer' }),
    min(1, { code: 'numberField.min' }),
    max(100, { code: 'numberField.max' }),
  ]);
  validate(model.$.dateField, [
    required({ code: 'dateField.required' }),
    pastDate({ code: 'dateField.pastDate' }),
  ]);
  validate(model.$.isDateField, [
    required({ code: 'isDateField.required' }),
    isDate({ code: 'isDateField.isDate' }),
  ]);
  validate(model.$.minDateField, [minDate(MIN_DATE, { code: 'minDateField.minDate' })]);
  validate(model.$.maxDateField, [maxDate(new Date(), { code: 'maxDateField.maxDate' })]);
  validate(model.$.futureDateField, [futureDate({ code: 'futureDateField.futureDate' })]);
  validate(model.$.minAgeField, [minAge(18, { code: 'minAgeField.minAge' })]);
  validate(model.$.maxAgeField, [maxAge(65, { code: 'maxAgeField.maxAge' })]);
  validate(model.$.customField, [required({ code: 'customField.required' }), customPassword]);
});

export default function ValidationExamples() {
  // Сборка одним вызовом. Правила здесь прогоняются вручную по кнопке (`validateModel`), поэтому в
  // конфиг не передаются — пример показывает именно ручной прогон.
  const { form, model } = useFormBundle(() =>
    createForm<ValidationDemoForm>({ initial: { ...INITIAL }, schema: buildSchema })
  );

  const handleValidateAll = async () => {
    form.markAsTouched();
    await validateModel(model, demoValidation);
  };

  const handleReset = () => form.reset();

  return (
    <ValidationMessagesProvider messages={validationExamplesMessages}>
      <div className="mx-auto p-6">
        <h2 className="text-2xl font-bold mb-2">Примеры валидации</h2>
        <p className="text-gray-600 mb-6">Демонстрация встроенных валидаторов ReFormer</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ExampleCard
            title="Required"
            description="Обязательное поле"
            bgColor="bg-white"
            code={`validate(model.$.requiredField, [required()])`}
          >
            <FormField control={form.requiredField} testId="requiredField" />
          </ExampleCard>
          <ExampleCard
            title="Email"
            description="Валидация email адреса"
            bgColor="bg-white"
            code={`validate(model.$.emailField, [required(), email()])`}
          >
            <FormField control={form.emailField} testId="emailField" />
          </ExampleCard>
          <ExampleCard
            title="MinLength"
            description="Минимум 5 символов"
            bgColor="bg-white"
            code={`validate(model.$.minLengthField, [minLength(5)])`}
          >
            <FormField control={form.minLengthField} testId="minLengthField" />
          </ExampleCard>
          <ExampleCard
            title="MaxLength"
            description="Максимум 10 символов"
            bgColor="bg-white"
            code={`validate(model.$.maxLengthField, [maxLength(10)])`}
          >
            <FormField control={form.maxLengthField} testId="maxLengthField" />
          </ExampleCard>
          <ExampleCard
            title="Min"
            description="Минимальное значение 10"
            bgColor="bg-white"
            code={`validate(model.$.minField, [min(10)])`}
          >
            <FormField control={form.minField} testId="minField" />
          </ExampleCard>
          <ExampleCard
            title="Max"
            description="Максимальное значение 100"
            bgColor="bg-white"
            code={`validate(model.$.maxField, [max(100)])`}
          >
            <FormField control={form.maxField} testId="maxField" />
          </ExampleCard>
          <ExampleCard
            title="Pattern"
            description="Только буквы (regex)"
            bgColor="bg-white"
            code={`validate(model.$.patternField, [pattern(/^[a-zA-Zа-яА-Я]+$/)])`}
          >
            <FormField control={form.patternField} testId="patternField" />
          </ExampleCard>
          <ExampleCard
            title="URL"
            description="Валидация URL адреса"
            bgColor="bg-white"
            code={`validate(model.$.urlField, [url()])`}
          >
            <FormField control={form.urlField} testId="urlField" />
          </ExampleCard>
          <ExampleCard
            title="Phone"
            description="Номер телефона (формат РФ)"
            bgColor="bg-white"
            code={`validate(model.$.phoneField, [phone({ format: 'ru' })])`}
          >
            <FormField control={form.phoneField} testId="phoneField" />
          </ExampleCard>
          <ExampleCard
            title="Number"
            description="Целое число от 1 до 100"
            bgColor="bg-white"
            code={`validate(model.$.numberField, [isNumber(), integer(), min(1), max(100)])`}
          >
            <FormField control={form.numberField} testId="numberField" />
          </ExampleCard>
          <ExampleCard
            title="Date"
            description="Дата (не в будущем)"
            bgColor="bg-white"
            code={`validate(model.$.dateField, [pastDate()])`}
          >
            <FormField control={form.dateField} testId="dateField" />
          </ExampleCard>
          <ExampleCard
            title="IsDate"
            description="Корректная дата"
            bgColor="bg-white"
            code={`validate(model.$.isDateField, [required(), isDate()])`}
          >
            <FormField control={form.isDateField} testId="isDateField" />
          </ExampleCard>
          <ExampleCard
            title="MinDate"
            description="Не раньше 01.01.2020"
            bgColor="bg-white"
            code={`validate(model.$.minDateField, [minDate(new Date('2020-01-01'))])`}
          >
            <FormField control={form.minDateField} testId="minDateField" />
          </ExampleCard>
          <ExampleCard
            title="MaxDate"
            description="Не позже сегодня"
            bgColor="bg-white"
            code={`validate(model.$.maxDateField, [maxDate(new Date())])`}
          >
            <FormField control={form.maxDateField} testId="maxDateField" />
          </ExampleCard>
          <ExampleCard
            title="FutureDate"
            description="Дата в будущем"
            bgColor="bg-white"
            code={`validate(model.$.futureDateField, [futureDate()])`}
          >
            <FormField control={form.futureDateField} testId="futureDateField" />
          </ExampleCard>
          <ExampleCard
            title="MinAge"
            description="Возраст от 18 лет"
            bgColor="bg-white"
            code={`validate(model.$.minAgeField, [minAge(18)])`}
          >
            <FormField control={form.minAgeField} testId="minAgeField" />
          </ExampleCard>
          <ExampleCard
            title="MaxAge"
            description="Возраст до 65 лет"
            bgColor="bg-white"
            code={`validate(model.$.maxAgeField, [maxAge(65)])`}
          >
            <FormField control={form.maxAgeField} testId="maxAgeField" />
          </ExampleCard>
          <ExampleCard
            title="Custom"
            description="Кастомная валидация (value-only Rule)"
            bgColor="bg-white"
            code={`validate(model.$.customField, [(v) => v.length < 8 ? err : null])`}
          >
            <FormField control={form.customField} testId="customField" />
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
    </ValidationMessagesProvider>
  );
}
