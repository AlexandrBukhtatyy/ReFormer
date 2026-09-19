/**
 * Реестр компонентов формы «test-02» — что рендерить под каждое `$component(...)` из form.json.
 * `FIELD_WRAPPER` (FormField) оборачивает каждый лист: label + ошибки. `Wizard` — локальный
 * адаптер (wizard.tsx); тело каждого шага — `Step` оттуда же. Docs: @reformer/renderer-json.
 */
import { CheckboxWithLabel, FormField, Input } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { Step, Wizard } from './wizard';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);
    // Контейнеры: визард и тела шагов.
    reg.component('Wizard', Wizard);
    reg.component('Step', Step);
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', Input);
    reg.component('Checkbox', CheckboxWithLabel);
  });
}
