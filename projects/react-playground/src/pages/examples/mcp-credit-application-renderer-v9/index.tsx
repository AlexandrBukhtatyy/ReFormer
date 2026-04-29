/**
 * Iter-9 — credit-application form (target: renderer-react).
 *
 * Wizard pair: A=A1 (FormWizard from `@reformer/ui-kit/form-wizard`),
 *              B=B2 (renderer-react RenderNode subtree as `step.body`).
 *
 * Patches under test:
 *  - Patch G + ui-kit Path C — A1 default for ui-kit stacks; polymorphic step.body.
 *  - Patch H — camelCase componentProps.
 *  - Patch I — computeFrom group-node subscription, no `as never`.
 *  - Patch J — `path.X` only inside RenderSchema callback; `form.X` is never
 *    used to feed RenderNode.component (that path causes silent renderer skip).
 *  - D1 / D3 — options live in createForm; FormArray initialValue is plain leaves.
 */

import { useMemo } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { createCreditApplicationForm } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';
import { happyPathFixture } from './data-fixture';

export default function McpCreditApplicationRendererV9() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async (values: unknown) => {
    // eslint-disable-next-line no-console
    console.log('[mcp-credit-application-renderer-v9] submit', values);
    // Simple visual confirmation; the spec mock-API is out of scope per brief.
    if (typeof window !== 'undefined') {
      window.alert('Заявка отправлена (mock)');
    }
  };

  const schema = useMemo(
    () => createCreditApplicationRenderSchema(form, handleSubmit),
    // handleSubmit is stable for the lifetime of the page; we intentionally
    // only key on `form` here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  );

  const fillFakeData = () => {
    form.setValue(happyPathFixture);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Заявка на кредит</h1>
        <button
          type="button"
          onClick={fillFakeData}
          data-testid="fill-fake-data"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-amber-500 text-white shadow hover:bg-amber-600 h-9 px-4 py-2"
        >
          Заполнить тестовыми данными
        </button>
      </header>

      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
