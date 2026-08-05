/**
 * Реестр форм витрины.
 *
 * Пилот этапа 1 плана `docs/plans/soft-strolling-zebra.md`: примеры перестают быть
 * «страница с формой внутри» и становятся записями реестра. Страница остаётся оболочкой,
 * а форму монтирует `<FormOutlet id="…" />`.
 *
 * Базовый реестр компонентов здесь пустой: у каждого примера исторически свой набор
 * (`createAlertsRegistry`, `createRegistrationRegistry`, …), и сводить их в общее ядро —
 * отдельная задача, не относящаяся к проверке механизма. Реестр записи компонуется поверх
 * базового через `composeRegistries`, поэтому переход на общее ядро потом ничего не сломает.
 *
 * @module react-playground/forms/registry
 */

import { defineRegistry, type ComponentRegistry } from '@reformer/renderer-json';
import { getFormRegistry, type FormEntry } from '@reformer/form-registry';
import { alertsFormEntry } from '../pages/examples/alerts-list-renderer-json/form-setup';
import { creditApplicationFormEntry } from '../pages/examples/complex-multy-step-form-registry/form-setup';

/** Общее ядро компонентов витрины. Пока пусто — см. комментарий модуля. */
export const baseComponentRegistry: ComponentRegistry = defineRegistry(() => {});

/** Формы витрины. Пополняется по мере перевода примеров на реестр. */
export const playgroundForms: readonly FormEntry[] = [
  alertsFormEntry as unknown as FormEntry,
  creditApplicationFormEntry as unknown as FormEntry,
];

let registered = false;

/**
 * Регистрирует формы витрины ровно один раз.
 *
 * Идемпотентность нужна из-за StrictMode и HMR: повторный вызов иначе упёрся бы в
 * защиту от конфликта `id` и уронил приложение в разработке.
 */
export function registerPlaygroundForms(): void {
  if (registered) return;
  registered = true;
  getFormRegistry().registerAll(playgroundForms);
}
