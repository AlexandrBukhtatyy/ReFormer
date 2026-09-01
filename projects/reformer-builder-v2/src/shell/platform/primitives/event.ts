/**
 * Шина событий: факт произошёл, кому надо — узнал.
 *
 * Событие сообщает о факте, а не запрашивает работу. Если отправителю важно, что именно
 * произойдёт в ответ и в каком порядке, — это не событие, а команда.
 *
 * Два правила, на которых держится всё остальное:
 *
 * **Доставка синхронная.** Иначе события нельзя публиковать из контура правки модели, который
 * обязан оставаться синхронным: к моменту доставки состояние уже было бы другим, и подписчик
 * увидел бы не тот мир, о котором ему сообщили. Отсюда обязанность подписчика: обработчик
 * должен быть дешёвым, всё тяжёлое планирует себя сам.
 *
 * **Ошибка подписчика не касается отправителя.** Она не прерывает рассылку и не выходит
 * наружу из `emit` — см. {@link EventBusOptions.onListenerError}.
 *
 * @module shell/platform/primitives/event
 */

import { toDisposable, type Disposable } from './disposable';

/**
 * Типизированный ключ события: связывает идентификатор с типом полезной нагрузки.
 *
 * Тот же приём, что у токена сервиса, и по той же причине — строка с приведением типа
 * на каждой подписке рано или поздно разъезжается с тем, что кладут в `emit`.
 */
export interface EventType<T> {
  readonly id: string;
  /** Только для вывода типов, в рантайме отсутствует. */
  readonly __type?: T;
}

/**
 * Объявляет тип события.
 *
 * Идентификатор — с пространством имён владельца (`workspace.didChange`, `editor.didFocus`):
 * шина различает события только по нему, и совпадение у двух плагинов означает перекрёстную
 * доставку с чужой нагрузкой.
 */
export function defineEvent<T>(id: string): EventType<T> {
  if (id.trim() === '') {
    throw new Error('defineEvent: идентификатор события не может быть пустым');
  }
  return Object.freeze({ id });
}

/** Шина: публикация и подписка. Больше ничего — всё остальное строится поверх. */
export interface EventBus {
  /**
   * Синхронно доставляет нагрузку всем подписчикам этого типа.
   *
   * Возвращает управление только после того, как отработал последний подписчик. Ошибка
   * любого из них не прерывает рассылку и не выходит наружу.
   */
  emit<T>(type: EventType<T>, payload: T): void;

  /**
   * Подписывает обработчик. `dispose()` отписывает ровно эту подписку — один и тот же
   * обработчик, подписанный дважды, вызывается дважды и отписывается по одному.
   *
   * Отписка действует немедленно, в том числе изнутри доставки: подписчик, снятый другим
   * подписчиком, уже не получит текущее событие.
   */
  on<T>(type: EventType<T>, cb: (payload: T) => void): Disposable;
}

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
