// index.tsx — entry: build model + form from the JSON schema, then render via
// JsonFormRenderer. The whole 6-step wizard lives in renderer.schema.json; runtime
// wiring (submit / validation / conditional sections) lives in the render-behavior.

import { useMemo, useState } from 'react';
import { createForm } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  convertJsonToM1Tree,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import rawJsonSchema from './renderer.schema.json';
import { createRegistry } from './registry';
import { createCreditModel } from './model';
import { creditBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './renderer.behavior';
import type { CreditApplicationForm } from './types';

const jsonSchema = rawJsonSchema as unknown as JsonFormSchema;

type SubmitResult = { message: string; ok: boolean };

export default function CreditApplicationRendererJsonV20Page() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  const registry = useMemo(() => createRegistry(), []);

  const { model, form } = useMemo(() => {
    const model = createCreditModel();
    const form = createForm<CreditApplicationForm>({
      model,
      schema: convertJsonToM1Tree(jsonSchema, registry, model),
      behavior: creditBehavior,
    });
    return { model, form };
  }, [registry]);

  const renderBehavior = useMemo(
    () =>
      createJsonRenderBehavior(form, model, {
        mode: 'create',
        onResult: (message, ok) => setResult({ message, ok }),
      }),
    [form, model]
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

      <JsonRendererProvider settings={{ registry, model }}>
        <JsonFormRenderer<CreditApplicationForm>
          schema={jsonSchema}
          renderBehavior={renderBehavior}
          validate={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}
