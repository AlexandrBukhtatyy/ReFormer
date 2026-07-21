import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  asyncResourceReducer,
  defaultToError,
  initialAsyncResourceState,
  type AsyncResourceState,
} from './async-resource';

/** Опции {@link useAsyncResource}. */
export interface UseAsyncResourceOptions<T, E = string> {
  /**
   * Загрузчик. Получает `AbortSignal` — прокиньте его в `fetch`, чтобы отменённый
   * запрос не висел в сети.
   */
  load: (signal: AbortSignal) => Promise<T>;
  /**
   * Ключ перезапуска: при изменении запускается новая загрузка (обычно id записи).
   * Сравнивается по `Object.is`, поэтому передавайте примитив, а не свежий объект.
   */
  loadKey?: unknown;
  /**
   * `false` → загрузка не стартует, состояние `idle`. Режим создания новой записи.
   * @default true
   */
  enabled?: boolean;
  /**
   * Побочный эффект после успеха — например `form.patchValue(data)`.
   *
   * Вызывается уже вне реактивного контекста (из колбэка промиса). Если внутри вы
   * пишете и в значения формы, и в `updateComponentProps`, разнесите второе в
   * `queueMicrotask` — иначе preact бросит «Cycle detected».
   */
  onSuccess?: (data: T) => void;
  /** Побочный эффект после ошибки — логирование, тост. */
  onError?: (error: E) => void;
  /** Преобразование отказа промиса в отображаемую ошибку. @default {@link defaultToError} */
  toError?: (e: unknown) => E;
}

/** Возвращаемое значение {@link useAsyncResource}. */
export interface UseAsyncResourceReturn<T, E = string> extends AsyncResourceState<T, E> {
  /** Перезапустить загрузку вручную (кнопка «Повторить», внешний триггер). */
  reload: () => void;
  /** Прервать текущий запрос. Прерывание не считается ошибкой. */
  abort: () => void;
}

/**
 * Хук асинхронной загрузки с отменой, повтором и stale-while-revalidate.
 *
 * Тонкая React-обёртка над чистым редьюсером из `async-resource.ts` — вся логика
 * переходов там и тестируется без DOM.
 *
 * Закрывает три дыры, типичные для рукописных `useEffect`-загрузчиков:
 * гонку при быстрой смене `loadKey` (побеждал бы ответ, пришедший последним),
 * отсутствие повтора и потерю состояния «грузить нечего».
 *
 * @typeParam T - Тип загружаемых данных.
 * @typeParam E - Тип отображаемой ошибки (по умолчанию строка).
 * @param options - См. {@link UseAsyncResourceOptions}.
 * @returns Состояние загрузки плюс `reload` / `abort`.
 *
 * @example Загрузка заявки со справочниками как одна единица
 * ```tsx
 * const { status, error, reload } = useAsyncResource({
 *   loadKey: applicationId,
 *   enabled: applicationId !== null,
 *   load: async (signal) => {
 *     const [app, dict] = await Promise.all([
 *       fetchCreditApplication(applicationId!, signal),
 *       fetchDictionaries(signal),
 *     ]);
 *     if (app.status !== 200) throw new Error('Ошибка загрузки заявки');
 *     if (dict.status !== 200) throw new Error('Ошибка загрузки справочников');
 *     return { app: app.data, dict: dict.data };
 *   },
 *   onSuccess: ({ app, dict }) => {
 *     form.patchValue(app);
 *     queueMicrotask(() => applyDictionaries(form, dict));
 *   },
 * });
 * ```
 *
 * @example Отмена при уходе со страницы происходит сама
 * ```tsx
 * // Смена userId прерывает предыдущий запрос: ответ на устаревший id
 * // отбрасывается и не перетирает свежие данные.
 * const { data } = useAsyncResource({
 *   loadKey: userId,
 *   load: (signal) => fetch(`/api/users/${userId}`, { signal }).then((r) => r.json()),
 * });
 * ```
 */
export function useAsyncResource<T, E = string>({
  load,
  loadKey,
  enabled = true,
  onSuccess,
  onError,
  toError,
}: UseAsyncResourceOptions<T, E>): UseAsyncResourceReturn<T, E> {
  const [state, dispatch] = useReducer(
    asyncResourceReducer<T, E>,
    undefined,
    initialAsyncResourceState<T, E>
  );
  const [reloadNonce, setReloadNonce] = useState(0);

  // Колбэки читаем через ref: инлайновые стрелки у консумента меняются каждый рендер,
  // и если положить их в deps эффекта, загрузка перезапускалась бы бесконечно.
  const loadRef = useRef(load);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const toErrorRef = useRef(toError);
  loadRef.current = load;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  toErrorRef.current = toError;

  // Контроллер текущего запроса — чтобы abort() мог прервать его извне эффекта.
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  const abort = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.abort();
    controllerRef.current = null;
    dispatch({ kind: 'abort' });
  }, []);

  useEffect(() => {
    if (!enabled) {
      dispatch({ kind: 'skip' });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    // Локальный флаг вдобавок к signal: он закрывается этим конкретным запуском
    // эффекта, поэтому ответ предыдущего loadKey не пройдёт даже если его промис
    // резолвится уже после старта нового запроса.
    let cancelled = false;

    dispatch({ kind: 'load-start' });

    loadRef.current(controller.signal).then(
      (data) => {
        if (cancelled) return;
        dispatch({ kind: 'load-success', data });
        onSuccessRef.current?.(data);
      },
      (e) => {
        // Отмена — не ошибка: экран не должен краснеть из-за собственного unmount'а.
        if (cancelled || controller.signal.aborted) return;
        const error = (toErrorRef.current ?? (defaultToError as (e: unknown) => E))(e);
        dispatch({ kind: 'load-error', error });
        onErrorRef.current?.(error);
      }
    );

    return () => {
      cancelled = true;
      controller.abort();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [loadKey, enabled, reloadNonce]);

  return useMemo(() => ({ ...state, reload, abort }), [state, reload, abort]);
}
