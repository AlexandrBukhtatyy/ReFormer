/**
 * Примеры выбора дат — три варианта DatePicker из @reformer/ui-kit с разными типами значения.
 *
 * - `DatePicker` — одна дата: `Date | null`.
 * - `DatePickerRange` — период: кортеж `[Date, Date] | null`. Кортеж — это массив модели, и
 *   поле получается при любом начальном значении: `null` либо готовый период (поле `stay`).
 * - `DatePickerMulti` — несколько дат: `Date[]` (начальное `[]`) или nullable `Date[] | null`.
 */

import { useState } from 'react';
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate, validateModel } from '@reformer/core/validation';
import { required, maxLength } from '@reformer/core/validators';
import { defineIssueMessages } from '@reformer/core/i18n';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormField, ExampleCard, Button } from '@reformer/ui-kit';
// DatePicker тянет react-day-picker и date-fns — живёт только в сабпате, вне главного barrel.
import {
  DatePicker,
  DatePickerRange,
  DatePickerMulti,
  type DateRangeValue,
} from '@reformer/ui-kit/date-picker';

interface DatePickerDemoForm {
  /** Одна дата. */
  birthDate: Date | null;
  /** Период без начального значения: сброс хранится как `null`. */
  vacation: DateRangeValue | null;
  /** Период с префиллом — кортеж прямо в начальном значении. Сброс хранится как `[]`. */
  stay: DateRangeValue;
  /** Несколько дат, поле-массив: пустой выбор хранится как `[]`. */
  meetings: Date[];
  /** Nullable-вариант: начальное `null`, пустой выбор — тоже `null`. */
  holidays: Date[] | null;
}

/** Ранее сохранённый период (сценарий редактирования): с 10-го по 14-е число текущего месяца. */
function presetStay(): DateRangeValue {
  const today = new Date();
  return [
    new Date(today.getFullYear(), today.getMonth(), 10),
    new Date(today.getFullYear(), today.getMonth(), 14),
  ];
}

const initial = (): DatePickerDemoForm => ({
  birthDate: null,
  vacation: null,
  stay: presetStay(),
  meetings: [],
  holidays: null,
});

const messages = defineIssueMessages({
  required: 'Обязательное поле',
  maxLength: 'Не больше {maxLength} дат',
});

function buildSchema(model: FormModel<DatePickerDemoForm>) {
  return {
    children: [
      {
        model: model.$.birthDate,
        component: DatePicker,
        componentProps: { label: 'Дата рождения', testId: 'birthDate', dateFormat: 'dd.MM.yyyy' },
      },
      {
        // `model.$.vacation` — лист (`null` в начале): значение поля — кортеж целиком.
        model: model.$.vacation,
        component: DatePickerRange,
        componentProps: {
          label: 'Отпуск',
          testId: 'vacation',
          dateFormat: 'dd.MM.yyyy',
          clearable: true,
          required: true,
        },
      },
      {
        // `model.$.stay` — ручка массива целиком: привязка компонента делает кортеж полем.
        model: model.$.stay,
        component: DatePickerRange,
        componentProps: {
          label: 'Проживание (с префиллом)',
          testId: 'stay',
          dateFormat: 'dd.MM.yyyy',
          numberOfMonths: 1,
          clearable: true,
          tooltip: 'Даты заезда и выезда включительно',
        },
      },
      {
        model: model.$.meetings,
        component: DatePickerMulti,
        componentProps: {
          label: 'Встречи',
          testId: 'meetings',
          dateFormat: 'dd.MM',
          clearable: true,
          maxItems: 4,
          required: true,
        },
      },
      {
        model: model.$.holidays,
        component: DatePickerMulti,
        componentProps: {
          label: 'Выходные',
          testId: 'holidays',
          summaryThreshold: 2,
          description: 'Больше двух дат — сводка с числом вместо списка.',
        },
      },
    ],
  };
}

// Обязательность — `required()`: отклоняет и `null`, и `[]`. Потолок количества — `maxLength(n)`;
// `maxItems` у контрола только гасит невыбранные дни.
const demoValidation = defineValidation<DatePickerDemoForm>(({ model }) => {
  validate(model.$.vacation, [required()]);
  validate(model.$.meetings, [required(), maxLength(4)]);
});

/** Снимок модели с датами в локальном `yyyy-MM-dd` — так его проще сверять глазами и в e2e. */
function snapshotOf(values: DatePickerDemoForm): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return JSON.stringify(
    values,
    function (this: Record<string, unknown>, key, value) {
      const raw = this[key];
      return raw instanceof Date ? day(raw) : value;
    },
    2
  );
}

export default function DatePickerDemo() {
  const { form, model } = useFormBundle(() =>
    createForm<DatePickerDemoForm>({ initial: initial(), schema: buildSchema })
  );

  const [snapshot, setSnapshot] = useState<string | null>(null);

  const handleValidate = async () => {
    form.markAsTouched();
    await validateModel(model, demoValidation);
  };

  return (
    <ValidationMessagesProvider messages={messages}>
      <div className="mx-auto p-6">
        <h2 className="mb-2 text-2xl font-bold">Выбор дат</h2>
        <p className="mb-6 text-gray-600">
          Три варианта DatePicker: одна дата <code>Date | null</code>, период{' '}
          <code>[Date, Date] | null</code> и несколько дат <code>Date[]</code>.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExampleCard
            title="DatePicker"
            description="Одна дата; выбор закрывает календарь"
            bgColor="bg-white"
            code={`model: model.$.birthDate, // Date | null
component: DatePicker,`}
          >
            <FormField control={form.birthDate} />
          </ExampleCard>

          <ExampleCard
            title="DatePickerRange"
            description="Период в два клика: начало, затем конец. Пока выбрано начало, значение поля прежнее"
            bgColor="bg-white"
            code={`model: model.$.vacation, // [Date, Date] | null, начальное null
component: DatePickerRange,
componentProps: { clearable: true }, // numberOfMonths — 2 по умолчанию
validate(model.$.vacation, [required()]);`}
          >
            <FormField control={form.vacation} />
          </ExampleCard>

          <ExampleCard
            title="Период с префиллом"
            description="Кортеж в начальном значении — тоже поле; reset() возвращает его"
            bgColor="bg-white"
            code={`createForm<Form>({
  initial: { ...INITIAL, stay: [from, to] },
  schema: buildSchema,
})`}
          >
            <FormField control={form.stay} />
          </ExampleCard>

          <ExampleCard
            title="DatePickerMulti"
            description="Клик добавляет день, повторный — снимает; maxItems=4 гасит остальные дни"
            bgColor="bg-white"
            code={`model: model.$.meetings, // Date[], начальное []
component: DatePickerMulti,
componentProps: { clearable: true, maxItems: 4 },
validate(model.$.meetings, [required(), maxLength(4)]);`}
          >
            <FormField control={form.meetings} />
          </ExampleCard>

          <ExampleCard
            title="Nullable-поле дат"
            description="Date[] | null: пустой выбор хранится как null"
            bgColor="bg-white"
            code={`// holidays: Date[] | null, начальное null
componentProps: { summaryThreshold: 2 }`}
          >
            <FormField control={form.holidays} />
          </ExampleCard>
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={handleValidate} data-testid="btn-validate">
            Проверить
          </Button>
          <Button
            variant="outline"
            onClick={() => setSnapshot(snapshotOf(model.get()))}
            data-testid="btn-snapshot"
          >
            Снимок модели
          </Button>
          <Button variant="outline" onClick={() => form.reset()} data-testid="btn-reset">
            Сбросить
          </Button>
        </div>

        {snapshot && (
          <pre
            className="mt-4 overflow-auto rounded bg-gray-50 p-4 text-xs"
            data-testid="model-snapshot"
          >
            {snapshot}
          </pre>
        )}
      </div>
    </ValidationMessagesProvider>
  );
}
