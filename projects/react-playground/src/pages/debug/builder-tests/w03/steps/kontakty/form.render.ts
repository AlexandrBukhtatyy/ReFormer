// @reformer-generated ed014e11b330
// steps/kontakty/form.render.ts — render-слой шага «Контакты»: условная видимость и
// события узлов шага. Вызывается из корневого form.render.ts.

import type { RenderSchemaProxy } from '@reformer/renderer-react';
import type { FormModel, FormProxy } from '@reformer/core';
import type { W03Form } from '../../types';

export function stepRender(
  schema: RenderSchemaProxy<W03Form>,
  ctx: { form: FormProxy<W03Form>; model: FormModel<W03Form> }
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
