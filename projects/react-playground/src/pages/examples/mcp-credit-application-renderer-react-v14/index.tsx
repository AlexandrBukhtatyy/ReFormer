import { useMemo } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import {
  createCreditApplicationForm,
  createCreditApplicationRenderSchema,
} from './schema';

export default function MccaRendererReactV14Page() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async () => {
    const values = form.getValue();
    console.log('[mcp-credit-renderer-react-v14] submit', values);
    alert('Заявка отправлена');
  };

  const schema = useMemo(
    () => createCreditApplicationRenderSchema(form, handleSubmit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">
        MCP Credit Application — renderer-react v14
      </h1>
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
