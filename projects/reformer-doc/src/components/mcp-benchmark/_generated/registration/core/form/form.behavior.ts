// @reformer-form-build 998af6fb7f0a3d10 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Поведение формы «Форма регистрации» — реактивные связи над моделью.
 */
import { defineFormBehavior } from '@reformer/core/behaviors';
import type { FormaRegistratsiiShape } from './model';

export const formBehavior = defineFormBehavior<FormaRegistratsiiShape>(({ model }) => {
  // Поведения в intent не было — добавьте его здесь.
});
