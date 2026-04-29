/**
 * Iter-8 — credit-application form (target=renderer-react)
 *
 * Page entry. Builds form once via `useMemo`, builds RenderSchema once via
 * `useMemo`, mounts `<FormRenderer>` with `FormField` as field wrapper.
 *
 * Includes a dev-only "Fill with test data" button that calls
 * `form.setValue(happyPathFixture)` so orchestrator can step through the
 * wizard to submit without any manual input.
 */

import { useMemo } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

import { createCreditApplicationForm } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';
import { happyPathFixture } from './data-fixture';

export default function McpCreditApplicationRendererV8() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => form.setValue(happyPathFixture)}
          data-testid="fill-fake-data"
          className="mb-4 px-3 py-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300"
        >
          🎭 Заполнить тестовыми данными
        </button>
      )}
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
