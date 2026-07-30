/**
 * Эмиттер `index.tsx` — сборка формы (модель + registry + behavior → JsonFormRenderer). Импорт
 * схемы из `./schema` (типизирован, без каста).
 *
 * @module reformer-builder/codegen/emit-index
 */

import type { Names } from './naming';

export function emitIndex(n: Names): string {
  return `// index.tsx — сборка формы: модель + registry + behavior → JsonFormRenderer.

import { useMemo, useState } from 'react';
import { createForm } from '@reformer/core';
import { JsonFormRenderer, JsonRendererProvider, convertJsonToM1Tree } from '@reformer/renderer-json';
import { schema } from './schema';
import { createRegistry } from './registry';
import { ${n.modelFactory} } from './model';
import { formBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './renderer.behavior';
import type { ${n.TypeName} } from './types';

type SubmitResult = { message: string; ok: boolean };

export default function ${n.pageComponent}() {
  const [result, setResult] = useState<SubmitResult | null>(null);
  const registry = useMemo(() => createRegistry(), []);

  const { model, form } = useMemo(() => {
    const model = ${n.modelFactory}();
    const form = createForm<${n.TypeName}>({
      model,
      schema: convertJsonToM1Tree(schema, registry, model),
      behavior: formBehavior,
    });
    return { model, form };
  }, [registry]);

  const renderBehavior = useMemo(
    () =>
      createJsonRenderBehavior(form, model, {
        onResult: (message, ok) => setResult({ message, ok }),
      }),
    [form, model]
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

      <JsonRendererProvider settings={{ registry, model }}>
        <JsonFormRenderer<${n.TypeName}>
          schema={schema}
          renderBehavior={renderBehavior}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}
`;
}
