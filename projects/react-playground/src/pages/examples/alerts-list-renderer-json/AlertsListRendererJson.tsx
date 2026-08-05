/**
 * «Список алертов из модели» — итерация массива модели в renderer-json через компонент.
 *
 * Форма живёт не здесь, а в реестре форм (`form-setup.ts` → `alertsFormEntry`, регистрация в
 * `src/forms/registry.ts`). Страница только указывает, какую форму смонтировать. Так микрофронт
 * может отдать форму, а хост — решить, где её показать: ровно то, ради чего заведён реестр.
 *
 * Сам пример: массив `alerts` живёт в модели, behavior пересобирает его при вводе, а узел
 * `{ array, component: '$component(List)', item: {$template} }` его рендерит — `List` оформляет
 * список, `Alert` на каждый элемент получает `type`/`message` через `$model(...)`. Введите сумму
 * (> 1 000 000 или < 10 000) или email без «@» — набор алертов меняется.
 */
import { FormOutlet } from '@reformer/form-registry/react';
import type { AlertsFormData } from './form-setup';

export default function AlertsListRendererJson() {
  return <FormOutlet<AlertsFormData> id="alerts-list" />;
}
