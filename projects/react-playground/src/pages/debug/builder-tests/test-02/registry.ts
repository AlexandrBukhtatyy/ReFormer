/**
 * Реестр компонентов формы «test-02» — что рендерить под каждое `$component(...)` из form.json.
 * `FIELD_WRAPPER` (FormField) оборачивает каждый лист: label + ошибки. `Wizard` — локальный
 * адаптер (wizard.tsx); шаги визарда рендерятся как обычные `Box`-узлы. Docs: @reformer/renderer-json.
 */
import { Box, CheckboxField, FormField, InputField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { Wizard } from './wizard';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);
    // Контейнеры: визард и тела шагов.
    reg.component('Wizard', Wizard);
    reg.component('Box', Box);
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
    reg.component('Checkbox', CheckboxField);
  });
}
