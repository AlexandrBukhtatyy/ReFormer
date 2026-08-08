/**
 * Поведение UI формы «test-02» — правила над деревом рендера по selector'ам из form.json.
 * Здесь висит submit визарда: ui-kit FormWizard зовёт `onSubmit` на последнем шаге, а мы гоняем
 * валидацию модели и отправляем значения. Docs: @reformer/renderer-react render-behavior.
 *
 * Это ФАБРИКА: ни форма, ни модель из схемы рендера не достаются, поэтому приходят замыканием из
 * index.tsx. Через неё же визард получает `form`: корневому узлу рендерер форму пропом не отдаёт,
 * поэтому кладём её в `componentProps` на onInit — как в примерах renderer-json.
 */
import { onComponentEvent, onInit, type RenderBehaviorFn } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { formValidation } from './validation';
import type { FormShape } from './model';

export function createRenderBehavior(
  form: FormProxy<FormShape>,
  model: FormModel<FormShape>
): RenderBehaviorFn<FormShape> {
  return (schema) => {
    // Визард — self-managed компонент: форму ему передаём явно.
    onInit(schema.node('wizard'), () => {
      schema.node('wizard').patchProps({ form });
    });

    onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: FormShape) => {
      if (!(await validateModel(model, formValidation))) return;
      // TODO: отправка на бэкенд.

      console.info('[test-02] submit', values);
    });

    // ── Шпаргалка ──
    // hideWhen(schema.node('address'), () => !model.get().city);
    // onInit(schema.node('wizard'), () => schema.node('wizard').patchProps({ scrollToTop: true }));
  };
}
