/**
 * Примеры множественного выбора — четыре контрола @reformer/ui-kit с одним контрактом значения.
 *
 * Демо намеренно показывает не только «как выбрать», но и три места, где мультивыбор ломается
 * молча, если сделать «как обычно»:
 *  - начальное значение `[]` вместо `null` (поле исчезает: массив в модели даёт ArrayNode);
 *  - `model.$.<path>` вместо `model.signalAt(path)!` (у типа `T[]` это не сигнал);
 *  - префилл до сборки формы (в `seed`) вместо `setup`.
 */

import { useState } from 'react';
import { createCoreForm, useFormBundle, type FormModel } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, maxLength } from '@reformer/core/validators';
import { ValidationMessagesProvider, createMessageResolver } from '@reformer/cdk';
import {
  SelectMultiField,
  NativeSelectMultiField,
  ToggleGroupMultiField,
  FormField,
  ExampleCard,
  Button,
} from '@reformer/ui-kit';
// Combobox — тяжёлый компонент (cmdk), живёт только в сабпате, вне главного barrel.
import { ComboboxMultiField } from '@reformer/ui-kit/combobox';

interface MultiSelectDemoForm {
  /**
   * ВСЕ поля — `string[] | null`, а не `string[]`.
   *
   * Пустой выбор приходит из контрола как `null` (см. `multiValueAdapter`), и начальным значением
   * тоже обязан быть `null`: `createModel({ tags: [] })` строит ArrayNode, `createForm` такой путь
   * пропускает, и поля не появляется вовсе.
   */
  tags: string[] | null;
  frameworks: string[] | null;
  countries: string[] | null;
  days: string[] | null;
  /** Поле с префиллом — показывает правильный порядок «создать форму → положить значение». */
  skills: string[] | null;
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

/** Ранее сохранённый выбор (сценарий редактирования). Кладётся в `setup`, а не в `initial`. */
const PRESELECTED_SKILLS = ['ts', 'react'];

const INITIAL: MultiSelectDemoForm = {
  tags: null,
  frameworks: null,
  countries: null,
  days: null,
  // ВАЖНО: null, а не PRESELECTED_SKILLS — массив в initial модель превратила бы в ArrayNode.
  skills: null,
};

const messages = createMessageResolver({
  required: () => 'Выберите хотя бы один вариант',
  maxLength: (p) => `Не больше ${String(p?.maxLength)} вариантов`,
});

function buildSchema(model: FormModel<MultiSelectDemoForm>) {
  return {
    fields: [
      {
        // `model.signalAt(path)!`, а НЕ `model.$.tags`: у поля типа `T[]` `$`-тип разворачивается
        // в ModelArraySignals, и `$.tags` — контейнер-прокси, а не сигнал. Запись в него не бросает
        // исключение и выглядит успешной, но модель не меняется.
        value: model.signalAt('tags')!,
        component: ToggleGroupMultiField,
        componentProps: {
          label: 'Метки задачи',
          testId: 'tags',
          options: TAGS,
          required: true,
        },
      },
      {
        value: model.signalAt('frameworks')!,
        component: ComboboxMultiField,
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
        value: model.signalAt('countries')!,
        component: SelectMultiField,
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
        value: model.signalAt('days')!,
        component: NativeSelectMultiField,
        componentProps: {
          label: 'Рабочие дни',
          testId: 'days',
          options: DAYS,
          rows: 5,
          description: 'Нативный листбокс: Ctrl+клик и Shift+стрелки. Не для тач-устройств.',
        },
      },
      {
        value: model.signalAt('skills')!,
        component: ComboboxMultiField,
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

// Слой валидации — отдельная схема над моделью. `minLength(1)` тут БЕСПОЛЕЗЕН: он делает ранний
// return на `null`, а пустой выбор приходит именно как `null`. Обязательность — только `required()`.
const demoValidation = defineValidationSchema<MultiSelectDemoForm>(({ model }) => {
  validate(model.signalAt('tags')!, [required()]);
  validate(model.signalAt('frameworks')!, [required(), maxLength(3)]);
  validate(model.signalAt('countries')!, [required()]);
});

export default function MultiSelectDemo() {
  const { form, model } = useFormBundle(() =>
    createCoreForm<MultiSelectDemoForm>({
      initial: { ...INITIAL },
      schema: buildSchema,
      // Префилл — фаза ПОСЛЕ сборки формы: фабрика узлов решает по текущему значению сигнала,
      // и массив на этапе создания дал бы ArrayNode вместо поля.
      setup: ({ model: m }) => {
        m.signalAt('skills')!.value = [...PRESELECTED_SKILLS];
        // Без этого форма считает себя изменённой сразу после загрузки, а `reset()` сотрёт
        // префилл в null: FieldNode.initialValue — снимок на момент конструирования.
        m.captureInitial();
      },
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
          Четыре контрола с единым контрактом значения <code>string[] | null</code>. Пустой выбор —
          всегда <code>null</code>, никогда <code>[]</code>.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExampleCard
            title="ToggleGroupMulti"
            description="2–7 вариантов, все видны сразу. Radix ToggleGroup type=multiple"
            bgColor="bg-white"
            code={`{
  value: model.signalAt('tags')!,
  component: ToggleGroupMultiField,
  componentProps: { options: TAGS },
}
validate(model.signalAt('tags')!, [required()]);`}
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
validate(model.signalAt('frameworks')!, [required(), maxLength(3)]);`}
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
            description="Нативный <select multiple>: no-JS/legacy. Ctrl+клик, Shift+стрелки"
            bgColor="bg-white"
            code={`componentProps: {
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
            description="Порядок: создать форму → положить значение в setup → captureInitial()"
            bgColor="bg-white"
            code={`setup: ({ model: m }) => {
  m.signalAt('skills')!.value = ['ts', 'react'];
  m.captureInitial(); // иначе форма сразу «изменена», а reset() сотрёт префилл
}`}
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
