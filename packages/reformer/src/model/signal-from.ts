/**
 * Сигнал над событийным источником — мост из мира `subscribe`/`getState` в сигналы.
 *
 * @module model/signal-from
 */

import type { ReadonlySignal } from '@preact/signals-core';
import { OwnedSignal } from './owned-signal';
import { onScopeDispose } from './scope';

/** То, что возвращает подписка источника: функция отписки или объект с `dispose()`. */
export type SourceSubscription = (() => void) | { dispose(): void };

/**
 * Сигнал над событийным источником: значение — `read()`, обновляется по событию источника.
 *
 * Подписка берётся сразу, а не при первом читателе: `peek()` без подписчиков (команда, проверка
 * перед закрытием) обязан видеть свежее значение. Подписка принадлежит текущей области
 * (`createStore`, `scope.run`) и снимается вместе с ней; вне области её некому снять — в режиме
 * разработки ядро об этом предупредит.
 *
 * Сигнал снаружи только читается: запись `.value` бросает `TypeError`. Новое значение приходит
 * только из источника.
 *
 * @param read - Текущее значение источника. Вызывается сразу и на каждое событие.
 * @param subscribe - Подписка на изменения источника; возвращает отписку.
 * @returns Сигнал только для чтения со значением источника.
 *
 * @example
 * ```typescript
 * import { createStore, signalFrom } from '@reformer/core/model';
 *
 * const online = createStore(() => ({
 *   value: signalFrom(
 *     () => navigator.onLine,
 *     (onChange) => {
 *       window.addEventListener('online', onChange);
 *       window.addEventListener('offline', onChange);
 *       return () => {
 *         window.removeEventListener('online', onChange);
 *         window.removeEventListener('offline', onChange);
 *       };
 *     }
 *   ),
 * }));
 * ```
 *
 * @group Model
 */
export function signalFrom<T>(
  read: () => T,
  subscribe: (onChange: () => void) => SourceSubscription
): ReadonlySignal<T> {
  const value = new OwnedSignal(read());
  const subscription = subscribe(() => value.set(read()));
  onScopeDispose(typeof subscription === 'function' ? subscription : () => subscription.dispose());
  return value;
}
