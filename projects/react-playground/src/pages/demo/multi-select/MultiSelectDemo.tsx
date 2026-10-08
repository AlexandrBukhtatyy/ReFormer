/**
 * Примеры множественного выбора — четыре контрола @reformer/ui-kit с одним контрактом значения.
 *
 * Поле мультивыбора — обычный массив модели: `tags: string[]` с начальным `[]`. Массив становится
 * ОДНИМ значением поля, когда схема привязывает к нему компонент (`model: model.$.tags`); правила
 * и поведение берут ту же ручку значения. Префилл — просто начальное значение.
 *
 * Одно поле (`days`) оставлено nullable — `string[] | null` с начальным `null`: так объявляют
 * поле, которому нужно отличать «не выбирали» от «выбрали ничего». Привязывается оно так же.
 */

import { useState } from 'react';
import { createForm, useFormBundle, type FormModel } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, maxLength } from '@reformer/core/validators';
import { ValidationMessagesProvider, createMessageResolver } from '@reformer/cdk';
import {
  SelectMulti,
  NativeSelectMulti,
  ToggleGroupMulti,
  FormField,
  ExampleCard,
  Button,
} from '@reformer/ui-kit';
// Combobox — тяжёлый компонент (cmdk), живёт только в сабпате, вне главного barrel.
import { ComboboxMulti } from '@reformer/ui-kit/combobox';

interface MultiSelectDemoForm {
  /**
   * Поля-массивы: пустой выбор хранится как `[]`. Контрол на пустом выборе отдаёт `null`
   * (см. `multiValueAdapter`), а узел-массив модели приводит его к `[]`.
   */
  tags: string[];
  frameworks: string[];
  countries: string[];
  /** Nullable-вариант: начальное `null`, пустой выбор — тоже `null`. */
  days: string[] | null;
  /** Поле с префиллом: выбранное лежит прямо в начальном значении. */
  skills: string[];
}

const TAGS = [
  { value: 'bug', label: 'Баг' },
  { value: 'feat', label: 'Фича' },
  { value: 'docs', label: 'Документация' },
  { value: 'perf', label: 'Производительность' },
];

const FRAMEWORKS = [
  { value: 'next', label: 'Next.js' },
  { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' },
  { value: 'nuxt', label: 'Nuxt.js' },
  { value: 'svelte', label: 'SvelteKit' },
  { value: 'solid', label: 'SolidStart' },
];

const COUNTRIES = [
  { value: 'ru', label: 'Россия', group: 'СНГ' },
  { value: 'by', label: 'Беларусь', group: 'СНГ' },
  { value: 'kz', label: 'Казахстан', group: 'СНГ' },
  { value: 'de', label: 'Германия', group: 'Европа' },
  { value: 'fr', label: 'Франция', group: 'Европа' },
];

const DAYS = [
  { value: 'mon', label: 'Пн' },
  { value: 'tue', label: 'Вт' },
  { value: 'wed', label: 'Ср' },
  { value: 'thu', label: 'Чт' },
  { value: 'fri', label: 'Пт' },
];

const SKILLS = [
  { value: 'ts', label: 'TypeScript' },
  { value: 'react', label: 'React' },
  { value: 'node', label: 'Node.js' },
];

/** Ранее сохранённый выбор (сценарий редактирования) — начальное значение поля. */
const PRESELECTED_SKILLS = ['ts', 'react'];

const INITIAL: MultiSelectDemoForm = {
  tags: [],
  frameworks: [],
  countries: [],
  days: null,
  skills: [...PRESELECTED_SKILLS],
};

const messages = createMessageResolver({
  required: () => 'Выберите хотя бы один вариант',
  maxLength: (p) => `Не больше ${String(p?.maxLength)} вариантов`,
});

function buildSchema(model: FormModel<MultiSelectDemoForm>) {
  return {
    children: [
      {
        // `model.$.tags` — ручка значения массива целиком: читается и пишется, как сигнал листа.
        // Привязка компонента и делает массив полем; без неё форма массив пропускает.
        model: model.$.tags,
        component: ToggleGroupMulti,
        componentProps: {
          label: 'Метки задачи',
          testId: 'tags',
          options: TAGS,
          required: true,
        },
      },
      {
        model: model.$.frameworks,
        component: ComboboxMulti,
        componentProps: {
          label: 'Фреймворки',
          testId: 'frameworks',
          options: FRAMEWORKS,
          placeholder: 'Выберите фреймворки',
          searchPlaceholder: 'Поиск...',
          clearable: true,
          maxItems: 3,
        },
      },
      {
        model: model.$.countries,
        component: SelectMulti,
        componentProps: {
          label: 'Страны',
          testId: 'countries',
          options: COUNTRIES,
          placeholder: 'Выберите страны',
          clearable: true,
          summaryThreshold: 2,
        },
      },
      {
        model: model.$.days,
        component: NativeSelectMulti,
        componentProps: {
          label: 'Рабочие дни',
          testId: 'days',
          options: DAYS,
          rows: 5,
          description: 'Нативный листбокс: Ctrl+клик и Shift+стрелки. Не для тач-устройств.',
        },
      },
      {
        model: model.$.skills,
        component: ComboboxMulti,
        componentProps: {
          label: 'Навыки (с префиллом)',
          testId: 'skills',
          options: SKILLS,
          creatable: true,
          clearable: true,
        },
      },
    ],
  };
}

// Слой валидации — отдельная схема над моделью. Обязательность — `required()`: он отклоняет
// и `[]`, и `null`. `minLength(1)` годится только для поля-массива: на `null` он выходит раньше
// проверки.
const demoValidation = defineValidationSchema<MultiSelectDemoForm>(({ model }) => {
  validate(model.$.tags, [required()]);
  validate(model.$.frameworks, [required(), maxLength(3)]);
  validate(model.$.countries, [required()]);
});

export default function MultiSelectDemo() {
  const { form, model } = useFormBundle(() =>
    createForm<MultiSelectDemoForm>({
      // Префилл — обычное начальное значение: форма собирается уже с ним, поэтому модель не
      // «изменена» сразу после загрузки, а `reset()` возвращает именно его.
      initial: { ...INITIAL },
      schema: buildSchema,
    })
  );

  const [snapshot, setSnapshot] = useState<string | null>(null);

  const handleValidate = async () => {
    form.markAsTouched();
    await validateModel(model, demoValidation);
  };

  const handleSnapshot = () => setSnapshot(JSON.stringify(model.get(), null, 2));

  return (
    <ValidationMessagesProvider resolver={messages}>
      <div className="mx-auto p-6">
        <h2 className="mb-2 text-2xl font-bold">Множественный выбор</h2>
        <p className="mb-6 text-gray-600">
          Четыре контрола с одним контрактом значения. Поле модели — массив <code>string[]</code> с
          начальным <code>[]</code>; «Рабочие дни» — nullable-вариант <code>string[] | null</code>.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExampleCard
            title="ToggleGroupMulti"
            description="2–7 вариантов, все видны сразу. Radix ToggleGroup type=multiple"
            bgColor="bg-white"
            code={`{
  model: model.$.tags, // tags: string[], начальное []
  component: ToggleGroupMulti,
  componentProps: { options: TAGS },
}
validate(model.$.tags, [required()]);`}
          >
            <FormField control={form.tags} />
          </ExampleCard>

          <ExampleCard
            title="ComboboxMulti"
            description="Длинный список с поиском; чипы в триггере, maxItems=3"
            bgColor="bg-white"
            code={`componentProps: {
  options: FRAMEWORKS,
  clearable: true,
  maxItems: 3, // подсказка UI; правило формы — maxLength(3)
}
validate(model.$.frameworks, [required(), maxLength(3)]);`}
          >
            <FormField control={form.frameworks} />
          </ExampleCard>

          <ExampleCard
            title="SelectMulti"
            description="Popover + свой listbox (без cmdk). Сводка вместо чипов при >2 выбранных"
            bgColor="bg-white"
            code={`componentProps: {
  options: COUNTRIES, // поддерживает group
  clearable: true,
  summaryThreshold: 2,
}
// для асинхронного источника: resource={{ type: 'partial', load }}
// и selectedOptions — лейблы выбранного вне текущей страницы`}
          >
            <FormField control={form.countries} />
          </ExampleCard>

          <ExampleCard
            title="NativeSelectMulti"
            description="Нативный <select multiple>: no-JS/legacy. Здесь — nullable-поле"
            bgColor="bg-white"
            code={`// days: string[] | null, начальное null — пустой выбор хранится как null
model: model.$.days,
componentProps: {
  options: DAYS,
  rows: 5, // нативный size, число видимых строк
}
// placeholder отсутствует намеренно: в листбоксе
// <option value=""> стал бы выбираемым пунктом`}
          >
            <FormField control={form.days} />
          </ExampleCard>

          <ExampleCard
            title="Префилл выбранного"
            description="Выбранное — начальное значение поля; reset() возвращает его"
            bgColor="bg-white"
            code={`createForm<Form>({
  initial: { ...INITIAL, skills: ['ts', 'react'] },
  schema: buildSchema,
})`}
          >
            <FormField control={form.skills} />
          </ExampleCard>
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={handleValidate} data-testid="btn-validate">
            Проверить
          </Button>
          <Button variant="outline" onClick={handleSnapshot} data-testid="btn-snapshot">
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
