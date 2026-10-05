// index.tsx — точка входа: сборка формы и рендерер.
// Сборка ОДНИМ вызовом: createForm({ model, schema, behavior, validation }) →
// <FormRenderer form={…} settings={{ fieldWrapper: FormField }} />. Все 6 шагов и 3 массива живут в
// renderer.schema.tsx; визард — узел схемы, форму и валидацию он берёт из сборки сам.

import { createForm, useFormBundle } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';
import { createCreditApplicationModel } from './model';
import { makeCreditApplicationBehavior } from './form.behavior';
import { buildCreditApplicationSchema } from './renderer.schema';
import { creditValidation } from './validation';

export default function CreditApplicationRendererReactV20() {
  const creditForm = useFormBundle(() =>
    createForm<CreditApplicationForm>({
      model: createCreditApplicationModel(),
      schema: buildCreditApplicationSchema,
      // Колбэк хоста замыкается здесь — фабрика сборки зовётся один раз, поэтому ссылка стабильна.
      behavior: makeCreditApplicationBehavior((result) => {
        alert(result.message);
      }),
      validation: creditValidation,
    })
  );

  return (
    <div className="mx-auto  p-6">
      <h1 className="mb-6 text-2xl font-bold">Заявка на кредит (renderer-react v20)</h1>
      <FormRenderer form={creditForm} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
