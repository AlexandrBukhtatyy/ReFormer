/**
 * RenderContext - контекст для передачи form/path/fieldWrapper в пользовательские компоненты
 *
 * Позволяет компонентам-контейнерам (например, wizard) получить доступ к контексту
 * рендеринга для рекурсивного рендеринга вложенных узлов.
 *
 * @module reformer/renderer-react/render-context
 */

import { createContext, useContext, type ReactNode, type ComponentType } from 'react';
import type { FormProxy, FieldPath } from '@reformer/core';
import type { FieldWrapperProps } from './types';

/**
 * Значение контекста рендеринга
 */
export interface RenderContextValue<T = unknown> {
  /** Proxy формы */
  form: FormProxy<T>;
  /** Корневой FieldPath */
  path: FieldPath<T>;
  /** Компонент-обёртка для полей */
  fieldWrapper?: ComponentType<FieldWrapperProps>;
}

const RenderContext = createContext<RenderContextValue | null>(null);

/**
 * Provider для контекста рендеринга
 */
export function RenderContextProvider<T>({
  value,
  children,
}: {
  value: RenderContextValue<T>;
  children: ReactNode;
}): ReactNode {
  return (
    <RenderContext.Provider value={value as RenderContextValue}>{children}</RenderContext.Provider>
  );
}

/**
 * Хук для получения контекста рендеринга
 *
 * Используется в пользовательских компонентах-контейнерах для доступа
 * к form, path и fieldWrapper.
 *
 * @example
 * ```tsx
 * function MyWizard({ children }) {
 *   const { form, path, fieldWrapper } = useRenderContext();
 *
 *   return (
 *     <FormWizard form={form}>
 *       {children.map(child => (
 *         <RenderNodeComponent
 *           node={child}
 *           form={form}
 *           path={path}
 *           fieldWrapper={fieldWrapper}
 *         />
 *       ))}
 *     </FormWizard>
 *   );
 * }
 * ```
 */
export function useRenderContext<T = unknown>(): RenderContextValue<T> {
  const context = useContext(RenderContext);
  if (!context) {
    throw new Error('useRenderContext must be used within RenderContextProvider (FormRenderer)');
  }
  return context as RenderContextValue<T>;
}
