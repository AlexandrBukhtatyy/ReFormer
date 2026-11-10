/**
 * Сторы оболочки на сигналах ядра — мост к портам `{ get, subscribe }`.
 *
 * Хранилище оболочки состоит из одного и того же: снимок со стабильной ссылкой (условие
 * `useSyncExternalStore`), набор подписчиков и сравнение «изменилось ли» перед уведомлением.
 * Сигналы ядра дают это даром: сигнал не уведомляет при равном значении, а `computed` отдаёт ту
 * же ссылку, пока не изменились его источники. Остаётся мост в обе стороны:
 *
 * - {@link signalFrom} — событийный источник (`get` + событие изменения) → сигнал;
 * - {@link toSource} — сигнал → порт `{ get, subscribe }`, который читают React и плагины.
 *
 * Подписки, которые берут эти функции, принадлежат текущей области (`createStore`,
 * `scope.run`) и снимаются вместе с ней — поэтому вызывайте их в `setup` стора.
 *
 * @module shell/platform/primitives/signal-store
 */

import { effect, signal, untracked, type ReadonlySignal } from '@reformer/core/signals';
import { getCurrentScope, onScopeDispose } from '@reformer/core/model';
import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';

/** Порт хранилища оболочки: снимок со стабильной ссылкой и подписка на его смену. */
export interface SignalSource<T> {
  get(): T;
  subscribe(listener: () => void): Disposable;
}

/** Что делать с ошибками подписчиков, собранными за одну рассылку. */
export type ListenerErrorPolicy = (errors: readonly unknown[]) => void;

/**
 * Бросить ошибки подписчиков после рассылки всем: одну — как есть, несколько — `AggregateError`.
 * Изменение уже состоялось и откату не подлежит: половина подписчиков его увидела.
 */
export const throwListenerErrors =
  (message: string): ListenerErrorPolicy =>
  (errors) => {
    if (errors.length === 1) throw errors[0];
    throw new AggregateError(errors, message);
  };

/** Записать ошибки подписчиков в консоль и продолжить: упавший не мешает остальным. */
export const logListenerErrors =
  (message: string): ListenerErrorPolicy =>
  (errors) => {
    for (const error of errors) console.error(message, error);
  };

/**
 * Сигнал над событийным источником: значение — `read()`, обновляется по событию источника.
 *
 * Подписка берётся сразу, а не при первом читателе: `get()` без подписчиков (команда, проверка
 * перед закрытием) обязан видеть свежее значение. Подписка принадлежит текущей области; вне
 * области её некому снять — в разработке ядро об этом предупредит.
 *
 * @example
 * ```ts
 * const dirty = signalFrom(
 *   () => workspace.dirtyResources().length,
 *   (onChange) => workspace.onDidChange(onChange)
 * );
 * ```
 */
export function signalFrom<T>(
  read: () => T,
  subscribe: (onChange: () => void) => Disposable
): ReadonlySignal<T> {
  const value = signal(read());
  const subscription = subscribe(() => {
    value.value = read();
  });
  onScopeDispose(() => subscription.dispose());
  return value;
}

/**
 * Порт `{ get, subscribe }` над сигналом.
 *
 * `get` отдаёт текущее значение сигнала: для `computed` ссылка стабильна, пока не изменились
 * источники. Подписчики уведомляются один раз на изменение; ошибки подписчиков собираются за
 * рассылку и отдаются политике — по умолчанию бросаются ({@link throwListenerErrors}).
 *
 * Эффект-наблюдатель заводится при первом подписчике и снимается с последним; при снятии
 * области, в которой порт создан, снимаются и он, и подписчики.
 */
export function toSource<T>(
  source: ReadonlySignal<T>,
  onListenerErrors: ListenerErrorPolicy = throwListenerErrors('ошибки в подписчиках хранилища')
): SignalSource<T> {
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined;

  const notify = (): void => {
    const errors: unknown[] = [];
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) onListenerErrors(errors);
  };

  const release = (): void => {
    stop?.();
    stop = undefined;
  };

  if (getCurrentScope()) {
    onScopeDispose(() => {
      release();
      listeners.clear();
    });
  }

  return {
    get: () => source.peek(),
    subscribe(listener: () => void): Disposable {
      listeners.add(listener);
      if (!stop) {
        let first = true;
        stop = effect(() => {
          // Чтение ради подписки — вызовом: выражение `void source.value` минификатор выбросил бы.
          source.valueOf();
          if (first) {
            first = false;
            return;
          }
          // Подписчики читают что угодно — их чтения не должны подписывать наблюдателя.
          untracked(notify);
        });
      }
      return toDisposable(() => {
        listeners.delete(listener);
        if (listeners.size === 0) release();
      });
    },
  };
}
