/**
 * Реестр компонентов формы «test-01» — что рендерить под каждое `$component(...)` из form.json.
 * `FIELD_WRAPPER` (FormField) оборачивает каждый лист: label + ошибки. Добавили в схему новый
 * `$component(X)` — зарегистрируйте X здесь (field-компоненты ui-kit: `XField`). Docs: @reformer/renderer-json.
 */
import { InputField, FormField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
  });
}
