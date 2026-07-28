/**
 * Реестр Runtime-preview: `имя → React-компонент` — строится ДАННЫМИ из каталога (`getCatalog()`),
 * тем же источником, что и палитра, поэтому с ней не расходится (спека §9). Для каждой registrable
 * записи `render-policy` резолвит либо живой `@reformer/ui-kit`-компонент (правило имён: field →
 * `${name}Field`, иначе `name`), либо нейтральный стаб «предпросмотр ограничен» (оверлеи/subpath-only).
 *
 * Плюс INFRA-имена ВНЕ палитрового каталога, но нужные рендереру: `FormField` (он же `FIELD_WRAPPER`),
 * `AsyncBoundary`, `Step` (из `@reformer/cdk`).
 *
 * @module reformer-builder/preview-runtime/known-components
 */

import type { ComponentType } from 'react';
import * as UiKit from '@reformer/ui-kit';
// Subpath-экспорты ui-kit: реальные компоненты за optional peer-deps (не в barrel). Явно
// подмешиваем в namespace, чтобы форменные Combobox/Calendar/DatePicker/InputOTP/Table рисовались
// вживую в превью, а не заглушкой «предпросмотр ограничен». Peer-deps проекта установлены.
import * as ComboboxNs from '@reformer/ui-kit/combobox';
import * as CalendarNs from '@reformer/ui-kit/calendar';
import * as DatePickerNs from '@reformer/ui-kit/date-picker';
import * as InputOtpNs from '@reformer/ui-kit/input-otp';
import * as TableNs from '@reformer/ui-kit/table';
import { Step } from '@reformer/cdk/form-wizard';
import { getCatalog } from '../catalog';
import { classify, isRegistrable } from './render-policy';
import { makePreviewLimitedComponent } from './unknown-component';
import { INFRA_NAMES } from './known-names';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Namespace для резолва компонентов превью: barrel `@reformer/ui-kit` + подмешанные subpath-модули
 * форменных компонентов. `resolveUiKitComponent` ищет по имени (`${name}Field` для field, иначе
 * `name`), поэтому достаточно, чтобы экспорт (`ComboboxField`, `Table`, …) присутствовал в объекте.
 */
const PREVIEW_UIKIT: Record<string, unknown> = {
  ...UiKit,
  ...ComboboxNs,
  ...CalendarNs,
  ...DatePickerNs,
  ...InputOtpNs,
  ...TableNs,
};

/** Компоненты для INFRA-имён (вне каталога). Ключи обязаны покрывать {@link INFRA_NAMES}. */
const INFRA_LOOKUP: Record<string, ComponentType<any>> = {
  FormField: UiKit.FormField as ComponentType<any>,
  AsyncBoundary: UiKit.AsyncBoundary as ComponentType<any>,
  Step: Step as ComponentType<any>,
};

/** Собрать карту `имя → компонент` из каталога (один раз на загрузке модуля). */
function buildKnownComponents(): Record<string, ComponentType<any>> {
  const map: Record<string, ComponentType<any>> = {};
  for (const name of INFRA_NAMES) map[name] = INFRA_LOOKUP[name];
  for (const entry of getCatalog()) {
    if (!isRegistrable(entry)) continue;
    const decision = classify(entry, PREVIEW_UIKIT);
    map[entry.name] =
      decision.policy === 'live'
        ? decision.component
        : makePreviewLimitedComponent(entry.name, decision.reason);
  }
  return map;
}

/** Дефолтный registry preview: имя → React-компонент (каталог + INFRA). */
export const KNOWN_COMPONENTS: Record<string, ComponentType<any>> = buildKnownComponents();

/**
 * Классификация каждой registrable-записи каталога (для тестов/диагностики). React-зависима
 * (тянет barrel `@reformer/ui-kit`) — использовать только в jsdom-тестах, не в node-suite.
 */
export function classifyCatalog(): Array<{
  name: string;
  policy: 'live' | 'limited';
  reason?: string;
}> {
  return getCatalog()
    .filter(isRegistrable)
    .map((entry) => {
      const d = classify(entry, PREVIEW_UIKIT);
      return d.policy === 'live'
        ? { name: entry.name, policy: 'live' as const }
        : { name: entry.name, policy: 'limited' as const, reason: d.reason };
    });
}
