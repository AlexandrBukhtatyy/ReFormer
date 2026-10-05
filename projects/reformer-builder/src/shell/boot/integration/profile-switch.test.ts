/**
 * Смена профиля состава на НАСТОЯЩЕМ приложении: выбор, сделанный службой, читается тем же
 * путём, каким его прочтёт следующая сборка.
 *
 * Шов здесь один, и он не виден ни одному из соседних тестов. Службу проверяет её тест —
 * на двойнике настроек; чтение до сборки проверяет свой — на записи, положенной руками. А то,
 * что служба настроек `boot` пишет ровно ту запись и ровно в ту область, из которой читает
 * `readStoredPreset`, не проверяет никто: разойдись они ключом или областью, человек получал бы
 * перезагрузку, после которой ничего не меняется.
 *
 * @module shell/boot/integration/profile-switch.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { defineProfile } from '@/application/profiles/profile';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import { readStoredPreset } from '@/shell/boot/stored-preset';
import type { ApplicationProfilesService } from '@reformer/builder-plugin-api/internal';
import {
  ApplicationProfilesServiceToken,
  definePlugin,
} from '@reformer/builder-plugin-api/internal';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

const minimal = fromProfile(
  defineProfile({
    id: 'minimal',
    name: 'Минимальный',
    plugins: ['reformer.project', 'reformer.plugin-manager'],
  })
);
const REFORMER = { id: 'reformer.builder', name: 'ReFormer' };
const RJSF = { id: 'rjsf.builder', name: 'RJSF' };

const reload = vi.fn();

/** Окружение браузера в объёме, который трогает `boot` (см. `minimal-profile.test`). */
function stubBrowser(): void {
  const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
  vi.stubGlobal('indexedDB', createMemoryIndexedDb().factory);
  vi.stubGlobal('window', { ...listeners, location: { reload } });
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
  reload.mockClear();
  vi.unstubAllGlobals();
});

async function start(
  profileChoices?: Parameters<typeof boot>[0]['profileChoices']
): Promise<BuilderApp> {
  stubBrowser();
  app = boot({ application: minimal, ...(profileChoices ? { profileChoices } : {}) });
  await app.ready;
  return app;
}

/** Спрашивает службу ПЛАГИН — тем же путём, каким её возьмёт переключатель. */
function profilesOf(started: BuilderApp): ApplicationProfilesService {
  let found: ApplicationProfilesService | undefined;
  started.plugins.register(
    definePlugin({
      id: 'probe',
      activate(ctx) {
        found = ctx.services.get(ApplicationProfilesServiceToken);
      },
    }),
    []
  );
  expect(started.plugins.activate('probe')).toBe(true);
  if (found === undefined) throw new Error('служба профилей плагину не видна');
  return found;
}

describe('служба профилей в собранном приложении', () => {
  it('называет профиль, из которого приложение собрано', async () => {
    const started = await start();
    const profiles = profilesOf(started);

    expect(profiles.current()).toEqual({ id: 'minimal', name: 'Минимальный' });
    // Сведений о выборе `boot` не получил — переключать не между чем.
    expect(profiles.offered()).toEqual([]);
  });

  it('выбор профиля доезжает до чтения следующей сборки и перезапускает приложение', async () => {
    const started = await start({ launch: REFORMER, offered: [REFORMER, RJSF] });
    const profiles = profilesOf(started);

    await profiles.select(RJSF.id);

    await expect(readStoredPreset()).resolves.toBe(RJSF.id);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('возврат к профилю запуска снимает выбор', async () => {
    const started = await start({ launch: REFORMER, offered: [REFORMER, RJSF] });
    const profiles = profilesOf(started);
    await profiles.select(RJSF.id);

    await profiles.select(REFORMER.id);

    await expect(readStoredPreset()).resolves.toBeNull();
  });
});
