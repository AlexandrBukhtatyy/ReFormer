// index.tsx — точка входа: сборка формы и рендерер.
// Сборка ОДНИМ вызовом: createForm({ model, schema, registry, behavior, validation }) →
// <FormRenderer form={…} />. Все 6 шагов живут в renderer.schema.json (документ формата 2); визард —
// узел схемы, форму и валидацию он берёт из сборки сам. Отправка и условные секции — в поведении.

import { useState } from 'react';
import { createForm, useFormBundle } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import rawJsonSchema from './renderer.schema.json';
import { createRegistry } from './registry';
import { createCreditModel } from './model';
import { makeCreditBehavior } from './form.behavior';
import { creditValidation } from './validation';
import type { CreditApplicationForm } from './types';

// Чистый JSON импортируется как данные: операторы-строки (`$model(...)`) типизируются как `string`,
// поэтому приводим к JsonFormSchema.
const jsonSchema = rawJsonSchema as unknown as JsonFormSchema<CreditApplicationForm>;

type SubmitResult = { message: string; ok: boolean };

export default function CreditApplicationRendererJsonV20Page() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Сборка ОДНИМ вызовом: модель, дерево из документа (его строит реестр), форма, поведение и
  // валидация. Модель передаём готовой (createCreditModel материализует все поля, включая
  // условные/вычисляемые, чтобы сигналы поведения существовали). Опции места монтирования (`mode`,
  // `onResult`) замыкаются здесь: `useFormBundle` зовёт фабрику один раз, поэтому ссылка стабильна.
  const creditForm = useFormBundle(() =>
    createForm<CreditApplicationForm>({
      model: createCreditModel(),
      schema: jsonSchema,
      registry: createRegistry(),
      behavior: makeCreditBehavior({
        mode: 'create',
        onResult: (message, ok) => setResult({ message, ok }),
      }),
      validation: creditValidation,
    })
  );

  return (
    <div className="mx-auto  p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Заявка на кредит</h1>
        <p className="text-sm text-gray-500">
          Многошаговая форма (renderer-json, v20) — 6 шагов, вычисляемые поля, условные секции и
          массивы.
        </p>
      </header>

      {result && (
        <div
          role="status"
          data-testid="submit-result"
          className={
            'mb-4 rounded-md border p-3 text-sm ' +
            (result.ok
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-800')
          }
        >
          {result.message}
        </div>
      )}

      {/* Обёртку поля рендерер берёт из бандла: её положил туда реестр (запись FIELD_WRAPPER). */}
      <FormRenderer form={creditForm} />
    </div>
  );
}
