/**
 * «Список алертов из модели» — итерация массива модели в renderer-json через компонент.
 *
 * В JSX только провайдер реестра и рендерер. Массив `alerts` живёт в модели; behavior пересобирает
 * его при вводе (см. form-setup.ts), а узел `{ array, component: '$component(List)', item: {$template} }`
 * рендерит его: `List` оформляет список, `Alert` на каждый элемент получает `type`/`message` через
 * `$model(...)`. Введите сумму (> 1 000 000 или < 10 000) или email без «@» — набор алертов меняется.
 */
import { JsonFormRenderer, JsonRendererProvider, useJsonForm } from '@reformer/renderer-json';
import { createAlertsSetup, type AlertsFormData } from './form-setup';

export default function AlertsListRendererJson() {
  // Сборка одним проходом (§7): бандл createJsonForm, стабильный через useJsonForm (ленивый useState).
  const jsonForm = useJsonForm(() => createAlertsSetup());

  return (
    <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
      <JsonFormRenderer<AlertsFormData> form={jsonForm} validateSchema={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
