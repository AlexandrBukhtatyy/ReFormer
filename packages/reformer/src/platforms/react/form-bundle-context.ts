/**
 * Контекст сборки формы — бандл `createForm`, доступный компонентам внутри рендерера.
 *
 * Контекст ставит рендерер формы. Компонент, которому нужны форма и валидация (визард), берёт их
 * отсюда, а не пропсами из схемы: билдер схемы остаётся `(model) => узел`, без второго прохода с
 * формой.
 *
 * @module platforms/react/form-bundle-context
 */

import { createContext, useContext } from 'react';
import type { FormBundle } from '../../form/form-bundle';

/**
 * Контекст сборки. Значение — бандл `createForm`; вне рендерера — `null`.
 *
 * @example
 * ```tsx
 * <FormBundleContext.Provider value={bundle}>
 *   <MyWizard />
 * </FormBundleContext.Provider>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormBundleContext = createContext<FormBundle<any> | null>(null);

/**
 * Бандл сборки, внутри которой отрисован компонент; `null` — компонент стоит вне рендерера
 * (например, визард в разметке React-руками получает форму и валидацию пропсами).
 *
 * @typeParam T - Форма данных модели.
 *
 * @example
 * ```tsx
 * function StepFooter() {
 *   const bundle = useFormBundleContext<CreditForm>();
 *   return <button onClick={() => bundle?.validation?.validateAll()}>Проверить</button>;
 * }
 * ```
 */
export function useFormBundleContext<T = unknown>(): FormBundle<T> | null {
  return useContext(FormBundleContext) as FormBundle<T> | null;
}
