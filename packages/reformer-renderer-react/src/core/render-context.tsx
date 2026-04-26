/**
 * RenderContext - контекст для передачи form/path/settings в пользовательские компоненты
 *
 * Позволяет компонентам-контейнерам (например, wizard) получить доступ к контексту
 * рендеринга для рекурсивного рендеринга вложенных узлов.
 *
 * @module reformer/renderer-react/render-context
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { FormProxy, FieldPath } from '@reformer/core';
import type { RendererSettings } from './types';

/**
 * Значение контекста рендеринга
 */
export interface RenderContextValue<T = unknown> {
  /** Proxy формы (опционально — может быть предоставлена wizard-компонентом через props) */
  form?: FormProxy<T>;
  /** Корневой FieldPath (опционально) */
  path?: FieldPath<T>;
  /** Настройки рендерера */
  settings?: RendererSettings;
}

const RenderContext = createContext<RenderContextValue | null>(null);

/**
 * Provider для контекста рендеринга. Снабжает дочерние компоненты текущей формой,
 * настройками и `path`. Обычно создаётся `FormRenderer` автоматически — явно
 * нужен только при ручном построении дерева через `RenderNodeComponent`.
 *
 * @example
 * ```tsx
 * import { RenderContextProvider, RenderNodeComponent } from '@reformer/renderer-react';
 *
 * <RenderContextProvider value={{ form, settings: { fieldWrapper } }}>
 *   <RenderNodeComponent node={rootNode} />
 * </RenderContextProvider>
 * ```
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
 * к form, path и settings.
 *
 * @example
 * ```tsx
 * function MyWizard({ children }) {
 *   const { form, path, settings } = useRenderContext();
 *
 *   return (
 *     <FormWizard form={form}>
 *       {children.map(child => (
 *         <RenderNodeComponent
 *           node={child}
 *           form={form}
 *           path={path}
 *           settings={settings}
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
