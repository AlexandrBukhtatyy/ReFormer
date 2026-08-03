/**
 * Эмиттер `index.tsx` — сборка формы ОДНИМ проходом (§7): `createJsonForm` бандлит model+form+registry
 * из схемы `./schema`, бандл целиком отдаётся рендереру пропом `form`. Схема больше не передаётся
 * дважды (в `convertJsonToM1Tree` и пропом `schema`).
 *
 * @module reformer-builder/codegen/emit-index
 */

import type { Names } from './naming';

export function emitIndex(n: Names): string {
  return `// index.tsx — сборка формы одним проходом: createJsonForm → JsonFormRenderer (проп form).

import { useMemo, useState } from 'react';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { schema } from './schema';
import { createRegistry } from './registry';
import { ${n.modelFactory} } from './model';
import { formBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './renderer.behavior';
import type { ${n.TypeName} } from './types';

type SubmitResult = { message: string; ok: boolean };

// ./schema типизирована как loose JsonFormSchema (машинно-сгенерирована); сужаем к форме модели.
const typedSchema = schema as unknown as JsonFormSchema<${n.TypeName}>;

export default function ${n.pageComponent}() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Сборка одним проходом (§7): createJsonForm бандлит model+form+registry из одной схемы;
  // useJsonForm (ленивый useState) держит бандл стабильным между рендерами.
  const jsonForm = useJsonForm(() =>
    createJsonForm<${n.TypeName}>({
      schema: typedSchema,
      registry: createRegistry(),
      model: ${n.modelFactory}(),
      behavior: formBehavior,
    })
  );

  const renderBehavior = useMemo(
    () =>
      createJsonRenderBehavior(jsonForm.form, jsonForm.model, {
        onResult: (message, ok) => setResult({ message, ok }),
      }),
    [jsonForm]
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">${n.title}</h1>
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
        <JsonFormRenderer<${n.TypeName}>
          form={jsonForm}
          renderBehavior={renderBehavior}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}
`;
}
