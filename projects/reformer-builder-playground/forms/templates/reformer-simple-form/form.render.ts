// @reformer-generated a671e30d0f1f
// form.render.ts — рантайм-обвязка (submit, условная видимость, события узлов).

import { hideWhen, onComponentEvent, type RenderBehaviorFn } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { formValidation } from './form.validation';
import { submitForm } from './api';
import type { ReformerSimpleFormForm } from './types';

export type RenderBehaviorOptions = { onResult?: (message: string, ok: boolean) => void };

export function createJsonRenderBehavior(
  form: FormProxy<ReformerSimpleFormForm>,
  model: FormModel<ReformerSimpleFormForm>,
  options: RenderBehaviorOptions = {}
): RenderBehaviorFn<ReformerSimpleFormForm> {
  const { onResult } = options;
  return (schema) => {
    void form; // используется в условиях hideWhen (form.<поле>.value.value)

    const submit = schema.node('submit');

    onComponentEvent(submit, 'onClick', async () => {
      // `touch: true` обязателен: киты показывают ошибку только у ТРОНУТОГО поля
      // (`invalid && (touched || dirty)`). Без него неудачная отправка выглядела бы так,
      // будто кнопка не работает: форма не отправлена, а почему — нигде не сказано.
      if (!(await validateModel(model, formValidation, { touch: true }))) {
        onResult?.('Проверьте заполнение формы', false);
        return;
      }
      const res = await submitForm(model.get());
      onResult?.(res.success ? 'Форма отправлена' : res.error, res.success);
    });

    // Правила render-слоя (из правил формы — правьте здесь или в панели правил):
    hideWhen(
      schema.node('full-name'),
      () => !form.lastName.value.value || !form.firstName.value.value
    );
  };
}
