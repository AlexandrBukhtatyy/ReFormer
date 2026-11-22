/**
 * Реализация шины событий, объявленной контрактом плагинов.
 *
 * Ключ события (`EventType`, `defineEvent`) и контракт шины живут в пакете
 * `@reformer/builder-plugin-api`: плагину шина приходит полем контекста, а заводить свою
 * ему незачем. Решения про синхронную доставку и про ошибку подписчика записаны там же.
 *
 * @module shell/platform/primitives/event
 */

import {
  toDisposable,
  type Disposable,
  type EventBus,
  type EventType,
} from '@reformer/builder-plugin-api/internal';

/** Что сообщается об упавшем подписчике. Код и параметры, а не готовая фраза. */
export interface EventListenerErrorInfo {
  /** Идентификатор события, при доставке которого упал подписчик. */
  readonly eventId: string;
}

export interface EventBusOptions {
  /**
   * Куда сообщать об ошибке подписчика. По умолчанию — `console.error`.
   *
   * Решение и его обоснование. Собрать ошибки и бросить `AggregateError` в конце `emit`
   * нельзя: отправитель находится в контуре правки, он не имеет отношения к чужому
   * обработчику и не может ничего с его поломкой сделать — а исключение развалило бы правку,
   * которая уже состоялась. Проглотить молча тоже нельзя: упавший подписчик выглядит как
   * «событие не пришло», и искать причину пришлось бы в отправителе.
   *
   * Поэтому ошибка уходит вбок: отправитель не страдает, ошибка не теряется. Канал
   * подменяемый — тесты его проверяют, а Host позже направит в уведомления и телеметрию;
   * `console.error` по умолчанию нужен, чтобы поломка была видна и без этой проводки.
   */
  readonly onListenerError?: (error: unknown, info: EventListenerErrorInfo) => void;
}

/** Подписка. Флаг снятия нужен, потому что доставка идёт по снимку списка. */
interface Subscription {
  readonly notify: (payload: unknown) => void;
  disposed: boolean;
}

function defaultOnListenerError(error: unknown, info: EventListenerErrorInfo): void {
  console.error(`[event] подписчик «${info.eventId}» упал; рассылка продолжена`, error);
}

/**
 * Создаёт шину.
 *
 * Порядок между подписчиками **не является контрактом**: полагаться на него нельзя, и если
 * порядок важен — это не событие, а команда. Реализация при этом детерминирована (порядок
 * подписки), потому что недетерминизм здесь означал бы тесты, которые падают через раз.
 */
export function createEventBus(options: EventBusOptions = {}): EventBus {
  const onListenerError = options.onListenerError ?? defaultOnListenerError;
  const listeners = new Map<string, Subscription[]>();

  return {
    emit<T>(type: EventType<T>, payload: T): void {
      const subscriptions = listeners.get(type.id);
      if (subscriptions === undefined || subscriptions.length === 0) return;

      // Снимок: подписка, добавленная обработчиком, не получает текущее событие — иначе
      // подписка изнутри доставки продолжала бы её бесконечно. Уже снятые пропускаем по
      // флагу: снимок их ещё содержит, а `dispose()` обязан действовать сразу.
      for (const subscription of [...subscriptions]) {
        if (subscription.disposed) continue;
        try {
          subscription.notify(payload);
        } catch (error) {
          onListenerError(error, { eventId: type.id });
        }
      }
    },

    on<T>(type: EventType<T>, cb: (payload: T) => void): Disposable {
      // Единственное приведение во всём модуле. Соответствие нагрузки типу гарантирует
      // `EventType<T>` на границе `on`/`emit`; внутри список подписок общий для всех типов,
      // и параметризовать его нечем.
      const subscription: Subscription = {
        notify: (payload) => {
          cb(payload as T);
        },
        disposed: false,
      };

      const existing = listeners.get(type.id);
      if (existing === undefined) listeners.set(type.id, [subscription]);
      else existing.push(subscription);

      return toDisposable(() => {
        subscription.disposed = true;
        const current = listeners.get(type.id);
        if (current === undefined) return;
        const index = current.indexOf(subscription);
        if (index >= 0) current.splice(index, 1);
        // Пустой список удаляем: иначе шина растёт на каждый тип, о котором кто-то когда-то
        // спрашивал, и это утечка тем более заметная, чем чаще включают и выключают плагины.
        if (current.length === 0) listeners.delete(type.id);
      });
    },
  };
}
