/**
 * Credit application page (renderer-react v2 — page 2 of MCP-validation iter 2).
 *
 * Stages 1+2+3 combined: schema + validation + behavior + declarative
 * RenderSchema using ui-kit Section/Box. All 6 steps render stacked vertically.
 *
 * Stage 4 will inject FormArray UI (properties/existingLoans/coBorrowers).
 * Stage 5 will add wizard navigation via `schema.node('stepN').setHidden(...)`.
 */
import { useMemo, useState } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { Button, FormField } from '@reformer/ui-kit';
import { creditApplicationForm } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';

export default function McpCreditApplicationRendererV2() {
  // Form is module-level (created once on import). For test isolation we wrap
  // it in useMemo so re-renders don't recreate it.
  const form = useMemo(() => creditApplicationForm, []);
  const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);

  const [submitted, setSubmitted] = useState<unknown>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    const valid = await form.validate();
    const values = form.getValue();
    // eslint-disable-next-line no-console
    console.log('[mcp-credit-renderer-v2] submit', { valid, values });
    setSubmitted({ valid, values });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Заявка на кредит</h1>
      <p className="text-sm text-gray-500">
        Renderer-react TS RenderSchema. Все шаги отображаются вертикально (page 2, stages 1+2+3).
      </p>

      <form onSubmit={handleSubmit} className="space-y-6" data-testid="credit-form">
        <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Button type="submit" data-testid="submit-button">
            Отправить заявку
          </Button>
        </div>
      </form>

      {submitted ? (
        <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto">
          {JSON.stringify(submitted, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
