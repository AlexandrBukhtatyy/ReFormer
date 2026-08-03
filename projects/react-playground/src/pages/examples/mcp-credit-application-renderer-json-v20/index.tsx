// index.tsx — entry: build the form bundle from the JSON schema in ONE pass
// (createJsonForm) and render it via JsonFormRenderer with the `form` prop. The whole
// 6-step wizard lives in renderer.schema.json; runtime wiring (submit / validation /
// conditional sections) lives in the render-behavior.

import { useMemo, useState } from 'react';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import rawJsonSchema from './renderer.schema.json';
import { createRegistry } from './registry';
import { createCreditModel } from './model';
import { creditBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './renderer.behavior';
import type { CreditApplicationForm } from './types';

const jsonSchema = rawJsonSchema as unknown as JsonFormSchema<CreditApplicationForm>;

type SubmitResult = { message: string; ok: boolean };

export default function CreditApplicationRendererJsonV20Page() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Сборка одним проходом (§7): бандл createJsonForm, стабильный через useJsonForm (ленивый useState).
  // Модель передаём готовой (createCreditModel материализует все поля, включая условные/вычисляемые,
  // чтобы сигналы behavior существовали); схема конвертируется внутри, наружу — { model, form, registry }.
  const jsonForm = useJsonForm(() =>
    createJsonForm<CreditApplicationForm>({
      schema: jsonSchema,
      registry: createRegistry(),
      model: createCreditModel(),
      behavior: creditBehavior,
    })
  );

  const renderBehavior = useMemo(
    () =>
      createJsonRenderBehavior(jsonForm.form, jsonForm.model, {
        mode: 'create',
        onResult: (message, ok) => setResult({ message, ok }),
      }),
    [jsonForm]
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

      <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
        <JsonFormRenderer<CreditApplicationForm>
          form={jsonForm}
          renderBehavior={renderBehavior}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}
