// @reformer-generated 1ab76239bc20
// steps/kontakty/form.render.ts — render-слой шага «Контакты»: условная видимость и
// события узлов шага. Вызывается из корневого form.render.ts.

import type { RenderSchemaProxy } from '@reformer/renderer-react';
import type { FormModel, FormProxy } from '@reformer/core';
import type { W04SplitForm } from '../../types';

export function stepRender(
  schema: RenderSchemaProxy<W04SplitForm>,
  ctx: { form: FormProxy<W04SplitForm>; model: FormModel<W04SplitForm> }
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
