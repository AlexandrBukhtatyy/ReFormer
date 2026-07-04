// index.tsx — entry + whole form wiring (renderer-react / M1).
// createModel → createForm({ model, schema, behavior }) → createRenderSchema (+ render behavior)
// → <FormRenderer settings={{ fieldWrapper: FormField }} />. All 6 steps + 3 arrays live in
// renderer.schema.ts; this file only wires the pieces together (stable instance via useMemo).

import { useMemo } from 'react';
import { createForm } from '@reformer/core';
import { FormRenderer, createRenderSchema } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';
import { createCreditApplicationModel } from './model';
import { creditApplicationBehavior } from './form.behavior';
import { buildCreditApplicationSchema } from './renderer.schema';
import { makeCreditRenderBehavior } from './renderer.behavior';

export default function CreditApplicationRendererReactV20() {
  const schema = useMemo(() => {
    const model = createCreditApplicationModel();

    // Form built from the tree WITHOUT `form` (harvest leaves incl. steps[].body + arrays);
    // behavior (compute/enableWhen/copyFrom/onChange) is attached here.
    const form = createForm<CreditApplicationForm>({
      model,
      schema: buildCreditApplicationSchema(model),
      behavior: creditApplicationBehavior,
    });

    // Render schema: same tree, but `form` is passed to the wizard node for rendering.
    const renderSchema = createRenderSchema<CreditApplicationForm>(() =>
      buildCreditApplicationSchema(model, form)
    );

    // Attach declarative render behavior (hideWhen conditional sections + submit).
    makeCreditRenderBehavior(model, (result) => {
      alert(result.message);
    })(renderSchema);

    return renderSchema;
  }, []);

  return (
    <div className="mx-auto  p-6">
      <h1 className="mb-6 text-2xl font-bold">Заявка на кредит (renderer-react v20)</h1>
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
