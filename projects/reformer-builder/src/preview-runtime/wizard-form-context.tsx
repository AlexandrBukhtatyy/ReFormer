/**
 * Контекст формы для превью-визарда. `FormRenderer` кладёт в render-context только `settings`
 * (без `form`; форму для wizard-узла канон прокидывает через `componentProps`, что делает behavior
 * в golden-примере). В билдере behavior нет, поэтому реальный `FormProxy` из `buildPreview`
 * доставляется адаптеру {@link WizardPreview} этим отдельным контекстом.
 *
 * @module reformer-builder/preview-runtime/wizard-form-context
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';

/** Форма превью — гетерогенная модель. */
export type PreviewFormProxy = FormProxy<Record<string, unknown>>;

const WizardFormContext = createContext<PreviewFormProxy | undefined>(undefined);

/** Провайдер формы превью (оборачивает `<JsonFormRenderer>` в RuntimePreview). */
export function WizardFormProvider({
  form,
  children,
}: {
  form: PreviewFormProxy | undefined;
  children: ReactNode;
}): ReactNode {
  return <WizardFormContext.Provider value={form}>{children}</WizardFormContext.Provider>;
}

/** Форма превью для адаптера визарда (иначе `undefined`). */
export function useWizardForm(): PreviewFormProxy | undefined {
  return useContext(WizardFormContext);
}
