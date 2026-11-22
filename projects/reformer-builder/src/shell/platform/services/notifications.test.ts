import { describe, expect, it, vi } from 'vitest';

import { createNotificationsService } from './notifications';

describe('очередь уведомлений', () => {
  it('уровень по умолчанию — info, сообщение хранится ключом, а не строкой', () => {
    const notifications = createNotificationsService();

    notifications.show({ messageKey: 'workspace.opened', params: { name: 'credit' } });

    expect(notifications.pending()).toEqual([
      { id: 'n1', level: 'info', messageKey: 'workspace.opened', params: { name: 'credit' } },
    ]);
  });

  it('методы уровней проставляют свой уровень', () => {
    const notifications = createNotificationsService();

    notifications.info('a');
    notifications.success('b');
    notifications.warning('c');
    notifications.error('d');

    expect(notifications.pending().map((item) => item.level)).toEqual([
      'info',
      'success',
      'warning',
      'error',
    ]);
  });

  it('действие доезжает до очереди и не вызывается службой', () => {
    const notifications = createNotificationsService();
    const run = vi.fn();

    notifications.error('source.readFailed', { action: { titleKey: 'retry', run } });

    expect(notifications.pending()[0].action?.titleKey).toBe('retry');
    expect(run).not.toHaveBeenCalled();
  });

  it('пустой ключ сообщения — ошибка: показывать было бы нечего', () => {
    const notifications = createNotificationsService();

    expect(() => notifications.info('  ')).toThrow(/ключ/);
  });
});

describe('снятие', () => {
  it('ссылка на уведомление снимает именно его', () => {
    const notifications = createNotificationsService();
    const first = notifications.info('a');
    notifications.info('b');

    first.dismiss();

    expect(notifications.pending().map((item) => item.messageKey)).toEqual(['b']);
  });

  it('неизвестный идентификатор — не ошибка', () => {
    const notifications = createNotificationsService();

    expect(() => notifications.dismiss('n42')).not.toThrow();
  });
});

describe('снимок очереди стабилен по ссылке', () => {
  it('повторный вызов без изменений даёт ту же ссылку', () => {
    const notifications = createNotificationsService();
    notifications.info('a');

    expect(notifications.pending()).toBe(notifications.pending());
  });

  it('пустая очередь — одна и та же ссылка до и после опустошения', () => {
    const notifications = createNotificationsService();
    const empty = notifications.pending();
    notifications.info('a').dismiss();

    expect(notifications.pending()).toBe(empty);
  });

  it('показ обновляет ссылку', () => {
    const notifications = createNotificationsService();
    notifications.info('a');
    const before = notifications.pending();

    notifications.info('b');

    expect(notifications.pending()).not.toBe(before);
  });
});

describe('подписка оболочки', () => {
  it('уведомляет на показе и на снятии', () => {
    const notifications = createNotificationsService();
    const cb = vi.fn();
    notifications.observe(cb);

    const handle = notifications.info('a');
    handle.dismiss();

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('dispose снимает подписку', () => {
    const notifications = createNotificationsService();
    const cb = vi.fn();
    notifications.observe(cb).dispose();

    notifications.info('a');

    expect(cb).not.toHaveBeenCalled();
  });

  it('очередь не растёт бесконечно, если её никто не разбирает', () => {
    const notifications = createNotificationsService();

    for (let i = 0; i < 150; i += 1) notifications.info(`m${i}`);

    const pending = notifications.pending();
    expect(pending).toHaveLength(100);
    // Вытесняется самое старое: свежее объясняет происходящее лучше.
    expect(pending[pending.length - 1].messageKey).toBe('m149');
    expect(pending[0].messageKey).toBe('m50');
  });
});
