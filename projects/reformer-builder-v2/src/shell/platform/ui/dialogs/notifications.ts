/**
 * Показ уведомлений — всё, что в нём является правилом, а не отрисовкой.
 *
 * Служба уведомлений (`host/services/notifications`) держит ОЧЕРЕДЬ не показанных запросов
 * и намеренно ничего не знает ни про тосты, ни про таймеры. Здесь — вторая половина: как эта
 * очередь превращается в показ и почему она при этом пустеет.
 *
 * ## Очередь опустошается тем, кто показал
 *
 * `pending()` — это «ещё не показано», а не «висит на экране». Поэтому предъявивший тост
 * обязан снять запрос из очереди: иначе повторная отрисовка (смена локали, перемонтирование
 * оболочки, любой лишний кадр) показала бы всё заново, и одна ошибка открытия проекта
 * превратилась бы в поток одинаковых тостов.
 *
 * ## Показанное помнится, потому что кадр может повториться
 *
 * `StrictMode` вызывает эффекты дважды с ОДНИМ И ТЕМ ЖЕ снимком, и снятие из очереди этого
 * не спасает: второй проход идёт по уже устаревшему массиву. Поэтому здесь есть множество
 * показанных идентификаторов — оно ограничено ({@link SHOWN_LIMIT}), потому что растущее
 * вечно множество в долгой сессии это утечка, а помнить больше, чем помещается в очередь
 * службы, незачем.
 *
 * ## Сообщение переводится ЗДЕСЬ, а не в месте возникновения
 *
 * `messageKey` + `params` разрешаются в момент показа: уведомление могло попасть в очередь
 * до загрузки словаря (служба существует раньше оболочки — Э5 позже Э4), и готовая строка
 * означала бы текст на языке, который был активен ТОГДА.
 *
 * Ни React, ни DOM, ни `sonner` здесь нет намеренно: окружение тестов — `node`, и правило
 * «показанное не показывается второй раз» обязано проверяться без браузера.
 *
 * @module shell/platform/ui/dialogs/notifications
 */

import type { Notification, NotificationLevel } from '@/shell/platform/services/notifications';

/** Сколько идентификаторов помнить. Больше очереди службы (100) — с запасом на устаревший кадр. */
export const SHOWN_LIMIT = 200;

/** Перевод сообщения. Функция, а не сервис: правилу нужен результат, а не источник. */
export type TranslateMessage = (key: string, params?: Record<string, unknown>) => string;

/** Кнопка тоста: подпись уже переведена, действие — то, что дал заказчик уведомления. */
export interface ToastAction {
  readonly label: string;
  run(): void;
}

/** Тост, готовый к показу: строки разрешены, решать отрисовке нечего. */
export interface ToastSpec {
  readonly id: string;
  readonly level: NotificationLevel;
  readonly message: string;
  /** Подсказка отрисовке, сколько держать тост. Без значения решает она сама. */
  readonly durationMs?: number;
  readonly action?: ToastAction;
}

/** Приводит уведомление к тосту, разрешая сообщение и подпись кнопки. */
export function toToast(notification: Notification, translate: TranslateMessage): ToastSpec {
  const action = notification.action;
  return {
    id: notification.id,
    level: notification.level,
    message: translate(notification.messageKey, notification.params),
    ...(notification.durationMs === undefined ? {} : { durationMs: notification.durationMs }),
    ...(action === undefined
      ? {}
      : {
          action: {
            label: translate(action.titleKey),
            run: () => {
              action.run();
            },
          },
        }),
  };
}

/**
 * Запоминает показанное, не давая множеству расти вечно.
 *
 * `Set` перебирается в порядке вставки, поэтому «самый старый» — это первый ключ, и вытеснение
 * стоит одного шага итератора.
 */
function remember(shown: Set<string>, id: string): void {
  shown.add(id);
  while (shown.size > SHOWN_LIMIT) {
    const oldest = shown.values().next();
    if (oldest.done === true) return;
    shown.delete(oldest.value);
  }
}

export interface DrainOptions {
  /** Идентификаторы уже показанного. Живёт между вызовами — иначе кадр повторится вместе с ним. */
  readonly shown: Set<string>;
  /** Показать тост. Всё, что тут может пойти не так, — забота отрисовки. */
  present(toast: ToastSpec): void;
  /** Снять запрос из очереди службы. */
  dismiss(id: string): void;
  readonly translate: TranslateMessage;
  /** Куда сообщать об упавшем показе. Без обработчика отказ проглатывается молча. */
  readonly onError?: (error: unknown, id: string) => void;
}

/**
 * Показывает всё, что накопилось, и опустошает очередь.
 *
 * Отказ показа НЕ оставляет запрос в очереди: очередь, из которой невозможно вынуть
 * подавившееся уведомление, встанет колом на нём одном и похоронит все следующие. Об отказе
 * сообщается, и это всё, что тут можно честно сделать.
 */
export function drainNotifications(
  pending: readonly Notification[],
  options: DrainOptions
): readonly ToastSpec[] {
  const shownNow: ToastSpec[] = [];
  for (const notification of pending) {
    if (options.shown.has(notification.id)) continue;
    remember(options.shown, notification.id);
    try {
      const toast = toToast(notification, options.translate);
      options.present(toast);
      shownNow.push(toast);
    } catch (error) {
      options.onError?.(error, notification.id);
    } finally {
      options.dismiss(notification.id);
    }
  }
  return shownNow;
}
