/**
 * Реестр примера «Список алертов». Помимо полей ввода регистрирует:
 * - `List` (@reformer/ui-kit) — компонент-обёртка display-списка (`$component(List)` в схеме);
 * - `Alert` — display-компонент элемента: получает поля элемента (`type`/`message`) как пропсы через
 *   `$model(...)` в `$template` (рендерер разворачивает сигналы в значения).
 */
import { InputField, FormField, List } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

const ALERT_STYLES: Record<string, string> = {
  info: 'border-blue-300 bg-blue-50 text-blue-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-800',
  error: 'border-red-300 bg-red-50 text-red-800',
};

/** Display-элемент списка: только показывает данные элемента, ничего не редактирует. */
function Alert({ type = 'info', message }: { type?: string; message?: string }) {
  return (
    <div
      role="alert"
      className={`rounded-md border px-3 py-2 text-sm ${ALERT_STYLES[type] ?? ALERT_STYLES.info}`}
    >
      {message}
    </div>
  );
}

export function createAlertsRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    reg.component('Input', InputField);
    reg.component('List', List);
    reg.component('Alert', Alert);
  });
}
