// @reformer-form-build eee454ba1f399311 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Реестр компонентов формы «Регистрация»: что рендерить под каждый
 * `$component(...)` из layout-схемы. Новый компонент в схеме → регистрация здесь.
 */
import { FormField, Box, Button, Input, InputPassword } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка листа: label + ошибки. Сборка кладёт её в бандл формы.
    reg.component(FIELD_WRAPPER, FormField);
    reg.component('Box', Box);
    reg.component('Button', Button);
    reg.component('Input', Input);
    reg.component('InputPassword', InputPassword);
  });
}
