/**
 * Журнал на настоящем `boot`: служба в реестре и сбои плагинов, которые оболочка пишет сама.
 *
 * Модульные тесты службы и реестра команд проверяют каждую часть по отдельности. Здесь — то,
 * что их соединяет: журнал зарегистрирован ДО активации плагинов, отказ `activate` и отказ
 * команды плагина доходят до него записями, а владелец записи — отказавший плагин.
 *
 * @module shell/boot/integration/log-wiring.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { defineProfile } from '@/application/profiles/profile';
import type { ApplicationComposition } from '@/shell/boot/composition';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import {
  definePlugin,
  LogServiceToken,
  type LogService,
} from '@reformer/builder-plugin-api/internal';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

const minimalProfile = defineProfile({
  id: 'minimal',
  name: 'Минимальный',
  plugins: ['reformer.project'],
});

/** Окружение браузера в объёме, который трогает `boot` при сборке (как в `minimal-profile.test`). */
function stubBrowser(): void {
  const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
  vi.stubGlobal('indexedDB', createMemoryIndexedDb().factory);
  vi.stubGlobal('window', { ...listeners });
  vi.stubGlobal('document', {
    ...listeners,
    title: 'reformer-builder',
    documentElement: { classList: { add: () => {}, remove: () => {} } },
  });
}

let app: BuilderApp | null = null;

afterEach(() => {
  app?.dispose();
  app = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Состав с двумя тестовыми плагинами поверх короткого профиля. */
function withProbes(probe: { log: LogService | undefined }): ApplicationComposition {
  const base = fromProfile(minimalProfile);
  return {
    ...base,
    load: async () => [
      ...(await base.load()),
      {
        plugin: definePlugin({
          id: 'test.probe',
          activate(ctx) {
            // Служба уже есть в момент активации: её регистрирует оболочка до плагинов.
            probe.log = ctx.services.get(LogServiceToken);
            ctx.subscriptions.push(
              ctx.commands.register({
                id: 'test.probe.fail',
                titleKey: 'test.probe.fail',
                run: () => Promise.reject(new Error('команда сломалась')),
              })
            );
          },
        }),
      },
      {
        plugin: definePlugin({
          id: 'test.broken',
          activate() {
            throw new Error('активация сломалась');
          },
        }),
      },
    ],
  };
}

describe('журнал в собранном приложении', () => {
  it('служба зарегистрирована до плагинов, отказ активации записан от имени плагина', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubBrowser();
    const probe: { log: LogService | undefined } = { log: undefined };
    app = boot({ application: withProbes(probe) });
    await app.ready;

    expect(probe.log).toBeDefined();
    const failure = probe.log?.entries().find((entry) => entry.source === 'test.broken');
    expect(failure).toMatchObject({
      level: 'error',
      messageKey: 'log.plugin.failed',
      params: { id: 'test.broken', phase: 'activate' },
    });
    expect(failure?.detail).toContain('активация сломалась');
  });

  it('отказ команды плагина записан с её владельцем, а ошибка дошла до вызывающего', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubBrowser();
    const probe: { log: LogService | undefined } = { log: undefined };
    app = boot({ application: withProbes(probe) });
    await app.ready;

    await expect(app.commands.execute('test.probe.fail')).rejects.toThrow('команда сломалась');

    const entry = probe.log?.entries().find((item) => item.messageKey === 'log.command.failed');
    expect(entry).toMatchObject({
      level: 'error',
      source: 'test.probe',
      params: { commandId: 'test.probe.fail' },
    });
    expect(entry?.detail).toContain('команда сломалась');
  });
});
