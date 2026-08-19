/**
 * Контекст React-слоя: реестр, контекст разрешения и базовый реестр компонентов.
 *
 * @module reformer/form-registry/react/context
 */

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { ComponentRegistry } from '@reformer/renderer-json';
import type { Diagnostic, FormEntry, ResolveContext } from '../types';
import type { FormRegistry } from '../registry';
import type { SchemaCache } from '../cache';

export interface FormRegistryOptions {
  /** Куда сообщать о промахах: конфликты, незагруженные части, деградация. */
  onDiagnostic?: (d: Diagnostic) => void;
  /**
   * Как поступать с непройденным preflight: `'error'` (по умолчанию) — не монтировать,
   * `'warn'` — смонтировать и сообщить в `onDiagnostic`, `'off'` — не проверять.
   */
  preflight?: 'error' | 'warn' | 'off';
  /** Подменяемо в тестах и на стендах — например, чтобы считать сетевые запросы. */
  fetchImpl?: typeof fetch;
}

export interface FormRegistryContextValue {
  registry: FormRegistry;
  /** Актуальный список записей — пересчитывается при регистрации/снятии. */
  entries: readonly FormEntry[];
  ctx: ResolveContext;
  baseRegistry: ComponentRegistry;
  /** Кэш схем. Без него сетевые источники тянутся заново при каждом монтировании. */
  cache?: SchemaCache;
  options: FormRegistryOptions;
}

const Ctx = createContext<FormRegistryContextValue | null>(null);

export interface FormRegistryProviderProps {
  registry: FormRegistry;
  /** Права, флаги, текущий маршрут. Подаёт хост из своих источников. */
  context: ResolveContext;
  /** Общее ядро компонентов приложения. Расширения записей компонуются поверх. */
  baseRegistry: ComponentRegistry;
  /**
   * Кэш схем для сетевых источников. Держите ЭКЗЕМПЛЯР стабильным между рендерами: смена ссылки
   * перезагружает смонтированные формы (это осмысленно при смене настроек кэша, но не в цикле).
   */
  cache?: SchemaCache;
  options?: FormRegistryOptions;
  children: ReactNode;
}

export function FormRegistryProvider({
  registry,
  context,
  baseRegistry,
  cache,
  options,
  children,
}: FormRegistryProviderProps): ReactNode {
  // Состав реестра меняется извне (микрофронт смонтировался/выгрузился) —
  // подписка через useSyncExternalStore, а не useState, чтобы не терять обновления.
  const entries = useSyncExternalStore(registry.subscribe, registry.list, registry.list);

  // Разбираем `options` на поля намеренно: хост почти всегда пишет литерал `options={{ … }}`,
  // и держи мы объект в зависимостях целиком — контекст пересоздавался бы каждый рендер.
  // Раньше это стоило лишь лишних ре-рендеров, но с приходом `cache` в зависимости эффекта
  // загрузки такая нестабильность означала бы бесконечную перезагрузку формы.
  const { onDiagnostic, preflight, fetchImpl } = options ?? {};

  const value = useMemo<FormRegistryContextValue>(
    () => ({
      registry,
      entries,
      ctx: context,
      baseRegistry,
      cache,
      options: { onDiagnostic, preflight, fetchImpl },
    }),
    [registry, entries, context, baseRegistry, cache, onDiagnostic, preflight, fetchImpl]
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
