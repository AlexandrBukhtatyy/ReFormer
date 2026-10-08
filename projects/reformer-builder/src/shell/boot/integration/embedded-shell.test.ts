/**
 * Сборка в окружении «страница чужого приложения»: билдер поднимается гостем.
 *
 * Сборка одна на обе оболочки, и отличие встроенной — в том, чего она НЕ делает с документом
 * и источником приложения. Проверяется поимённо, а не «окружение передано»: каждое из этих
 * действий в чужом приложении — порча, и молча вернуться оно может одной строкой в `boot`.
 *
 * Рядом — тот же `boot` без окружения: умолчание обязано остаться вкладкой браузера, иначе
 * десяток вызывающих (тесты сборки, домены-плагины) тихо получили бы гостя вместо хозяина.
 *
 * @module shell/boot/integration/embedded-shell.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { defineProfile } from '@/application/profiles/profile';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import { createEmbeddedEnvironment } from '@/shell/embedded/environment';
import { createAppPreviewService, createSourceWriteSignal } from '@/shell/embedded/preview-address';
import {
  AppPreviewCapability,
  ApplicationProfilesServiceToken,
  definePlugin,
  type AppPreviewService,
  type ApplicationProfilesService,
} from '@reformer/builder-plugin-api/internal';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

const minimalProfile = defineProfile({
  id: 'minimal',
  name: 'Минимальный',
  plugins: ['reformer.project', 'reformer.plugin-manager'],
});
const application = fromProfile(minimalProfile);

interface DocumentDouble {
  title: string;
  readonly themeClasses: Set<string>;
}

/** Окружение браузера в объёме, который трогает `boot` (как в `./minimal-profile`). */
function stubBrowser(): DocumentDouble {
  const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
  const themeClasses = new Set<string>();
  const documentDouble = {
    ...listeners,
    title: 'Приложение-хозяин',
    documentElement: {
      classList: {
        add: (token: string) => themeClasses.add(token),
        remove: (token: string) => themeClasses.delete(token),
      },
    },
    themeClasses,
  };
  vi.stubGlobal('indexedDB', createMemoryIndexedDb().factory);
  vi.stubGlobal('window', { ...listeners, location: { reload: vi.fn() } });
  vi.stubGlobal('document', documentDouble);
  return documentDouble;
}

const appPreview = createAppPreviewService(
  () => ({ origin: 'http://localhost:5173', pathname: '/contacts', search: '', hash: '' }),
  createSourceWriteSignal()
);

/** Корень темы, который ничего не трогает и помнит, о чём его просили. */
function recordingThemeRoot(): {
  readonly classList: { add(token: string): void; remove(token: string): void };
} {
  return { classList: { add: () => {}, remove: () => {} } };
}

let app: BuilderApp | null = null;

afterEach(() => {
  app?.dispose();
  app = null;
  vi.unstubAllGlobals();
});

/** Спрашивает службы ИЗНУТРИ плагина: реестр служб `boot` наружу не отдаёт. */
async function askFromPlugin(started: BuilderApp): Promise<{
  readonly preview: AppPreviewService | undefined;
  readonly profiles: ApplicationProfilesService | undefined;
}> {
  await started.ready;
  let preview: AppPreviewService | undefined;
  let profiles: ApplicationProfilesService | undefined;
  started.plugins.register(
    definePlugin({
      id: 'probe',
      activate(ctx) {
        preview = ctx.services.get(AppPreviewCapability);
        profiles = ctx.services.get(ApplicationProfilesServiceToken);
      },
    }),
    [],
    []
  );
  expect(started.plugins.activate('probe')).toBe(true);
  return { preview, profiles };
}

describe('сборка на странице чужого приложения', () => {
  function startEmbedded(): { readonly started: BuilderApp; readonly page: DocumentDouble } {
    const page = stubBrowser();
    app = boot({
      application,
      runtime: {
        config: { branding: { title: 'Мой билдер' }, defaults: { theme: 'dark' } },
        problems: [],
      },
      profileChoices: {
        launch: minimalProfile,
        offered: [minimalProfile, { id: 'other', name: 'Другой' }],
      },
      environment: createEmbeddedEnvironment({ themeRoot: recordingThemeRoot(), appPreview }),
    });
    return { started: app, page };
  }

  it('заголовок страницы остаётся заголовком приложения, даже если конфиг называет свой', async () => {
    const { started, page } = startEmbedded();
    await started.ready;

    expect(page.title).toBe('Приложение-хозяин');
  });

  it('класс темы на корень документа не ставится: тему применяет тот, кто дал корень', async () => {
    const { started, page } = startEmbedded();
    await started.ready;

    expect([...page.themeClasses]).toEqual([]);
  });

  it('очистки хранилища нет: источник общий с приложением', async () => {
    const { started } = startEmbedded();
    await started.ready;

    expect(started.storage).toBeUndefined();
  });

  it('выбор профиля не предлагается: применить его без перезагрузки страницы нечем', async () => {
    const { started } = startEmbedded();
    const { profiles } = await askFromPlugin(started);

    expect(profiles?.offered()).toEqual([]);
  });

  it('плагин находит возможность «превью приложением» и получает адреса приложения', async () => {
    const { started } = startEmbedded();
    const { preview } = await askFromPlugin(started);

    expect(preview?.pageUrl()).toBe('http://localhost:5173/contacts');
    expect(preview?.formUrl('src/forms/contact/index.tsx')).toContain('/contacts?');
  });
});

describe('сборка без названного окружения — своя вкладка браузера', () => {
  it('заголовок, тема и очистка хранилища принадлежат билдеру, а превью приложением нет', async () => {
    const page = stubBrowser();
    app = boot({
      application,
      runtime: {
        config: { branding: { title: 'Мой билдер' }, defaults: { theme: 'dark' } },
        problems: [],
      },
    });
    const { preview } = await askFromPlugin(app);

    expect(page.title).toBe('Мой билдер');
    expect([...page.themeClasses]).toEqual(['dark']);
    expect(app.storage).toBeDefined();
    expect(preview).toBeUndefined();
  });
});
