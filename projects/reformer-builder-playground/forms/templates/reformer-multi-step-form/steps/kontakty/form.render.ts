// @reformer-generated 1583c9817ed7
// steps/kontakty/form.render.ts — render-слой шага «Контакты»: условная видимость и
// события узлов шага. Вызывается из корневого form.render.ts.

import type { RenderSchemaProxy } from '@reformer/renderer-react';
import type { FormModel, FormProxy } from '@reformer/core';
import type { ReformerMultiStepFormForm } from '../../types';

export function stepRender(
  schema: RenderSchemaProxy<ReformerMultiStepFormForm>,
  ctx: { form: FormProxy<ReformerMultiStepFormForm>; model: FormModel<ReformerMultiStepFormForm> }
): void {
  // form и model — под теми же именами, что в корневом form.render.ts: правила переносятся
  // между файлами без правки (условия hideWhen читают form.<поле>.value.value).
  const { form, model } = ctx;
  void schema;
  void form;
  void model;

  // Условная видимость секций шага — раскомментируйте и впишите условие:
  // hideWhen(schema.node('kontakty-section'), () => /* TODO: условие для «Контакты» */ false);
}
