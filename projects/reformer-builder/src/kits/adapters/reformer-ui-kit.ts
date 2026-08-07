/**
 * Адаптер встроенного кита `@reformer/ui-kit` — ЕДИНСТВЕННОЕ место в билдере, где этот пакет
 * импортируется статически.
 *
 * Раньше эти импорты жили в `preview-runtime/known-components`, из-за чего реестр превью был
 * намертво привязан к одной дизайн-системе (RFC-0001, точка расширения E7: «код, не конфигурация»).
 * Теперь известный кит — просто один из адаптеров: чтобы добавить второй, достаточно положить рядом
 * такой же модуль и зарегистрировать его в реестре китов (этап 3). Загружаться адаптеры должны
 * через `import()`, иначе Vite сложит все киты в главный чанк.
 *
 * Namespace — плоская карта «имя экспорта → значение»: barrel плюс subpath-модули компонентов за
 * optional peer-deps (в barrel их нет), плюс `FormWizard`, на который смотрит
 * `descriptor.adapters.wizard`. Builder-адаптеры `Wizard`/`Step` сюда НЕ входят: они реализованы
 * поверх рендерера и принадлежат билдеру, а не киту (см. `preview-runtime/known-components`).
 *
 * @module reformer-builder/kits/adapters/reformer-ui-kit
 */

import * as UiKit from '@reformer/ui-kit';
// Subpath-экспорты ui-kit: реальные компоненты за optional peer-deps (не в barrel). Явно
// подмешиваем в namespace, чтобы форменные Combobox/Calendar/DatePicker/InputOTP/Table рисовались
// вживую в превью, а не заглушкой «предпросмотр ограничен». Peer-deps проекта установлены.
import * as ComboboxNs from '@reformer/ui-kit/combobox';
import * as CalendarNs from '@reformer/ui-kit/calendar';
import * as DatePickerNs from '@reformer/ui-kit/date-picker';
import * as InputOtpNs from '@reformer/ui-kit/input-otp';
import * as TableNs from '@reformer/ui-kit/table';
// Именованный импорт, а НЕ `import * as` со спредом: спред namespace-объекта отключает
// tree-shaking и утягивает в бандл весь модуль form-wizard (проверено — +140 кБ в чанке App).
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import type { KitNamespace } from '../types';

/** Namespace встроенного кита для резолва компонентов по имени экспорта. */
export const REFORMER_UI_KIT_NAMESPACE: KitNamespace = {
  ...UiKit,
  ...ComboboxNs,
  ...CalendarNs,
  ...DatePickerNs,
  ...InputOtpNs,
  ...TableNs,
  // Ключ обязан совпадать с `descriptor.adapters.wizard.symbol`: билдер ищет символ пошаговой
  // формы в namespace именно по нему. В barrel `FormWizard` не экспортируется — только за subpath.
  FormWizard,
};
