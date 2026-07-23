import { forwardRef, useImperativeHandle, useMemo, type ForwardedRef, type ReactNode } from 'react';
import { AsyncBoundaryContext, type AsyncBoundaryContextValue } from './AsyncBoundaryContext';
import { useAsyncBoundary } from './useAsyncBoundary';
import { useAsyncResource } from './useAsyncResource';
import type { AsyncBoundaryHandle, AsyncBoundaryRootProps, AsyncStatus } from './types';

interface RootProviderProps<T, E> {
  status: AsyncStatus;
  data: T | undefined;
  error: E | null;
  refreshing: boolean;
  onRetry?: () => void;
  onAbort?: () => void;
  delayMs: number;
  id?: string;
  children: ReactNode;
}

/**
 * Общая часть обеих веток корня: расчёт состояния, контекст и императивный handle.
 *
 * @internal
 */
function RootProviderInner<T, E>(
  {
    status,
    data,
    error,
    refreshing,
    onRetry,
    onAbort,
    delayMs,
    id,
    children,
  }: RootProviderProps<T, E>,
  ref: ForwardedRef<AsyncBoundaryHandle<T, E>>
) {
  const state = useAsyncBoundary<E>({ status, error, refreshing, onRetry, delayMs, id });

  const contextValue = useMemo<AsyncBoundaryContextValue<T, E>>(
    () => ({
      status: state.status,
      data,
      isIdle: state.isIdle,
      isLoading: state.isLoading,
      isReady: state.isReady,
      isError: state.isError,
      refreshing: state.refreshing,
      error: state.error,
      retry: state.retry,
      canRetry: state.canRetry,
      ids: state.ids,
      rootProps: state.rootProps,
      loadingProps: state.loadingProps,
      errorProps: state.errorProps,
    }),
    [state, data]
  );

  useImperativeHandle(
    ref,
    () => ({
      reload: state.retry,
      // В controlled-режиме прерывать нечего: запросом владеет консумент.
      abort: () => onAbort?.(),
      status: state.status,
      data,
      error: state.error,
      isLoading: state.isLoading,
      refreshing: state.refreshing,
    }),
    [state, data, onAbort]
  );

  return (
    // Generic-стирание контекста: см. комментарий у AsyncBoundaryContext.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <AsyncBoundaryContext.Provider value={contextValue as AsyncBoundaryContextValue<any, any>}>
      {children}
    </AsyncBoundaryContext.Provider>
  );
}

const RootProvider = forwardRef(RootProviderInner) as <T, E>(
  props: RootProviderProps<T, E> & { ref?: ForwardedRef<AsyncBoundaryHandle<T, E>> }
) => React.ReactElement;

type SelfManagedProps<T, E> = AsyncBoundaryRootProps<T, E> & {
  load: (signal: AbortSignal) => Promise<T>;
};

/**
 * Ветка self-managed режима: загрузка живёт внутри компонента.
 *
 * Вынесена в отдельный компонент, потому что хуки нельзя вызывать условно:
 * корень выбирает ветку один раз по наличию `load`, и внутри каждой набор хуков
 * стабилен. Переключать режим на лету нельзя — это сменило бы дерево и сбросило
 * состояние загрузки.
 *
 * @internal
 */
function SelfManagedRootInner<T, E>(
  {
    load,
    loadKey,
    enabled = true,
    onSuccess,
    onError,
    toError,
    delayMs = 0,
    id,
    children,
  }: SelfManagedProps<T, E>,
  ref: ForwardedRef<AsyncBoundaryHandle<T, E>>
) {
  const resource = useAsyncResource<T, E>({
    load,
    loadKey,
    enabled,
    onSuccess,
    onError,
    toError,
  });

  return (
    <RootProvider<T, E>
      ref={ref}
      status={resource.status}
      data={resource.data}
      error={resource.error}
      refreshing={resource.refreshing}
      onRetry={resource.reload}
      onAbort={resource.abort}
      delayMs={delayMs}
      id={id}
    >
      {children}
    </RootProvider>
  );
}

const SelfManagedRoot = forwardRef(SelfManagedRootInner) as <T, E>(
  props: SelfManagedProps<T, E> & { ref?: ForwardedRef<AsyncBoundaryHandle<T, E>> }
) => React.ReactElement;

/**
 * Ветка controlled-режима: статус приходит пропом.
 *
 * @internal
 */
function ControlledRootInner<T, E>(
  {
    status = 'idle',
    error = null,
    refreshing = false,
    onRetry,
    delayMs = 0,
    id,
    children,
  }: AsyncBoundaryRootProps<T, E>,
  ref: ForwardedRef<AsyncBoundaryHandle<T, E>>
) {
  return (
    <RootProvider<T, E>
      ref={ref}
      status={status}
      data={undefined}
      error={error}
      refreshing={refreshing}
      onRetry={onRetry}
      delayMs={delayMs}
      id={id}
    >
      {children}
    </RootProvider>
  );
}

const ControlledRoot = forwardRef(ControlledRootInner) as <T, E>(
  props: AsyncBoundaryRootProps<T, E> & { ref?: ForwardedRef<AsyncBoundaryHandle<T, E>> }
) => React.ReactElement;

/**
 * AsyncBoundary.Root — провайдер контекста для слотов состояний загрузки.
 *
 * Работает в двух режимах:
 *
 * - **self-managed** (передан `load`) — грузит данные сам: ведёт статус, отменяет
 *   запрос при смене `loadKey` и размонтировании, даёт повтор из коробки.
 * - **controlled** (`load` не передан) — состояние приходит пропом `status`; нужен
 *   там, где загрузкой владеет кто-то другой, например behavior рендерера
 *   с `schema.node('boundary').patchProps({ status })`.
 *
 * Сам ничего не рендерит (headless): разметку дают слоты и обёртка из `@reformer/ui-kit`.
 * Это НЕ Suspense-boundary — ничего не бросается.
 *
 * @typeParam T - Тип загружаемых данных.
 * @typeParam E - Тип полезной нагрузки ошибки.
 *
 * @example Self-managed: компонент грузит сам
 * ```tsx
 * <AsyncBoundary.Root
 *   load={(signal) => fetchApplication(id, signal)}
 *   loadKey={id}
 *   enabled={id !== null}
 *   onSuccess={(data) => form.patchValue(data)}
 * >
 *   <AsyncBoundary.Loading>Загрузка…</AsyncBoundary.Loading>
 *   <AsyncBoundary.Error>
 *     {({ error, retry }) => <ErrorView error={error} onRetry={retry} />}
 *   </AsyncBoundary.Error>
 *   <AsyncBoundary.Content>{(data) => <Summary data={data} />}</AsyncBoundary.Content>
 * </AsyncBoundary.Root>
 * ```
 *
 * @example Controlled: статусом владеет внешний код
 * ```tsx
 * <AsyncBoundary.Root status={status} error={error} onRetry={reload}>
 *   <AsyncBoundary.Content><CreditForm form={form} /></AsyncBoundary.Content>
 * </AsyncBoundary.Root>
 * ```
 *
 * @example Перезагрузка снаружи через ref
 * ```tsx
 * const boundaryRef = useRef<AsyncBoundaryHandle<Application>>(null);
 *
 * <button onClick={() => boundaryRef.current?.reload()}>Обновить</button>
 * <AsyncBoundary.Root ref={boundaryRef} load={loadApplication}>…</AsyncBoundary.Root>
 * ```
 */
function AsyncBoundaryRootInner<T = unknown, E = unknown>(
  props: AsyncBoundaryRootProps<T, E>,
  ref: ForwardedRef<AsyncBoundaryHandle<T, E>>
) {
  const { load } = props;

  return load ? (
    <SelfManagedRoot<T, E> {...props} load={load} ref={ref} />
  ) : (
    <ControlledRoot<T, E> {...props} ref={ref} />
  );
}

const AsyncBoundaryRoot = forwardRef(AsyncBoundaryRootInner) as (<T = unknown, E = unknown>(
  props: AsyncBoundaryRootProps<T, E> & { ref?: ForwardedRef<AsyncBoundaryHandle<T, E>> }
) => React.ReactElement) & { displayName?: string };

AsyncBoundaryRoot.displayName = 'AsyncBoundary.Root';

export { AsyncBoundaryRoot };
