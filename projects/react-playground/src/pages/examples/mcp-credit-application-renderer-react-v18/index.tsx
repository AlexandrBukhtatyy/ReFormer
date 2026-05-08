// MCP-credit-application — iter-18 / renderer-react.
// Stack: createForm + FormSchema (TS) + createRenderSchema + FormRenderer + FormField fieldWrapper.

import { useMemo } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

import { createCreditApplicationForm } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';

export default function MccaRendererReactV18() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async () => {
    const values = form.getValue();
    console.log('mcca-renderer-react-v18 submit:', values);
    alert('Заявка успешно отправлена');
  };

  const schema = useMemo(
    () => createCreditApplicationRenderSchema(form, handleSubmit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Заявка на кредит — renderer-react v18</h1>
        <p className="text-sm text-gray-500">
          MCP-only generation. Stack: createRenderSchema + FormRenderer + FormField fieldWrapper.
        </p>
      </header>

      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
