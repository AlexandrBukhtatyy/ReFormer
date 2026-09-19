/**
 * Input с подсказками — свободный ввод, список лишь помогает набрать текст.
 *
 * Контракт поля не меняется: это обычный `InputField` с `value: string | null`. Режим включает
 * один проп `suggestions` — статический список или асинхронный `ResourceConfig` (как у Select).
 * Отличие от `Combobox creatable`: там значение — выбранная опция, здесь — любой текст.
 */

import { useState } from 'react';
import { createCoreForm, useFormBundle } from '@reformer/core';
import { InputField, FormField, ExampleCard, Button } from '@reformer/ui-kit';
import type { ResourceConfig } from '@reformer/cdk/option-source';

interface InputSuggestDemoForm {
  city: string | null;
  position: string | null;
  company: string | null;
}

const CITIES = [
  'Москва',
  'Мурманск',
  'Санкт-Петербург',
  'Казань',
  'Новосибирск',
  'Нижний Новгород',
];

const POSITIONS = [
  { value: 'Frontend-разработчик', label: 'Frontend-разработчик (React, TypeScript)' },
  { value: 'Backend-разработчик', label: 'Backend-разработчик (Node.js, Go)' },
  { value: 'Дизайнер интерфейсов' },
  { value: 'Аналитик' },
];

const COMPANIES = Array.from({ length: 60 }, (_, i) => `Компания ${i + 1}`).concat([
  'Рога и копыта',
  'Ромашка',
  'Роснефтегаз',
]);

/** Серверный поиск: фильтрация и пагинация «на бэке», с задержкой сети. */
const companiesResource: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 10,
  load: async ({ search = '', page = 1, pageSize = 10 } = {}) => {
    await new Promise((r) => setTimeout(r, 400));
    const q = String(search).toLowerCase();
    const found = COMPANIES.filter((c) => c.toLowerCase().includes(q));
    const items = found
      .slice((page - 1) * pageSize, page * pageSize)
      .map((c) => ({ id: c, label: c, value: c }));
    return { items, totalCount: found.length };
  },
};

export default function InputSuggestDemo() {
  const { form, model } = useFormBundle(() =>
    createCoreForm<InputSuggestDemoForm>({
      initial: { city: null, position: null, company: null },
      schema: (m) => ({
        fields: [
          {
            value: m.$.city,
            component: InputField,
            componentProps: {
              label: 'Город',
              testId: 'city',
              placeholder: 'Начните вводить или впишите свой',
              suggestions: CITIES,
            },
          },
          {
            value: m.$.position,
            component: InputField,
            componentProps: {
              label: 'Должность',
              testId: 'position',
              placeholder: 'Выберите или введите',
              suggestions: POSITIONS,
              openOnFocus: true,
            },
          },
          {
            value: m.$.company,
            component: InputField,
            componentProps: {
              label: 'Компания',
              testId: 'company',
              placeholder: 'От 2 символов',
              suggestions: companiesResource,
              minChars: 2,
            },
          },
        ],
      }),
    })
  );

  const [snapshot, setSnapshot] = useState<string | null>(null);

  return (
    <div className="mx-auto p-6">
      <h2 className="mb-2 text-2xl font-bold">Input с подсказками</h2>
      <p className="mb-6 text-gray-600">
        Значение — всегда введённый текст (<code>string | null</code>). Подсказка лишь подставляет
        свой <code>value</code>; можно оставить и любой свой вариант.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ExampleCard
          title="Статический список"
          description="suggestions: string[]"
          bgColor="bg-white"
          code={`componentProps: {
  suggestions: ['Москва', 'Казань', …],
}`}
        >
          <FormField control={form.city} />
        </ExampleCard>

        <ExampleCard
          title="value ≠ label"
          description="Подпись в списке длиннее, в поле уходит value; список при фокусе"
          bgColor="bg-white"
          code={`componentProps: {
  suggestions: [{ value: 'Аналитик' }, { value, label }],
  openOnFocus: true,
}`}
        >
          <FormField control={form.position} />
        </ExampleCard>

        <ExampleCard
          title="Серверный поиск"
          description="ResourceConfig type=partial: debounce, пагинация при скролле"
          bgColor="bg-white"
          code={`componentProps: {
  suggestions: { type: 'partial', pageSize: 10, load },
  minChars: 2,
}`}
        >
          <FormField control={form.company} />
        </ExampleCard>
      </div>

      <div className="mt-6 flex gap-2">
        <Button
          data-testid="snapshot"
          onClick={() => setSnapshot(JSON.stringify(model.get(), null, 2))}
        >
          Показать значение
        </Button>
      </div>
      {snapshot && (
        <pre data-testid="snapshot-output" className="mt-4 rounded bg-gray-100 p-4 text-sm">
          {snapshot}
        </pre>
      )}
    </div>
  );
}
