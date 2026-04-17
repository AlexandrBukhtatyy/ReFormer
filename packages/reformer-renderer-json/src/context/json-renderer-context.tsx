/**
 * React Context для настроек JsonFormRenderer
 *
 * @module reformer/renderer-json/context
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { RendererSettings } from '@reformer/renderer-react';
import type { ComponentRegistry } from '../registry/types';
import { ComponentRegistryImpl } from '../registry/component-registry';

export interface JsonRendererSettings extends RendererSettings {
  registry?: ComponentRegistry;
}

const JsonRendererContext = createContext<JsonRendererSettings>({});

export interface JsonRendererProviderProps {
  settings: JsonRendererSettings;
  children: ReactNode;
}

export function JsonRendererProvider({ settings, children }: JsonRendererProviderProps): ReactNode {
  const parentSettings = useContext(JsonRendererContext);

  const mergedRegistry = useMemo(() => {
    if (parentSettings.registry && settings.registry) {
      return ComponentRegistryImpl.withParent(parentSettings.registry, settings.registry);
    }
    return settings.registry ?? parentSettings.registry;
  }, [parentSettings.registry, settings.registry]);

  const mergedSettings = useMemo<JsonRendererSettings>(
    () => ({
      ...parentSettings,
      ...settings,
      registry: mergedRegistry,
    }),
    [parentSettings, settings, mergedRegistry]
  );

  return (
    <JsonRendererContext.Provider value={mergedSettings}>{children}</JsonRendererContext.Provider>
  );
}

export function useJsonRendererSettings(): JsonRendererSettings {
  const settings = useContext(JsonRendererContext);
  if (import.meta.env.DEV && !settings.registry) {
    throw new Error(
      '[JsonRenderer] No registry found. Wrap your app in <JsonRendererProvider settings={{ registry }}>.'
    );
  }
  return settings;
}
