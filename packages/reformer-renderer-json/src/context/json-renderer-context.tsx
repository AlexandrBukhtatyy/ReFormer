/**
 * React Context для настроек JsonFormRenderer
 *
 * @module reformer/renderer-json/context
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { RendererSettings } from '@reformer/renderer-react';
import type { ComponentRegistry } from '../registry/types';
import { defaultRegistry } from '../registry/default-registry';

/**
 * Настройки JsonRenderer.
 *
 * Расширяет RendererSettings из @reformer/renderer-react,
 * добавляя registry для компонентов.
 */
export interface JsonRendererSettings extends RendererSettings {
  /**
   * Реестр компонентов для резолва имён в React-компоненты.
   * По умолчанию используется defaultRegistry с компонентами из @reformer/ui-kit.
   */
  registry?: ComponentRegistry;
}

/**
 * Значение контекста с дефолтами
 */
const defaultContextValue: JsonRendererSettings = {
  registry: defaultRegistry,
};

const JsonRendererContext = createContext<JsonRendererSettings>(defaultContextValue);

/**
 * Props для JsonRendererProvider
 */
export interface JsonRendererProviderProps {
  /**
   * Настройки для JsonFormRenderer
   */
  settings: JsonRendererSettings;

  /**
   * Дочерние элементы
   */
  children: ReactNode;
}

/**
 * Provider для настройки JsonFormRenderer на уровне приложения/секции.
 *
 * Все вложенные JsonFormRenderer будут использовать эти настройки.
 *
 * @example
 * ```tsx
 * import { JsonRendererProvider, createDefaultRegistry } from '@reformer/renderer-json';
 * import { FormField } from '@reformer/ui-kit';
 *
 * const appRegistry = createDefaultRegistry()
 *   .register('DatePicker', { component: MyDatePicker, type: 'field' });
 *
 * function App() {
 *   return (
 *     <JsonRendererProvider
 *       settings={{
 *         fieldWrapper: FormField,
 *         registry: appRegistry,
 *       }}
 *     >
 *       <MyRoutes />
 *     </JsonRendererProvider>
 *   );
 * }
 * ```
 */
export function JsonRendererProvider({ settings, children }: JsonRendererProviderProps): ReactNode {
  // Мержим с дефолтами — если registry не указан, используем defaultRegistry
  const mergedSettings: JsonRendererSettings = {
    ...defaultContextValue,
    ...settings,
  };

  return (
    <JsonRendererContext.Provider value={mergedSettings}>{children}</JsonRendererContext.Provider>
  );
}

/**
 * Hook для получения настроек из JsonRendererProvider.
 *
 * @returns Настройки JsonRenderer (registry, fieldWrapper и т.д.)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { registry, fieldWrapper } = useJsonRendererSettings();
 *   // ...
 * }
 * ```
 */
export function useJsonRendererSettings(): JsonRendererSettings {
  return useContext(JsonRendererContext);
}
