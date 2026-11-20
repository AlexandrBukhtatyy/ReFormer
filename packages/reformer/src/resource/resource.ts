/**
 * `resource()` — асинхронная загрузка на сигналах: ключ, отмена устаревших запросов,
 * stale-while-revalidate и время жизни в области.
 *
 * @module resource/resource
 */

import { computed, untracked, type ReadonlySignal } from '@preact/signals-core';
import { deepEqual } from '../model/model-nodes';
import { OwnedSignal } from '../model/owned-signal';
import { createStore } from '../model/scope';
import {
  asyncResourceReducer,
  initialAsyncResourceState,
  type AsyncResourceAction,
  type AsyncResourceState,
  type AsyncStatus,
} from './machine';

/**
 * Настройки {@link resource}.
 *
 * @typeParam T - Тип данных.
 * @typeParam K - Тип ключа загрузки.
 * @typeParam E - Тип ошибки (результат `toError`).
 *
 * @group Resource
 */
export interface ResourceOptions<T, K = void, E = unknown> {
  /**
   * Ключ загрузки — реактивно: читает сигналы, и их смена перезапускает загрузку. `null` или
   * `undefined` — грузить нечего (`idle`). Без `key` ресурс грузится один раз с ключом `undefined`.
   */
  key?: () => K | null | undefined;
  /** Загрузка. `signal` отменяется, когда запрос устарел (новый ключ, `abort`, `dispose`). */
  load: (key: K, ctx: { signal: AbortSignal; previous: T | undefined }) => Promise<T>;
  /** Загрузка включена — реактивно. Выключенная загрузка сбрасывает ресурс в `idle`. */
  enabled?: () => boolean;
  /** Данные до первой загрузки: ресурс сразу `ready`, первый запрос идёт фоном (`refreshing`). */
  initialData?: T;
  /**
   * Показывать прежние данные, пока грузятся данные нового ключа (`ready` + `refreshing`).
   * `false` — новый ключ сбрасывает данные и показывает `loading`. По умолчанию `true`.
   */
  keepPrevious?: boolean;
  /** Равенство ключей: ключ, равный загруженному, нового запроса не даёт. По умолчанию — глубокое. */
  equals?: (a: K, b: K) => boolean;
  /** Приведение отказа к ошибке ресурса. По умолчанию ошибка — сам отказ. */
  toError?: (error: unknown) => E;
  /** Успешная загрузка актуального запроса. */
  onSuccess?: (data: T) => void;
  /** Отказ актуального запроса. Отмена отказом не считается. */
  onError?: (error: E) => void;
}

/**
 * Ресурс: состояние загрузки сигналами и команды.
 *
 * @group Resource
 */
export interface Resource<T, E = unknown> {
  /** Состояние целиком — одна подписка на все поля. */
  readonly state: ReadonlySignal<AsyncResourceState<T, E>>;
  /** Последние успешно загруженные данные (сохраняются при ошибке и перезагрузке). */
  readonly data: ReadonlySignal<T | undefined>;
  readonly status: ReadonlySignal<AsyncStatus>;
  readonly error: ReadonlySignal<E | null>;
  /** Идёт загрузка поверх показанных данных. */
  readonly refreshing: ReadonlySignal<boolean>;
  /** Идёт любая загрузка: первая (`loading`) или фоновая (`refreshing`). */
  readonly isFetching: ReadonlySignal<boolean>;
  /** Перезапросить текущий ключ. Без ключа (`idle`) — no-op. */
  reload(): void;
  /** Отменить текущий запрос. Ресурс возвращается к показанным данным или к `idle`. */
  abort(): void;
  /** Заменить данные без запроса (оптимистичное обновление). */
  mutate(next: T | ((previous: T | undefined) => T)): void;
  /** Дождаться, пока не останется запланированных и идущих запросов. */
  settled(): Promise<void>;
  /** Отменить запрос и перестать следить за ключом. */
  dispose(): void;
}

/** Ключа нет: загрузка не запланирована. Отличается от ключа `undefined` ресурса без `key`. */
const NONE: unique symbol = Symbol('resource.none');

/**
 * Асинхронная загрузка на сигналах.
 *
 * Ключ (`key`) — реактивный: смена прочитанных сигналов перезапускает загрузку, а предыдущий
 * запрос отменяется через `AbortSignal`. Ответ устаревшего запроса не применяется, даже если
 * загрузка сигнал отмены не слушает.
 *
 * Запрос уходит в микрозадаче: несколько смен ключа в одном тике (фильтр и сброс страницы)
 * дают один запрос — с последним ключом. Статус `loading` (или `refreshing`) виден сразу.
 *
 * Ресурс принадлежит текущей области (`createStore`, `scope.run`) и снимается вместе с ней.
 *
 * @param options - См. {@link ResourceOptions}.
 * @returns Ресурс.
 *
 * @example
 * ```typescript
 * import { createModel, createStore } from '@reformer/core/model';
 * import { resource } from '@reformer/core/resource';
 *
 * const page = createStore(() => {
 *   const model = createModel({ userId: 0 });
 *   const user = resource({
 *     key: () => (model.userId > 0 ? model.userId : null),
 *     load: (id, { signal }) => fetch(`/api/users/${id}`, { signal }).then((r) => r.json()),
 *   });
 *   return { model, user };
 * });
 *
 * page.model.userId = 7; // запрос /api/users/7; прежний, если шёл, отменён
 * page.user.status.value; // 'loading' → 'ready'
 * ```
 *
 * @group Resource
 */
export function resource<T, K = void, E = unknown>(
  options: ResourceOptions<T, K, E>
): Resource<T, E> {
  return createStore((scope) => {
    const keepPrevious = options.keepPrevious ?? true;
    const equals = options.equals ?? deepEqual;
    const toError = options.toError ?? ((error: unknown) => error as E);
    const readKey = options.key ?? ((): K => undefined as K);

    const state = new OwnedSignal<AsyncResourceState<T, E>>(
      options.initialData === undefined
        ? initialAsyncResourceState<T, E>()
        : { status: 'ready', data: options.initialData, error: null, refreshing: false }
    );
    const dispatch = (action: AsyncResourceAction<T, E>): void =>
      state.set(asyncResourceReducer(state.peek(), action));

    /** Ключ, загруженный или загружаемый сейчас. */
    let current: K | typeof NONE = NONE;
    /** Ключ, запрос которого ждёт микрозадачи. */
    let scheduled: K | typeof NONE = NONE;
    let queued = false;
    let controller: AbortController | undefined;
    let inflight: Promise<void> | undefined;
    let disposed = false;

    const cancel = (): void => {
      scheduled = NONE;
      controller?.abort();
      controller = undefined;
      inflight = undefined;
    };

    const run = (key: K): void => {
      const own = new AbortController();
      controller = own;
      const previous = state.peek().data;
      let pending: Promise<T>;
      try {
        pending = Promise.resolve(options.load(key, { signal: own.signal, previous }));
      } catch (error) {
        pending = Promise.reject(error);
      }
      const settledRun: Promise<void> = pending
        .then(
          (data) => {
            if (own.signal.aborted || controller !== own) return;
            dispatch({ kind: 'load-success', data });
            options.onSuccess?.(data);
          },
          (reason: unknown) => {
            if (own.signal.aborted || controller !== own) return;
            const error = toError(reason);
            dispatch({ kind: 'load-error', error });
            options.onError?.(error);
          }
        )
        .finally(() => {
          if (inflight === settledRun) inflight = undefined;
          if (controller === own) controller = undefined;
        });
      inflight = settledRun;
    };

    const flush = (): void => {
      queued = false;
      if (disposed || scheduled === NONE) return;
      const key = scheduled;
      scheduled = NONE;
      run(key);
    };

    /** Запланировать запрос ключа. `fresh` — новый ключ, а не перезапрос текущего. */
    const request = (key: K, fresh: boolean): void => {
      controller?.abort();
      controller = undefined;
      inflight = undefined;
      if (fresh && !keepPrevious && state.peek().data !== undefined) dispatch({ kind: 'skip' });
      dispatch({ kind: 'load-start' });
      scheduled = key;
      if (!queued) {
        queued = true;
        queueMicrotask(flush);
      }
    };

    scope.effect(() => {
      const key = readKey();
      const enabled = options.enabled ? options.enabled() : true;
      untracked(() => {
        if (!enabled || key === null || (key === undefined && options.key !== undefined)) {
          if (current === NONE && state.peek().status === 'idle') return;
          current = NONE;
          cancel();
          dispatch({ kind: 'skip' });
          return;
        }
        if (current !== NONE && equals(current, key as K)) return;
        current = key as K;
        request(key as K, true);
      });
    });
    // Снятие области (своей или родительской) отменяет запрос и запланированную загрузку.
    scope.add(() => {
      disposed = true;
      cancel();
    });

    const data = computed(() => state.value.data);
    const status = computed(() => state.value.status);
    const refreshing = computed(() => state.value.refreshing);

    return {
      state,
      data,
      status,
      error: computed(() => state.value.error),
      refreshing,
      isFetching: computed(() => status.value === 'loading' || refreshing.value),
      reload(): void {
        if (current !== NONE && !disposed) request(current, false);
      },
      abort(): void {
        if (scheduled === NONE && controller === undefined) return;
        cancel();
        dispatch({ kind: 'abort' });
      },
      mutate(next: T | ((previous: T | undefined) => T)): void {
        const prev = state.peek();
        const value =
          typeof next === 'function' ? (next as (p: T | undefined) => T)(prev.data) : next;
        state.set({ ...prev, status: 'ready', data: value, error: null });
      },
      async settled(): Promise<void> {
        for (;;) {
          if (queued) {
            await Promise.resolve();
            continue;
          }
          const running = inflight;
          if (running === undefined) return;
          await running;
        }
      },
    };
  });
}
