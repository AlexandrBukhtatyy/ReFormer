import { describe, expect, it, vi } from 'vitest';

import {
  createNotificationsService,
  type Notification,
  type NotificationsService,
} from '@/shell/platform/services/notifications';
import { drainNotifications, SHOWN_LIMIT, toToast, type ToastSpec } from './notifications';

/** Перевод-заглушка: ключ и параметры видны в результате, словарь для этого не нужен. */
const translate = (key: string, params?: Record<string, unknown>): string =>
  params === undefined ? key : `${key}(${Object.values(params).join(' ')})`;

function notification(overrides: Partial<Notification> = {}): Notification {
  return { id: 'n1', level: 'info', messageKey: 'files.notify.failed', ...overrides };
}

/** Показ, записывающий предъявленное, плюс очередь службы, из которой он выносит. */
function harness(service: NotificationsService): {
  readonly shown: ToastSpec[];
  drain(): void;
} {
  const shown: ToastSpec[] = [];
  const remembered = new Set<string>();
  return {
    shown,
    drain(): void {
      drainNotifications(service.pending(), {
        shown: remembered,
        present: (toast) => shown.push(toast),
        dismiss: (id) => service.dismiss(id),
        translate,
      });
    },
  };
}

describe('уведомление в тост', () => {
  it('сообщение переводится в момент показа, а не в месте возникновения', () => {
    const toast = toToast(
      notification({ messageKey: 'errors.schema.invalid', params: { message: 'нет корня' } }),
      translate
    );

    expect(toast.message).toBe('errors.schema.invalid(нет корня)');
  });

  it('уровень и подсказка о времени жизни доходят до отрисовки как есть', () => {
    const toast = toToast(notification({ level: 'error', durationMs: 5000 }), translate);

    expect(toast.level).toBe('error');
    expect(toast.durationMs).toBe(5000);
  });

  it('без подсказки о времени жизни поле не появляется: решает отрисовка', () => {
    expect(toToast(notification(), translate).durationMs).toBeUndefined();
  });

  it('подпись кнопки переводится, а действие остаётся тем, что дал заказчик', () => {
    const run = vi.fn();
    const toast = toToast(
      notification({ action: { titleKey: 'shell.tabs.unsaved.save', run } }),
      translate
    );

    toast.action?.run();

    expect(toast.action?.label).toBe('shell.tabs.unsaved.save');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('опустошение очереди', () => {
  it('показывает накопившееся в порядке поступления', () => {
    const service = createNotificationsService();
    const h = harness(service);
    service.error('files.notify.failed');
    service.info('files.notify.unavailable');

    h.drain();

    expect(h.shown.map((toast) => toast.message)).toEqual([
      'files.notify.failed',
      'files.notify.unavailable',
    ]);
  });

  it('показанное снимается из очереди: иначе следующий кадр покажет всё заново', () => {
    const service = createNotificationsService();
    const h = harness(service);
    service.error('files.notify.failed');

    h.drain();

    expect(service.pending()).toEqual([]);
  });

  it('одно и то же уведомление не показывается дважды даже на устаревшем снимке', () => {
    const service = createNotificationsService();
    const shown: ToastSpec[] = [];
    const remembered = new Set<string>();
    service.error('files.notify.failed');
    // Снимок снят один раз и переиспользован — ровно то, что делает StrictMode с эффектом.
    const stale = service.pending();
    const options = {
      shown: remembered,
      present: (toast: ToastSpec) => shown.push(toast),
      dismiss: (id: string) => service.dismiss(id),
      translate,
    };

    drainNotifications(stale, options);
    drainNotifications(stale, options);

    expect(shown).toHaveLength(1);
  });

  it('упавший показ не затыкает очередь: запрос снимается, отказ сообщается', () => {
    const service = createNotificationsService();
    const errors: string[] = [];
    service.error('files.notify.failed');
    service.info('files.notify.unavailable');
    const shown: ToastSpec[] = [];

    drainNotifications(service.pending(), {
      shown: new Set(),
      present: (toast) => {
        if (toast.message === 'files.notify.failed') throw new Error('отрисовка упала');
        shown.push(toast);
      },
      dismiss: (id) => service.dismiss(id),
      translate,
      onError: (_error, id) => errors.push(id),
    });

    expect(errors).toEqual(['n1']);
    expect(shown.map((toast) => toast.message)).toEqual(['files.notify.unavailable']);
    expect(service.pending()).toEqual([]);
  });

  it('память о показанном ограничена: долгая сессия не превращает её в утечку', () => {
    const service = createNotificationsService();
    const remembered = new Set<string>();
    for (let i = 0; i < SHOWN_LIMIT + 50; i += 1) {
      service.info('files.notify.unavailable');
      drainNotifications(service.pending(), {
        shown: remembered,
        present: () => {},
        dismiss: (id) => service.dismiss(id),
        translate,
      });
    }

    expect(remembered.size).toBe(SHOWN_LIMIT);
  });

  it('пустая очередь не показывает ничего', () => {
    const service = createNotificationsService();
    const h = harness(service);

    h.drain();

    expect(h.shown).toEqual([]);
  });
});
