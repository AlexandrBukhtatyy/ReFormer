/**
 * Отрисовка уведомлений: очередь службы — на экран.
 *
 * До этого компонента служба уведомлений работала «в стол»: отказ открытия проекта уходил
 * в очередь, очередь никто не читал, и единственным следом происходящего оставалась строка
 * в консоли. Здесь очередь наконец кто-то опустошает.
 *
 * ## Компонент тонкий по построению
 *
 * Всё, что является правилом (перевод сообщения, память о показанном, опустошение очереди),
 * живёт в `./notifications` и проверяется без браузера — окружение тестов `node`. Здесь
 * остаётся ровно связь: подписка на службу, эффект показа и сам `Toaster` кита.
 *
 * ## Почему `sonner` появляется только тут
 *
 * Служба уведомлений намеренно не знает про библиотеку тостов (см. её шапку): уведомляют все,
 * и прямой вызов `toast()` из каждой второй точки означал бы зависимость платформы от
 * отрисовки. Здесь эта зависимость ровно одна, и заменить её (показать те же сообщения
 * в панели, в журнале) можно правкой одного файла.
 *
 * ## Таймеры — у отрисовки
 *
 * `durationMs` уведомления — подсказка, а не расписание: держит тост, ставит его на паузу
 * под курсором и закрывает `sonner`, потому что это он знает, где курсор. Служба таймеров
 * не заводит и заводить не должна.
 *
 * @module host/ui/NotificationCenter
 */

import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactElement } from 'react';
import { Toaster, toast } from '@reformer/ui-kit/sonner';
import type { NotificationsService } from '@/shell/platform/services/notifications';
import type { I18nService } from '@/shell/platform/services/i18n/i18n';
import { drainNotifications, type ToastSpec } from './notifications';
import { useLocale } from './usePanels';

/** Показ одного тоста. Отдельно от компонента — чтобы соответствие уровней читалось целиком. */
function present(spec: ToastSpec): void {
  const action = spec.action;
  const options = {
    id: spec.id,
    ...(spec.durationMs === undefined ? {} : { duration: spec.durationMs }),
    ...(action === undefined
      ? {}
      : {
          action: {
            label: action.label,
            onClick: (): void => {
              action.run();
            },
          },
        }),
  };

  // Явный разбор вместо `toast[level]`: уровень приходит из службы, а индексирование
  // библиотеки её значением означало бы, что новый уровень падает в рантайме, а не
  // на компиляции.
  switch (spec.level) {
    case 'success':
      toast.success(spec.message, options);
      return;
    case 'warning':
      toast.warning(spec.message, options);
      return;
    case 'error':
      toast.error(spec.message, options);
      return;
    case 'info':
      toast.info(spec.message, options);
      return;
  }
}

/**
 * Сообщает о неудачном показе и не более того.
 *
 * Ронять оболочку из-за тоста нельзя, а глотать отказ молча — значит получить «уведомления
 * не приходят» без единого следа. Показать отказ показа тем же способом, каким он отказал,
 * очевидно, не выйдет.
 */
function reportPresentError(error: unknown, id: string): void {
  console.error(`[shell] уведомление ${id} не показалось`, error);
}

export interface NotificationCenterProps {
  readonly notifications: NotificationsService;
  /**
   * Локализация Host: сообщения уведомлений разрешаются ЕЁ словарём.
   *
   * Пространства имён плагинов здесь нет намеренно: `messageKey` приходит от кого угодно —
   * от Host, от плагина, от ассистента, — а различать их по ключу невозможно. Пока все ключи
   * уведомлений лежат в словаре Host (`files.notify.*` — там же), и это то же соглашение,
   * что у заголовков команд: переводит тот, кто рисует.
   */
  readonly i18n: I18nService;
  /** Подпись области для скринридера. */
  readonly label: string;
}

/**
 * Область уведомлений. Ставится один раз на всю оболочку.
 *
 * Второй экземпляр означал бы два `Toaster` и два опустошителя очереди — то есть половину
 * уведомлений в одном углу экрана и половину в другом.
 */
export function NotificationCenter({
  notifications,
  i18n,
  label,
}: NotificationCenterProps): ReactElement {
  // Перевод не является React-состоянием: подписка на локаль — это и есть то, что делает
  // `t()` реактивным для тостов, показанных ПОСЛЕ смены языка.
  useLocale(i18n);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = notifications.observe(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [notifications]
  );
  const getSnapshot = useCallback(() => notifications.pending(), [notifications]);
  const pending = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Память о показанном переживает двойной вызов эффекта в `StrictMode`: снятие из очереди
  // от повтора не спасает — второй проход идёт по тому же, уже устаревшему снимку.
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    drainNotifications(pending, {
      shown: shown.current,
      present,
      dismiss: (id) => {
        notifications.dismiss(id);
      },
      translate: (key, params) => i18n.t(key, params),
      onError: reportPresentError,
    });
  }, [pending, notifications, i18n]);

  return <Toaster containerAriaLabel={label} />;
}
