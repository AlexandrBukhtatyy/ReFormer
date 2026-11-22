/**
 * Тесты команды «Очистить кэш».
 *
 * Проверяется её единственная суть — порядок исходов: спросили → снесли → перезапустили,
 * и каждая ступень умеет остановить следующую. Ни очистка (у неё свои тесты), ни отрисовка
 * меню сюда не входят.
 *
 * @module shell/platform/ui/dialogs/storage-purge.test
 */

import { describe, expect, it, vi } from 'vitest';

import { createPromptService } from '@/shell/platform/services/prompt';
import { createNotificationsService } from '@/shell/platform/services/notifications';
import type { PurgeReport } from '@/shell/platform/workspace/storage/purge';
import { storagePurgeCommand, STORAGE_PURGE_COMMAND_ID } from './storage-purge';

const CLEAN: PurgeReport = Object.freeze({ removed: 3, blocked: [], failures: [] });

/**
 * Служба запросов, отвечающая на первый же вопрос.
 *
 * Настоящая служба, а не заглушка: отмена у неё выражена `false`, и подменённый двойник
 * проверял бы соглашение, придуманное здесь, а не то, по которому живёт оболочка.
 */
function answering(answer: boolean): ReturnType<typeof createPromptService> {
  const prompt = createPromptService();
  const original = prompt.confirm.bind(prompt);
  return {
    ...prompt,
    confirm: (request) => {
      const promise = original(request);
      const pending = prompt.current();
      if (pending !== null) prompt.resolve(pending.id, answer);
      return promise;
    },
  };
}

describe('storagePurgeCommand', () => {
  it('недоступна без службы запросов: молчаливая очистка исключена', () => {
    const command = storagePurgeCommand({
      storage: { purge: () => Promise.resolve(CLEAN), reload: vi.fn() },
      prompt: null,
      notifications: null,
    });

    expect(command.id).toBe(STORAGE_PURGE_COMMAND_ID);
    expect(command.enabled?.({} as never)).toBe(false);
  });

  it('отказ в подтверждении не трогает хранилище', async () => {
    const purge = vi.fn(() => Promise.resolve(CLEAN));
    const reload = vi.fn();
    const command = storagePurgeCommand({
      storage: { purge, reload },
      prompt: answering(false),
      notifications: null,
    });

    await expect(command.run()).resolves.toBe(false);
    expect(purge).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('согласие ведёт к очистке и перезапуску', async () => {
    const purge = vi.fn(() => Promise.resolve(CLEAN));
    const reload = vi.fn();
    const command = storagePurgeCommand({
      storage: { purge, reload },
      prompt: answering(true),
      notifications: null,
    });

    await expect(command.run()).resolves.toBe(true);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('отложенное удаление базы перезапуску не мешает — оно им и доделывается', async () => {
    const reload = vi.fn();
    const command = storagePurgeCommand({
      storage: {
        purge: () => Promise.resolve({ removed: 1, blocked: ['workspace'], failures: [] }),
        reload,
      },
      prompt: answering(true),
      notifications: null,
    });

    await expect(command.run()).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('отказ очистки не перезапускает, а показывает тост с кнопкой перезапуска', async () => {
    const reload = vi.fn();
    const notifications = createNotificationsService();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const command = storagePurgeCommand({
      storage: {
        purge: () =>
          Promise.resolve({
            removed: 1,
            blocked: [],
            failures: [{ area: 'opfs' as const, name: 'ws', error: new Error('занято') }],
          }),
        reload,
      },
      prompt: answering(true),
      notifications,
    });

    await expect(command.run()).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();

    const pending = notifications.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      level: 'error',
      messageKey: 'shell.storage.purge.failed',
      params: { count: 1 },
    });

    // Перезапуск остаётся за человеком — но остаётся достижимым.
    pending[0].action?.run();
    expect(reload).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it('брошенная очистка не превращается в необработанный отказ команды', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const notifications = createNotificationsService();
    const command = storagePurgeCommand({
      storage: { purge: () => Promise.reject(new Error('движок отвалился')), reload: vi.fn() },
      prompt: answering(true),
      notifications,
    });

    await expect(command.run()).resolves.toBe(false);
    expect(notifications.pending()).toHaveLength(1);
    errors.mockRestore();
  });
});
