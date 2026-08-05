/**
 * `FormOutlet` — точка монтирования формы по идентификатору, и обёртки над ней
 * для слотов и маршрутов.
 *
 * @module reformer/form-registry/react/form-outlet
 */

import { useMemo, type ReactNode } from 'react';
import type { FormModel } from '@reformer/core';
import type { JsonForm } from '@reformer/renderer-json';
import type { FormEntry, FormQuery } from '../types';
import { entryKeyOf } from '../loader';
import { useFormRegistryContext } from './context';
import { useFormResource } from './use-form-resource';
import { MountedForm } from './mounted-form';

export interface FormMountProps<T extends object> {
  initial?: T;
  model?: FormModel<T>;
  /** Настройки места монтирования для фабрики render-behavior (колбэки хоста). */
  renderBehaviorOptions?: Record<string, unknown>;
  /** Что показывать, пока части формы грузятся. */
  fallback?: ReactNode;
  /** Что показывать, если загрузка не удалась. Второй аргумент — повтор. */
  loadErrorFallback?: (error: Error, retry: () => void) => ReactNode;
  /** Что показывать, если форма упала на рендере. */
  errorFallback?: (error: Error, entry: FormEntry<T>) => ReactNode;
  onReady?: (form: JsonForm<T>) => void;
}

export interface FormOutletProps<T extends object> extends FormMountProps<T> {
  id: string;
  version?: string;
}

/** Загружает и монтирует одну конкретную запись. */
function EntryMount<T extends object>({
  entry,
  ...rest
}: { entry: FormEntry<T> } & FormMountProps<T>): ReactNode {
  const { baseRegistry } = useFormRegistryContext();
  const res = useFormResource<T>(entry, baseRegistry);

  if (res.status === 'pending') return rest.fallback ?? null;
  if (res.status === 'error') {
    return rest.loadErrorFallback?.(res.error, res.retry) ?? null;
  }
  return (
    <MountedForm<T>
      entry={entry}
      loaded={res.data}
      initial={rest.initial}
      model={rest.model}
      renderBehaviorOptions={rest.renderBehaviorOptions}
      errorFallback={rest.errorFallback}
      onReady={rest.onReady}
    />
  );
}

/**
 * Монтирует форму по идентификатору.
 *
 * Ничего не рендерит, если записи нет или у пользователя нет прав — это валидный исход,
 * а не ошибка: слот с недоступной формой должен быть пустым, а не показывать рамку.
 */
export function FormOutlet<T extends object = Record<string, unknown>>({
  id,
  version,
  ...rest
}: FormOutletProps<T>): ReactNode {
  const { entries, ctx, registry } = useFormRegistryContext();
  const entry = useMemo(
    () => registry.resolve({ by: 'id', id, version }, ctx)[0] as FormEntry<T> | undefined,
    // entries в зависимостях намеренно: состав реестра меняется извне.
    [registry, entries, id, version, ctx]
  );
  if (!entry) return null;

  // key — полное пересоздание формы при смене записи или версии. Без него ленивый
  // useState внутри useJsonForm вернул бы старую модель со старой схемой.
  return <EntryMount<T> key={entryKeyOf(entry)} entry={entry} {...rest} />;
}

function QueryOutlet<T extends object>({
  query,
  ...rest
}: { query: FormQuery } & FormMountProps<T>): ReactNode {
  const { entries, ctx, registry } = useFormRegistryContext();
  const found = useMemo(
    () => registry.resolve(query, ctx) as FormEntry<T>[],
    [registry, entries, query, ctx]
  );
  return (
    <>
      {found.map((entry) => (
        <EntryMount<T> key={entryKeyOf(entry)} entry={entry} {...rest} />
      ))}
    </>
  );
}

/** Все формы, объявленные для слота и доступные пользователю, в порядке приоритета. */
export function FormSlot<T extends object = Record<string, unknown>>({
  name,
  ...rest
}: { name: string } & FormMountProps<T>): ReactNode {
  const query = useMemo<FormQuery>(() => ({ by: 'slot', slot: name }), [name]);
  return <QueryOutlet<T> query={query} {...rest} />;
}

/**
 * Формы, привязанные к маршруту.
 *
 * `path` передаётся пропом, а не читается из роутера: реестр не должен знать, какой роутер
 * используется — это условие работы и в single-spa, и в Module Federation.
 */
export function FormRoute<T extends object = Record<string, unknown>>({
  path,
  ...rest
}: { path: string } & FormMountProps<T>): ReactNode {
  const query = useMemo<FormQuery>(() => ({ by: 'route', path }), [path]);
  return <QueryOutlet<T> query={query} {...rest} />;
}
