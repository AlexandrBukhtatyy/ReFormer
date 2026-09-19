// @reformer-generated 3dab6aeaeece
// renderer.behavior.ts — рантайм-обвязка (submit, условная видимость, события узлов).

import {
  hideWhen,
  onComponentEvent,
  onInit,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { formValidation, makeValidationConfig } from './validation';
import { submitForm } from './api';
import type { W03Form } from './types';

export type RenderBehaviorOptions = { onResult?: (message: string, ok: boolean) => void };

export function createJsonRenderBehavior(
  form: FormProxy<W03Form>,
  model: FormModel<W03Form>,
  options: RenderBehaviorOptions = {}
): RenderBehaviorFn<W03Form> {
  const { onResult } = options;
  return (schema) => {
    void form; // используется в условиях hideWhen (form.<поле>.value.value)
    void hideWhen;

    const wizard = schema.node('wizard');

    // Визард — self-managed компонент: форму и пошаговую проверку ему передаём явно.
    // Без `config` «Далее» не проверяет шаг вовсе и пропускает пустые обязательные поля.
    onInit(wizard, () => wizard.patchProps({ form, config: makeValidationConfig(model) }));

    onComponentEvent(wizard, 'onSubmit', async () => {
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

    // Условная видимость секций — раскомментируйте и впишите условие:
    // hideWhen(schema.node('dannye-section'), () => /* TODO: условие для «Данные» */ false);
    // hideWhen(schema.node('kontakty-section'), () => /* TODO: условие для «Контакты» */ false);
  };
}
