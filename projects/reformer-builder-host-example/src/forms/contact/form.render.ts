// form.render.ts — рантайм-обвязка (submit, условная видимость, события узлов).

import { onComponentEvent, onMount, type RenderBehaviorFn } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { notify } from '../../notifications/notifications';
import { loadCityOptions } from '../../services/cities';
import { formValidation } from './form.validation';
import { submitForm } from './api';
import type { ContactForm } from './types';

export type RenderBehaviorOptions = { onResult?: (message: string, ok: boolean) => void };

export function createJsonRenderBehavior(
  form: FormProxy<ContactForm>,
  model: FormModel<ContactForm>,
  options: RenderBehaviorOptions = {}
): RenderBehaviorFn<ContactForm> {
  const { onResult } = options;
  return (schema) => {
    // Список городов — из API приложения, через его сервис: в схеме у поля опций нет.
    // Пропсы ПОЛЯ меняет его узел формы; `schema.node(…).patchProps` действует на контейнеры.
    onMount(schema.node('city'), () => {
      let cancelled = false;
      loadCityOptions().then(
        (cities) => {
          if (!cancelled) form.city.updateComponentProps({ options: cities });
        },
        (error: unknown) => {
          if (!cancelled) notify(error instanceof Error ? error.message : String(error), 'error');
        }
      );
      return () => {
        cancelled = true;
      };
    });

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
  };
}
