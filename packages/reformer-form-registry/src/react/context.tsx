/**
 * Контекст React-слоя: реестр, контекст разрешения и базовый реестр компонентов.
 *
 * @module reformer/form-registry/react/context
 */

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { ComponentRegistry } from '@reformer/renderer-json';
import type { Diagnostic, FormEntry, ResolveContext } from '../types';
import type { FormRegistry } from '../registry';

export interface FormRegistryOptions {
  /** Куда сообщать о промахах: конфликты, незагруженные части, деградация. */
  onDiagnostic?: (d: Diagnostic) => void;
}

export interface FormRegistryContextValue {
  registry: FormRegistry;
  /** Актуальный список записей — пересчитывается при регистрации/снятии. */
  entries: readonly FormEntry[];
  ctx: ResolveContext;
  baseRegistry: ComponentRegistry;
  options: FormRegistryOptions;
}

const Ctx = createContext<FormRegistryContextValue | null>(null);

export interface FormRegistryProviderProps {
  registry: FormRegistry;
  /** Права, флаги, текущий маршрут. Подаёт хост из своих источников. */
  context: ResolveContext;
  /** Общее ядро компонентов приложения. Расширения записей компонуются поверх. */
  baseRegistry: ComponentRegistry;
  options?: FormRegistryOptions;
  children: ReactNode;
}

export function FormRegistryProvider({
  registry,
  context,
  baseRegistry,
  options,
  children,
}: FormRegistryProviderProps): ReactNode {
  // Состав реестра меняется извне (микрофронт смонтировался/выгрузился) —
  // подписка через useSyncExternalStore, а не useState, чтобы не терять обновления.
  const entries = useSyncExternalStore(registry.subscribe, registry.list, registry.list);

  const value = useMemo<FormRegistryContextValue>(
    () => ({ registry, entries, ctx: context, baseRegistry, options: options ?? {} }),
    [registry, entries, context, baseRegistry, options]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFormRegistryContext(): FormRegistryContextValue {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error(
      '[form-registry] Компонент использован вне <FormRegistryProvider>. ' +
        'Оберните поддерево провайдером с registry, context и baseRegistry.'
    );
  }
  return value;
}
