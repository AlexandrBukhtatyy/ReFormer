/**
 * Порт плагина журнала из контекста: что панель получает от служб оболочки.
 *
 * Службы — двойники в объёме, который порт читает; их контракты проверены у оболочки. Здесь
 * проверяется сборка: какая служба на какой вопрос отвечает и что происходит, когда её нет.
 *
 * @module plugins/base/journal/host-from-context.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DocumentsServiceToken,
  LogServiceToken,
  type LogEntryRequest,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { journalHostFromContext } from './host-from-context';

const FILE: ResourceId = 'fs:forms/contact/form.schema.json';

function harness(options: { without?: readonly string[]; openFails?: boolean } = {}) {
  const open = vi.fn(() =>
    options.openFails === true
      ? Promise.reject(new Error('вкладка не открылась'))
      : Promise.resolve()
  );
  const written: LogEntryRequest[] = [];
  const services = new Map<string, unknown>([
    [
      DocumentsServiceToken.id,
      {
        documentOf: (id: ResourceId) =>
          id === FILE ? { ref: { name: 'opened.json', path: 'forms/opened.json' } } : null,
        open,
      },
    ],
    [
      LogServiceToken.id,
      {
        append: (request: LogEntryRequest) => {
          written.push(request);
        },
      },
    ],
  ]);
  for (const id of options.without ?? []) services.delete(id);
  const ctx = {
    id: 'reformer.journal',
    services: { get: (token: { id: string }) => services.get(token.id) },
    i18n: { locale: 'ru', t: (key: string) => key, onDidChangeLocale: () => ({ dispose() {} }) },
  } as unknown as PluginContext;
  return { host: journalHostFromContext(ctx), open, written };
}

describe('переход к ресурсу', () => {
  it('открывает вкладку НЕ в режиме предпросмотра', () => {
    // Человек пришёл чинить, а не посмотреть: вкладка обязана остаться после следующего щелчка.
    const { host, open } = harness();

    host.openResource?.(FILE);

    expect(open).toHaveBeenCalledWith(FILE, { preview: false });
  });

  it('отказ перехода — запись в журнале с ресурсом и подробностями', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { host, written } = harness({ openFails: true });

    host.openResource?.('fs:forms/contact/validation.ts');
    await vi.waitFor(() => {
      expect(written).toHaveLength(1);
    });

    expect(written[0]).toMatchObject({
      level: 'error',
      source: 'reformer.journal',
      messageKey: 'reformer.journal:open.failed',
      params: { name: 'validation.ts' },
      resource: 'fs:forms/contact/validation.ts',
    });
    expect(written[0]?.detail).toContain('вкладка не открылась');
    error.mockRestore();
  });

  it('без рабочей области переход — тишина, а не исключение', () => {
    const { host } = harness({ without: [DocumentsServiceToken.id] });

    expect(() => host.openResource?.(FILE)).not.toThrow();
  });
});

describe('имя ресурса', () => {
  it('открытый документ называет себя сам', () => {
    const { host } = harness();

    expect(host.nameOf(FILE)).toEqual({ name: 'opened.json', path: 'forms/opened.json' });
  });

  it('закрытый — разбором адреса платформой; неразборчивый адрес остаётся без имени', () => {
    const { host } = harness();

    expect(host.nameOf('fs:forms/contact/validation.ts')).toEqual({
      name: 'validation.ts',
      path: 'forms/contact/validation.ts',
    });
    expect(host.nameOf('не-адрес')).toBeNull();
  });
});
