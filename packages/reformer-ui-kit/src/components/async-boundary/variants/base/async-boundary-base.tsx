import * as React from 'react';
import { AlertCircleIcon, RotateCwIcon } from 'lucide-react';
import {
  AsyncBoundary as AsyncBoundaryPrimitive,
  useAsyncBoundaryContext,
  type AsyncStatus,
  type AsyncBoundaryHandle,
  type AsyncBoundaryErrorRenderProps,
} from '@reformer/cdk/async-boundary';

import { cn } from '@/lib/utils';
import { Button } from '@/components/button';
import { Spinner } from '@/components/spinner';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/empty';

// ReFormer-original (не shadcn): визуальный слой над headless AsyncBoundary из @reformer/cdk.
// Заменяет прежние LoadingState/ErrorState, которые рисовали спиннер и карточку ошибки руками
// на нетокеновой палитре (bg-red-50 / border-blue-600 / text-gray-600) и были мертвы в dark-режиме.
// Здесь только токены темы и композиция готовых примитивов (Spinner / Button / Empty*).
//
// Исключение из правила «не хардкодить data-testid»: `loading-state` / `error-state` — это
// зафиксированный контракт e2e POM, а через renderer-json во внутренние блоки такие атрибуты
// прокинуть неоткуда. Поэтому они живут в реализации, а не приходят из props.

// `title` у нас — узел заголовка, а не HTML-атрибут всплывающей подсказки (string),
// поэтому во всех трёх блоках он исключается из ComponentProps<'div'> и переобъявляется.
/** Props {@link AsyncBoundaryLoading}. */
export interface AsyncBoundaryLoadingProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  /** Основной текст. @default 'Загрузка данных...' */
  title?: React.ReactNode;
  /** Вспомогательный текст под спиннером. @default 'Пожалуйста, подождите' */
  subtitle?: React.ReactNode;
}

/**
 * Блок загрузки — центрированный спиннер с заголовком и подзаголовком.
 *
 * Объявляется вежливо (`role="status"` + `aria-live="polite"`): появление индикатора
 * не должно прерывать чтение текущего контента скринридером.
 *
 * @param props - См. {@link AsyncBoundaryLoadingProps}.
 * @returns Разметку блока загрузки.
 *
 * @example Собственный текст внутри слота
 * ```tsx
 * <AsyncBoundary.Loading>
 *   <AsyncBoundaryLoading title="Загружаем заявку…" subtitle={null} />
 * </AsyncBoundary.Loading>
 * ```
 *
 * @example Самостоятельно, вне контейнера
 * ```tsx
 * if (isLoading) return <AsyncBoundaryLoading />;
 * ```
 */
function AsyncBoundaryLoading({
  className,
  title = 'Загрузка данных...',
  subtitle = 'Пожалуйста, подождите',
  ...props
}: AsyncBoundaryLoadingProps) {
  return (
    <div
      data-slot="async-boundary-loading"
      data-testid="loading-state"
      role="status"
      aria-live="polite"
      className={cn('flex w-full flex-col items-center justify-center gap-4 p-12', className)}
      {...props}
    >
      <Spinner className="size-8 text-muted-foreground" />
      <div className="space-y-1 text-center">
        <p data-slot="async-boundary-loading-title" className="text-sm font-medium text-foreground">
          {title}
        </p>
        {subtitle ? (
          <p data-slot="async-boundary-loading-subtitle" className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Props {@link AsyncBoundaryError}. */
export interface AsyncBoundaryErrorProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  /** Текст ошибки под заголовком. */
  error?: React.ReactNode;
  /** Заголовок блока. @default 'Ошибка загрузки' */
  title?: React.ReactNode;
  /** Колбэк повтора. Без него кнопка не рендерится. */
  onRetry?: () => void;
  /** Подпись кнопки повтора. @default 'Повторить' */
  retryLabel?: React.ReactNode;
}

/**
 * Блок ошибки — карточка с иконкой, заголовком, текстом ошибки и кнопкой повтора.
 *
 * Объявляется настойчиво (`role="alert"` + `aria-live="assertive"`): потеря данных должна
 * прервать чтение, иначе пользователь продолжит работать с пустым экраном.
 *
 * @param props - См. {@link AsyncBoundaryErrorProps}.
 * @returns Разметку блока ошибки.
 *
 * @example Внутри слота, с доступом к самой ошибке
 * ```tsx
 * <AsyncBoundary.Error>
 *   {({ error, retry }) => <AsyncBoundaryError error={error} onRetry={retry} />}
 * </AsyncBoundary.Error>
 * ```
 *
 * @example Самостоятельно, с перезагрузкой страницы
 * ```tsx
 * if (error) return <AsyncBoundaryError error={error} onRetry={() => window.location.reload()} />;
 * ```
 */
function AsyncBoundaryError({
  className,
  error,
  title = 'Ошибка загрузки',
  onRetry,
  retryLabel = 'Повторить',
  ...props
}: AsyncBoundaryErrorProps) {
  return (
    <div
      data-slot="async-boundary-error"
      data-testid="error-state"
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex w-full flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center',
        className
      )}
      {...props}
    >
      <AlertCircleIcon className="size-10 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <p
          data-slot="async-boundary-error-title"
          className="text-lg font-semibold text-destructive"
        >
          {title}
        </p>
        {error ? (
          <p data-slot="async-boundary-error-description" className="text-sm text-muted-foreground">
            {error}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button data-slot="async-boundary-retry" variant="outline" onClick={onRetry}>
          <RotateCwIcon />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Props {@link AsyncBoundaryEmpty}. */
export interface AsyncBoundaryEmptyProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  /** Заголовок. @default 'Нет данных' */
  title?: React.ReactNode;
  /** Пояснение под заголовком. */
  description?: React.ReactNode;
  /** Иконка в медальоне над заголовком. */
  icon?: React.ReactNode;
  /** Действие под текстом — например кнопка «Создать». */
  action?: React.ReactNode;
}

/**
 * Блок «данные загрузились, но их нет» поверх примитивов `Empty*`.
 *
 * Отдельный от ошибки экран: пустой результат — это успех, а не сбой, объявлять его
 * через `role="alert"` нельзя.
 *
 * @param props - См. {@link AsyncBoundaryEmptyProps}.
 * @returns Разметку пустого состояния.
 *
 * @example Пустой список после успешной загрузки
 * ```tsx
 * <AsyncBoundary.Empty when={items.length === 0}>
 *   <AsyncBoundaryEmpty description="Заявок пока нет" action={<Button>Создать</Button>} />
 * </AsyncBoundary.Empty>
 * ```
 *
 * @example С иконкой
 * ```tsx
 * <AsyncBoundaryEmpty icon={<InboxIcon />} title="Входящих нет" />
 * ```
 */
function AsyncBoundaryEmpty({
  className,
  title = 'Нет данных',
  description,
  icon,
  action,
  ...props
}: AsyncBoundaryEmptyProps) {
  return (
    <Empty data-slot="async-boundary-empty" className={cn('border', className)} {...props}>
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/**
 * Регион-обёртка: несёт `aria-busy` и `data-status` из контекста.
 *
 * Отдельный компонент, потому что контекст читается только НИЖЕ провайдера — внутри
 * самого {@link AsyncBoundary} он ещё недоступен.
 */
function AsyncBoundaryRegion({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { rootProps } = useAsyncBoundaryContext();

  return (
    <div data-slot="async-boundary" className={cn('w-full', className)} {...rootProps}>
      {children}
    </div>
  );
}

/**
 * Props {@link AsyncBoundary}.
 *
 * Два режима, взаимоисключающих: **self-managed** (передан `load` — компонент грузит
 * данные сам) и **controlled** (`load` не передан — состояние приходит через `status`).
 *
 * @typeParam T - Тип загружаемых данных (self-managed режим).
 */
export interface AsyncBoundaryProps<T = unknown> {
  /**
   * Загрузчик. Получает `AbortSignal` — прокиньте его в `fetch`. Наличие этого пропа
   * включает self-managed режим: статус, отмена и повтор берутся на себя компонентом.
   */
  load?: (signal: AbortSignal) => Promise<T>;
  /** Ключ перезапуска: при изменении стартует новая загрузка (обычно id записи). */
  loadKey?: unknown;
  /** `false` → загрузка не стартует, состояние `idle`. Режим создания записи. @default true */
  enabled?: boolean;
  /** Побочный эффект после успеха — например `form.patchValue(data)`. */
  onSuccess?: (data: T) => void;
  /** Побочный эффект после ошибки — логирование, тост. */
  onError?: (error: React.ReactNode) => void;
  /** Преобразование отказа промиса в отображаемый текст. По умолчанию — сообщение `Error`. */
  toError?: (e: unknown) => React.ReactNode;
  /** Текущее состояние. Обязателен в controlled-режиме (когда `load` не передан). */
  status?: AsyncStatus;
  /** Текст ошибки — попадает в блок ошибки и в render-функцию `errorSlot`. */
  error?: React.ReactNode | null;
  /** Повтор загрузки. Без него кнопка «Повторить» не рендерится. */
  onRetry?: () => void;
  /** Фоновое обновление: контент остаётся на экране, регион помечается `aria-busy`. */
  refreshing?: boolean;
  /** Не показывать блок загрузки первые N мс — гасит вспышку спиннера. @default 0 */
  delayMs?: number;
  /** Заголовок блока загрузки. */
  loadingTitle?: React.ReactNode;
  /** Подзаголовок блока загрузки. */
  loadingSubtitle?: React.ReactNode;
  /** Заголовок блока ошибки. */
  errorTitle?: React.ReactNode;
  /** Подпись кнопки повтора. */
  retryLabel?: React.ReactNode;
  /** Полная замена блока загрузки — например скелетон вместо спиннера. */
  loadingSlot?: React.ReactNode;
  /** Полная замена блока ошибки. Render-функция получает `error` / `retry` / `canRetry`. */
  errorSlot?:
    | React.ReactNode
    | ((props: AsyncBoundaryErrorRenderProps<React.ReactNode>) => React.ReactNode);
  /** Контент, видимый при `status === 'ready'` и `'idle'`. */
  children?: React.ReactNode;
  /** Класс региона-обёртки. */
  className?: string;
}

/**
 * Контейнер состояний загрузки данных: `idle` / `loading` / `ready` / `error`.
 *
 * Работает без настройки — блоки загрузки и ошибки отрисуются сами, на токенах темы.
 * Любой заменяется через `loadingSlot` / `errorSlot`; для полного контроля над составом
 * состояний берите headless-версию из `@reformer/cdk/async-boundary`.
 *
 * Это не Suspense-boundary: ничего не бросается, статусом управляет консумент, данные
 * компонент не грузит. В состоянии `idle` (загрузка не запускалась — форма создания)
 * показывается `children`, а не индикатор.
 *
 * @param props - См. {@link AsyncBoundaryProps}.
 * @returns Регион с текущим состоянием загрузки.
 *
 * @example Self-managed — состояние ведёт сам компонент
 * ```tsx
 * import { AsyncBoundary } from '@reformer/ui-kit';
 *
 * function ApplicationPage({ applicationId, form }: Props) {
 *   return (
 *     <AsyncBoundary
 *       load={(signal) => loadApplication(applicationId, signal)}
 *       loadKey={applicationId}
 *       enabled={applicationId !== null}
 *       onSuccess={(data) => form.patchValue(data)}
 *       delayMs={200}
 *     >
 *       <CreditForm form={form} />
 *     </AsyncBoundary>
 *   );
 * }
 * ```
 *
 * @example Controlled — загрузкой владеет внешний код
 * ```tsx
 * <AsyncBoundary status={status} error={error} onRetry={reload}>
 *   <CreditForm form={form} />
 * </AsyncBoundary>
 * ```
 *
 * @example Перезагрузка снаружи через ref
 * ```tsx
 * const boundaryRef = useRef<AsyncBoundaryHandle<Application>>(null);
 *
 * <button onClick={() => boundaryRef.current?.reload()}>Обновить</button>
 * <AsyncBoundary ref={boundaryRef} load={loadApplication}>…</AsyncBoundary>
 * ```
 *
 * @example Скелетон вместо спиннера
 * ```tsx
 * <AsyncBoundary
 *   status={status}
 *   loadingSlot={
 *     <div className="space-y-2">
 *       {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
 *     </div>
 *   }
 * >
 *   <DataTable rows={rows} />
 * </AsyncBoundary>
 * ```
 *
 * @example Внутри RenderSchema — статус подставляется через `patchProps`
 * ```tsx
 * const schema = createRenderSchema(() => ({
 *   selector: 'data-boundary',
 *   component: AsyncBoundary,
 *   componentProps: { status: 'loading' },
 *   children: [{ value: model.$.email, component: Input }],
 * }));
 * // позже, из behavior:
 * schema.node('data-boundary').patchProps({ status: 'ready' });
 * schema.node('data-boundary').patchProps({ status: 'error', error: 'Не удалось загрузить' });
 * ```
 */
function AsyncBoundaryInner<T>(
  {
    load,
    loadKey,
    enabled,
    onSuccess,
    onError,
    toError,
    status,
    error = null,
    onRetry,
    refreshing = false,
    delayMs = 0,
    loadingTitle,
    loadingSubtitle,
    errorTitle,
    retryLabel,
    loadingSlot,
    errorSlot,
    children,
    className,
  }: AsyncBoundaryProps<T>,
  ref: React.ForwardedRef<AsyncBoundaryHandle<T, React.ReactNode>>
) {
  return (
    <AsyncBoundaryPrimitive.Root<T, React.ReactNode>
      ref={ref}
      load={load}
      loadKey={loadKey}
      enabled={enabled}
      onSuccess={onSuccess}
      onError={onError}
      toError={toError}
      status={status}
      error={error}
      refreshing={refreshing}
      delayMs={delayMs}
      onRetry={onRetry}
    >
      <AsyncBoundaryRegion className={className}>
        <AsyncBoundaryPrimitive.Loading>
          {loadingSlot ?? <AsyncBoundaryLoading title={loadingTitle} subtitle={loadingSubtitle} />}
        </AsyncBoundaryPrimitive.Loading>

        <AsyncBoundaryPrimitive.Error<React.ReactNode>>
          {(renderProps) => {
            if (typeof errorSlot === 'function') return errorSlot(renderProps);
            if (errorSlot !== undefined) return errorSlot;
            return (
              <AsyncBoundaryError
                error={renderProps.error}
                title={errorTitle}
                retryLabel={retryLabel}
                // Кнопку показываем только когда повтор реально возможен: неработающий
                // контрол хуже отсутствующего — он ловит фокус и читается скринридером.
                onRetry={renderProps.canRetry ? renderProps.retry : undefined}
              />
            );
          }}
        </AsyncBoundaryPrimitive.Error>

        <AsyncBoundaryPrimitive.Idle>{children}</AsyncBoundaryPrimitive.Idle>
        <AsyncBoundaryPrimitive.Content>{children}</AsyncBoundaryPrimitive.Content>
      </AsyncBoundaryRegion>
    </AsyncBoundaryPrimitive.Root>
  );
}

// Дженерик + forwardRef: React.forwardRef стирает параметр типа, поэтому результат
// приводим к дженерик-сигнатуре вручную — тот же приём, что у FormArray/FormWizard в CDK.
// (Обычные shadcn-порты forwardRef не используют; здесь он нужен ради AsyncBoundaryHandle.)
const AsyncBoundary = React.forwardRef(AsyncBoundaryInner) as (<T = unknown>(
  props: AsyncBoundaryProps<T> & {
    ref?: React.ForwardedRef<AsyncBoundaryHandle<T, React.ReactNode>>;
  }
) => React.ReactElement) & { displayName?: string };

AsyncBoundary.displayName = 'AsyncBoundary';

export {
  AsyncBoundary,
  AsyncBoundaryLoading,
  AsyncBoundaryError,
  AsyncBoundaryEmpty,
  type AsyncStatus,
};
