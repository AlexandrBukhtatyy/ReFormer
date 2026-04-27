import { useMemo, useState } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { creditApplicationForm } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';

// ─── Page component ──────────────────────────────────────────────────────────

export default function McpCreditApplicationRenderer() {
  const schema = useMemo(() => createCreditApplicationRenderSchema(creditApplicationForm), []);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  const handleSubmit = async () => {
    setSubmittedAt(Date.now());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (creditApplicationForm as any).submit?.((values: unknown) => {
      console.log('Renderer-react credit application submitted', values);
    });
  };

  return (
    <div className="w-full">
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-lg bg-blue-500 px-6 py-2 text-white"
        >
          Отправить заявку
        </button>
        {submittedAt && (
          <span className="text-sm text-gray-500">
            Submit вызван в {new Date(submittedAt).toLocaleTimeString()} (см. console + ошибки под
            полями)
          </span>
        )}
      </div>
    </div>
  );
}
