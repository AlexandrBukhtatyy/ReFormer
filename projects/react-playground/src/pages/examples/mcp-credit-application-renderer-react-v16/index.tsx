// Credit application form — renderer-react v16 (MCP-only sandbox iter-16).
//
// Mount: <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
// schema is a RenderSchemaProxy whose root render-node is FormWizard from
// @reformer/ui-kit/form-wizard, with `form` captured via closure into
// componentProps. RenderContextProvider is supplied automatically by FormRenderer.

import { useMemo, useRef, useState } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

import { createCreditApplicationForm } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';

export default function MccaRendererReactV16Page() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const values = form.getValue();
      // Mock API call
      await new Promise((r) => setTimeout(r, 200));
      console.log('credit application submitted:', values);
      setSubmittedAt(new Date().toLocaleString('ru-RU'));
    } finally {
      submittingRef.current = false;
    }
  };

  const schema = useMemo(
    () => createCreditApplicationRenderSchema(form, handleSubmit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Заявка на кредит (MCP renderer-react v16)</h1>
        <p className="text-sm text-gray-500">
          Сгенерировано MCP-only sandbox sub-agent'ом iter-16 для target=renderer-react.
        </p>
      </header>

      {submittedAt && (
        <div
          data-testid="submit-success"
          className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800"
        >
          Заявка отправлена: {submittedAt}
        </div>
      )}

      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
