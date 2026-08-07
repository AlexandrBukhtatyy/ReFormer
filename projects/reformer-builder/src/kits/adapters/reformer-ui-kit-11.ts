/**
 * Адаптер кита `@reformer/ui-kit@11` — второй вшитый кит, доказывающий, что переключение версий
 * работает на настоящем пакете, а не на синтетической фикстуре.
 *
 * Почему именно 11, а не последний 12: v12 требует от рантайма `resolveInitialValue` и
 * `useModelArrayItems` из `@reformer/renderer-react`, а локальная ветка их из barrel не экспортирует
 * (develop отстаёт от main) — импорт падает на ЛИНКОВКЕ. Мажоры 9/10/11 требуют лишь шесть
 * символов, и все они на месте. Как только ветки синхронизируются, рядом ляжет адаптер v12.
 *
 * Пакет подключён npm-алиасом: `"@reformer/ui-kit-v11": "npm:@reformer/ui-kit@11.0.0"`. Это штатный
 * способ держать несколько версий одного пакета — правок в самих пакетах не требуется.
 *
 * @module reformer-builder/kits/adapters/reformer-ui-kit-11
 */

import * as UiKit from '@reformer/ui-kit-v11';
import * as ComboboxNs from '@reformer/ui-kit-v11/combobox';
import * as CalendarNs from '@reformer/ui-kit-v11/calendar';
import * as DatePickerNs from '@reformer/ui-kit-v11/date-picker';
import * as InputOtpNs from '@reformer/ui-kit-v11/input-otp';
import * as TableNs from '@reformer/ui-kit-v11/table';
import { FormWizard } from '@reformer/ui-kit-v11/form-wizard';
import type { KitNamespace } from '../types';

/**
 * Namespace кита v11. `List` здесь отсутствует — в 11.0.0 такого компонента ещё не было; билдер
 * покажет для INFRA-имени `List` подписанный стаб вместо падения (см. `known-components`).
 */
export const REFORMER_UI_KIT_11_NAMESPACE: KitNamespace = {
  ...UiKit,
  ...ComboboxNs,
  ...CalendarNs,
  ...DatePickerNs,
  ...InputOtpNs,
  ...TableNs,
  FormWizard,
};
