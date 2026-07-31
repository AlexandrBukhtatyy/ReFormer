/**
 * «Список алертов из модели» — итерация массива модели в renderer-json через компонент.
 *
 * В JSX только провайдер реестра и рендерер. Массив `alerts` живёт в модели; behavior пересобирает
 * его при вводе (см. form-setup.ts), а узел `{ array, component: '$component(List)', item: {$template} }`
 * рендерит его: `List` оформляет список, `Alert` на каждый элемент получает `type`/`message` через
 * `$model(...)`. Введите сумму (> 1 000 000 или < 10 000) или email без «@» — набор алертов меняется.
 */
import { useMemo } from 'react';
import { JsonFormRenderer, JsonRendererProvider } from '@reformer/renderer-json';
import { createAlertsSetup, alertsJsonSchema, type AlertsFormData } from './form-setup';

export default function AlertsListRendererJson() {
  const { model, registry } = useMemo(() => createAlertsSetup(), []);

  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<AlertsFormData>
        schema={alertsJsonSchema}
        validateSchema={import.meta.env.DEV}
      />
    </JsonRendererProvider>
  );
}
