/**
 * Чистая (React-free) машина состояний асинхронной загрузки для `AsyncBoundary`.
 *
 * Вынесена из компонента, чтобы переходы (старт / успех / ошибка / отмена / пропуск)
 * были юнит-тестируемы без DOM — в монорепо тесты логики это обычные `.test.ts`
 * без jsdom. Тот же приём, что в `select-resource` у ui-kit.
 *
 * @module reformer/cdk/async-boundary/async-resource
 */

import type { AsyncStatus } from './types';

/** Снимок состояния загрузки. */
export interface AsyncResourceState<T, E> {
  /** Текущее состояние операции. */
  status: AsyncStatus;
  /** Последние успешно загруженные данные (сохраняются при ошибке и перезагрузке). */
  data: T | undefined;
  /** Ошибка последней попытки. */
  error: E | null;
  /** Идёт повторная загрузка поверх уже показанных данных. */
  refreshing: boolean;
}

/** Действия машины состояний. */
export type AsyncResourceAction<T, E> =
  /** Загрузка отключена (`enabled: false`) — грузить нечего. */
  | { kind: 'skip' }
  /** Запрос отправлен. */
  | { kind: 'load-start' }
  /** Запрос успешно завершён. */
  | { kind: 'load-success'; data: T }
  /** Запрос завершился ошибкой. */
  | { kind: 'load-error'; error: E }
  /** Загрузка прервана вручную (`handle.abort()`). */
  | { kind: 'abort' };

/** Начальное состояние: до первого эффекта загрузка ещё не запускалась. */
export function initialAsyncResourceState<T, E>(): AsyncResourceState<T, E> {
  return { status: 'idle', data: undefined, error: null, refreshing: false };
}

/**
 * Редьюсер загрузки.
 *
 * Ключевое правило перехода `load-start`: если данные уже есть, состояние остаётся
 * `ready` с поднятым `refreshing` (stale-while-revalidate) — иначе при каждом обновлении
 * контент подменялся бы спиннером и пользователь терял бы позицию на экране.
 *
 * @param state - Текущее состояние.
 * @param action - Действие.
 * @returns Новое состояние.
 *
 * @example Перезагрузка поверх данных не роняет экран в loading
 * ```ts
 * let s = initialAsyncResourceState<User, string>();
 * s = asyncResourceReducer(s, { kind: 'load-start' });                  // status: 'loading'
 * s = asyncResourceReducer(s, { kind: 'load-success', data: user });    // status: 'ready'
 * s = asyncResourceReducer(s, { kind: 'load-start' });                  // 'ready' + refreshing
 * ```
 *
 * @example Ошибка не стирает ранее загруженные данные
 * ```ts
 * const failed = asyncResourceReducer(ready, { kind: 'load-error', error: 'timeout' });
 * failed.status; // 'error'
 * failed.data;   // прежние данные на месте — их можно показать рядом с ошибкой
 * ```
 */
export function asyncResourceReducer<T, E>(
  state: AsyncResourceState<T, E>,
  action: AsyncResourceAction<T, E>
): AsyncResourceState<T, E> {
  switch (action.kind) {
    case 'skip':
      return { status: 'idle', data: undefined, error: null, refreshing: false };

    case 'load-start':
      return state.data !== undefined
        ? { ...state, status: 'ready', error: null, refreshing: true }
        : { status: 'loading', data: undefined, error: null, refreshing: false };

    case 'load-success':
      return { status: 'ready', data: action.data, error: null, refreshing: false };

    case 'load-error':
      // data намеренно сохраняем: консумент может показать устаревшие данные рядом
      // с сообщением об ошибке вместо пустого экрана.
      return { status: 'error', data: state.data, error: action.error, refreshing: false };

    case 'abort':
      // Прерванная загрузка — не ошибка. Есть данные → возвращаемся к ним,
      // нет → к «ещё не грузили», иначе экран завис бы на спиннере навсегда.
      return {
        status: state.data !== undefined ? 'ready' : 'idle',
        data: state.data,
        error: null,
        refreshing: false,
      };
  }
}

/**
 * Приведение неизвестного отказа промиса к человекочитаемой строке —
 * дефолт для `toError`, когда консумент не задал своё преобразование.
 *
 * @param e - Значение, с которым отклонился промис.
 * @returns Сообщение об ошибке.
 *
 * @example
 * ```ts
 * defaultToError(new Error('Ошибка загрузки заявки')); // 'Ошибка загрузки заявки'
 * defaultToError('boom');                              // 'boom'
 * defaultToError({});                                  // 'Неизвестная ошибка'
 * ```
 */
export function defaultToError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string' && e.length > 0) return e;
  return 'Неизвестная ошибка';
}
