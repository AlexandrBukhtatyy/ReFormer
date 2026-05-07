// iter-17 / target=renderer-react
// Page entry: mounts FormRenderer with closure schema for credit application.

import { useMemo } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

import {
  createCreditApplicationForm,
  createCreditApplicationRenderSchema,
} from './schema';

export default function MccaRendererReactV17Page() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const schema = useMemo(
    () =>
      createCreditApplicationRenderSchema(form, async () => {
        const values = form.getValue();
        console.log('[mcp-credit-renderer-react-v17] submit:', values);
        alert('Заявка отправлена (см. console)');
      }),
    [form],
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">
        Заявка на кредит (renderer-react v17)
      </h1>
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
