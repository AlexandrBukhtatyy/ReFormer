/**
 * React Context для настроек JsonFormRenderer
 *
 * @module reformer/renderer-json/context
 */

import { createContext, useContext, useMemo, type ReactNode, type ComponentType } from 'react';
import type { RendererSettings, FieldWrapperProps } from '@reformer/renderer-react';
import type { ComponentRegistry } from '../registry/types';
import { ComponentRegistryImpl } from '../registry/component-registry';
import { FIELD_WRAPPER } from '../registry/constants';

/**
 * Расширенные настройки рендерера: всё из `RendererSettings` плюс реестр.
 */
export interface JsonRendererSettings extends RendererSettings {
  /** Реестр компонентов и source-значений. См. {@link defineRegistry}. */
  registry?: ComponentRegistry;
}

const JsonRendererContext = createContext<JsonRendererSettings>({});

/**
 * Props {@link JsonRendererProvider}.
 */
export interface JsonRendererProviderProps {
  /** Настройки рендерера, как минимум содержащие `registry`. */
  settings: JsonRendererSettings;
  /** Дочернее поддерево, в котором доступен `JsonFormRenderer` и `useJsonRendererSettings`. */
  children: ReactNode;
}

/**
 * Провайдер настроек для {@link JsonFormRenderer}. Прокидывает реестр и
 * fieldWrapper во вложенные компоненты через React Context.
 *
 * Поддерживает вложенность: внутренний провайдер сливается с внешним
 * (внешний имеет приоритет в случае дублей имён в реестре).
 *
 * @example
 * ```tsx
 * <JsonRendererProvider settings={{ registry, fieldWrapper: FormField }}>
 *   <JsonFormRenderer schema={schema} form={form} />
 * </JsonRendererProvider>
 * ```
 */
export function JsonRendererProvider({ settings, children }: JsonRendererProviderProps): ReactNode {
  const parentSettings = useContext(JsonRendererContext);

  const mergedRegistry = useMemo(() => {
    if (parentSettings.registry && settings.registry) {
      return ComponentRegistryImpl.withParent(parentSettings.registry, settings.registry);
    }
    return settings.registry ?? parentSettings.registry;
  }, [parentSettings.registry, settings.registry]);

  const mergedSettings = useMemo<JsonRendererSettings>(() => {
    const fieldWrapperFromRegistry = mergedRegistry?.get(FIELD_WRAPPER)?.component as
      | ComponentType<FieldWrapperProps>
      | undefined;

    return {
      ...parentSettings,
      ...settings,
      registry: mergedRegistry,
      fieldWrapper:
        settings.fieldWrapper ?? fieldWrapperFromRegistry ?? parentSettings.fieldWrapper,
    };
  }, [parentSettings, settings, mergedRegistry]);

  return (
    <JsonRendererContext.Provider value={mergedSettings}>{children}</JsonRendererContext.Provider>
  );
}

/**
 * Хук для чтения текущих настроек {@link JsonRendererProvider}.
 *
 * В режиме разработки бросает исключение, если вызван вне провайдера или
 * если в провайдере не передан `registry`.
 *
 * @returns Текущие {@link JsonRendererSettings}.
 *
 * @example
 * ```tsx
 * function MyControl() {
 *   const { registry } = useJsonRendererSettings();
 *   return <span>{registry?.has('Input') ? 'ready' : 'not registered'}</span>;
 * }
 * ```
 */
export function useJsonRendererSettings(): JsonRendererSettings {
  const settings = useContext(JsonRendererContext);
  if (import.meta.env.DEV && !settings.registry) {
    throw new Error(
      '[JsonRenderer] No registry found. Wrap your app in <JsonRendererProvider settings={{ registry }}>.'
    );
  }
  return settings;
}
