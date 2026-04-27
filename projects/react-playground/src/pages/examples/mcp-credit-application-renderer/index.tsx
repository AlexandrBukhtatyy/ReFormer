import { useMemo } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { creditApplicationForm } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';

// ─── Page component ──────────────────────────────────────────────────────────

export default function McpCreditApplicationRenderer() {
  const schema = useMemo(() => createCreditApplicationRenderSchema(creditApplicationForm), []);

  return (
    <div className="w-full">
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
