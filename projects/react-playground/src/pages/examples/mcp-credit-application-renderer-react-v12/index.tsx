// MCP-only sandbox iter-12 / renderer-react.
// Page mounting: createForm + createRenderSchema + FormRenderer with FormField as fieldWrapper.
import { useMemo, useState } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import {
  createCreditApplicationForm,
  createCreditApplicationRenderSchema,
  type CreditApplicationForm,
} from './schema';

export default function McpCreditApplicationRendererReactV12Page() {
  const [submitted, setSubmitted] = useState<CreditApplicationForm | null>(null);

  const form = useMemo(() => createCreditApplicationForm(), []);
  const schema = useMemo(
    () =>
      createCreditApplicationRenderSchema(form, async (values) => {
        // Simulated network round-trip
        await new Promise((r) => setTimeout(r, 200));
        setSubmitted(values);
      }),
    [form]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Заявка на кредит — renderer-react v12</h1>
        <p className="text-sm text-gray-600">
          MCP-only sandbox · iter-12 · renderer-react · schema-driven via createRenderSchema + FormWizard
        </p>
      </header>

      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />

      {submitted && (
        <section
          data-testid="submission-result"
          className="rounded border border-green-300 bg-green-50 p-4"
        >
          <h2 className="font-semibold text-green-800">Заявка отправлена</h2>
          <pre className="max-h-72 overflow-auto text-xs">
            {JSON.stringify(submitted, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
