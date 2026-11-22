// @reformer-form-build 8d82c9716047c882 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Поведение формы «Регистрация» — связи над моделью и правила узлов схемы.
 */
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';
import { formValidation } from './form.validation';
import { submitForm } from './api';
import type { RegistratsiyaShape } from './model';

export const formBehavior = defineFormBehavior<RegistratsiyaShape>(({ model, schema }) => {
  // События компонентов, эффекты рендера и хуки узлов схемы — по `selector`.
  onComponentEvent(schema.node('submit'), 'onClick', async () => { if (await validateModel(model, formValidation, { touch: true })) await submitForm(model.get()); });
});
