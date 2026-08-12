// index.tsx — entry + whole form wiring (renderer-react / M1).
// Сборка ОДНИМ вызовом: createReactForm({ model, schema, behavior, renderBehavior }) →
// <FormRenderer form={…} settings={{ fieldWrapper: FormField }} />. All 6 steps + 3 arrays live in
// renderer.schema.ts; двойной проход по билдеру (без формы — для нод, с формой — для рендера)
// делает сама фабрика.

import { FormRenderer, createReactForm, useReactForm } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';
import { createCreditApplicationModel } from './model';
import { creditApplicationBehavior } from './form.behavior';
import { buildCreditApplicationSchema } from './renderer.schema';
import { makeCreditRenderBehavior } from './renderer.behavior';

export default function CreditApplicationRendererReactV20() {
  const creditForm = useReactForm(() =>
    createReactForm<CreditApplicationForm>({
      model: createCreditApplicationModel(),
      schema: buildCreditApplicationSchema,
      behavior: creditApplicationBehavior,
      // hideWhen для условных секций + submit. Колбэк хоста замыкается здесь — фабрика зовётся
      // один раз, поэтому ссылка стабильна.
      renderBehavior: (_form, model) =>
        makeCreditRenderBehavior(model, (result) => {
          alert(result.message);
        }),
    })
  );

  return (
    <div className="mx-auto  p-6">
      <h1 className="mb-6 text-2xl font-bold">Заявка на кредит (renderer-react v20)</h1>
      <FormRenderer form={creditForm} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
