/**
 * React Context для настроек JsonFormRenderer
 *
 * @module reformer/renderer-json/context
 */

import { createContext, useContext, useMemo, type ReactNode, type ComponentType } from 'react';
import type { RendererSettings, FieldWrapperProps } from '@reformer/renderer-react';
import type { FormModel } from '@reformer/core';
import type { ComponentRegistry } from '../registry/types';
import { ComponentRegistryImpl } from '../registry/component-registry';
import { FIELD_WRAPPER } from '../registry/constants';

/**
 * Расширенные настройки рендерера: всё из `RendererSettings` плюс реестр.
 */
export interface JsonRendererSettings extends RendererSettings {
  /** Реестр компонентов и source-значений. См. {@link defineRegistry}. */
  registry?: ComponentRegistry;
  /**
   * Модель данных (M1, единая схема). Если задана — JSON-листья биндятся к сигналам модели
   * (`model.signalAt(selector)`), а форма строится из той же JSON-схемы (без отдельной схемы формы).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model?: FormModel<any>;
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
 * @example M1: реестр + модель через settings
 * ```tsx
 * // Модель — источник истины (M1); листья схемы биндятся к её сигналам.
 * const model = useMemo(() => createModel<MyForm>({ email: '' }), []);
 * const registry = useMemo(() => defineRegistry((reg) => {
 *   reg.field('Input', Input);
 *   reg.container(FIELD_WRAPPER, FormField);
 * }), []);
 *
 * <JsonRendererProvider settings={{ registry, model }}>
 *   <JsonFormRenderer<MyForm> schema={schema} />
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
