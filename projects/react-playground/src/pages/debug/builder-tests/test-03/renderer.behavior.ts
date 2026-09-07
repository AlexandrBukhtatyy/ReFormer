// @reformer-generated dc2c46a0e5ca
// renderer.behavior.ts — рантайм-обвязка (submit, условная видимость, события узлов).

import { hideWhen, onComponentEvent, type RenderBehaviorFn } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { formValidation } from './validation';
import { submitForm } from './api';
import type { Test03Form } from './types';

export type RenderBehaviorOptions = { onResult?: (message: string, ok: boolean) => void };

export function createJsonRenderBehavior(
  form: FormProxy<Test03Form>,
  model: FormModel<Test03Form>,
  options: RenderBehaviorOptions = {}
): RenderBehaviorFn<Test03Form> {
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
