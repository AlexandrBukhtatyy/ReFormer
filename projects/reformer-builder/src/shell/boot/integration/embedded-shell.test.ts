/**
 * Сборка рядом с приложением: что билдер делает и чего НЕ делает с документом и источником.
 *
 * Сборка одна на все места запуска, различается окружение. Проверяется поимённо, а не
 * «окружение передано»: каждое из этих действий в чужом приложении — порча, и молча вернуться
 * оно может одной строкой в `boot`.
 *
 * Мест два:
 *
 * - **рядом с приложением** — свой документ (рамка или вкладка), общий источник: билдер
 *   хозяин документа, на источнике сносит только своё пространство имён и знает адреса
 *   приложения;
 * - **без названного окружения** — своя вкладка браузера. Умолчание обязано остаться ею, иначе
 *   десяток вызывающих (тесты сборки, домены-плагины) тихо получили бы другое окружение.
 *
 * @module shell/boot/integration/embedded-shell.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { defineProfile } from '@/application/profiles/profile';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import {
  appLocationOf,
  createEmbedding,
  followProjectSaves,
  type EmbeddingWindow,
} from '@/shell/embedded/embedding';
import {
  AppPreviewCapability,
  ApplicationProfilesServiceToken,
  definePlugin,
  type AppPreviewService,
  type ApplicationProfilesService,
} from '@reformer/builder-plugin-api/internal';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';

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

/** `sessionStorage` в памяти: ключи, индексы и `removeItem` — всё, что трогает очистка. */
function memoryWebStorage(initial: Record<string, string>): Storage & { keys(): string[] } {
  const entries = new Map(Object.entries(initial));
  return {
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
    keys: () => [...entries.keys()],
  };
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

const ORIGIN = 'http://localhost:5175';
const BUILDER_PATH = '/__reformer-builder/';

/** Окно билдера в рамке: у страницы-хозяина свой адрес, и по ней ходят. */
function framedWindow(host: { pathname: string; search?: string }): EmbeddingWindow {
  const parent = {
    location: { origin: ORIGIN, pathname: host.pathname, search: host.search ?? '', hash: '' },
  } as EmbeddingWindow;
  return { location: { origin: ORIGIN, pathname: BUILDER_PATH, search: '', hash: '' }, parent };
}

/** Окно билдера, открытого вкладкой: рамки нет, окно само себе родитель. */
function tabWindow(): EmbeddingWindow {
  const win = {
    location: { origin: ORIGIN, pathname: BUILDER_PATH, search: '', hash: '' },
  } as { location: EmbeddingWindow['location']; parent: EmbeddingWindow };
  win.parent = win;
  return win;
}

describe('сборка рядом с приложением', () => {
  function startBeside(win: EmbeddingWindow = framedWindow({ pathname: '/contacts' })): {
    readonly started: BuilderApp;
    readonly page: DocumentDouble;
  } {
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
      environment: createEmbedding(win).environment,
    });
    return { started: app, page };
  }

  it('документ у билдера свой: заголовок и тема — его', async () => {
    const { started, page } = startBeside();
    await started.ready;

    expect(page.title).toBe('Мой билдер');
    expect([...page.themeClasses]).toEqual(['dark']);
  });

  it('очистка хранилища есть, но сносит только пространство имён билдера', async () => {
    const { started } = startBeside();
    await started.ready;
    // Источник приложения: рядом с нашим — его собственное, и в каждой области. Плюс старая
    // раскладка в корне: очистка обязана сначала дать ей переехать, иначе та её переживёт.
    const opfs = createMemoryOpfs();
    await opfs.root.getDirectoryHandle('reformer-builder', { create: true });
    await opfs.root.getDirectoryHandle('reformer-forms', { create: true });
    const legacy = await opfs.root.getDirectoryHandle('ws', { create: true });
    await (
      await legacy.getDirectoryHandle('w1', { create: true })
    ).getDirectoryHandle('files', {
      create: true,
    });
    vi.stubGlobal('navigator', { storage: { getDirectory: () => Promise.resolve(opfs.root) } });
    const session = memoryWebStorage({ 'reformer-builder.mode': 'on', 'host.session': 'x' });
    vi.stubGlobal('sessionStorage', session);
    const deleted: string[] = [];
    Object.assign(globalThis.indexedDB, {
      databases: () =>
        Promise.resolve([{ name: 'reformer-builder.workspace' }, { name: 'reformer-forms_v1' }]),
      deleteDatabase: (name: string) => {
        deleted.push(name);
        const request = { onsuccess: null as (() => void) | null };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    });

    expect(started.storage).toBeDefined();
    const report = await started.storage?.purge();

    expect(report?.failures).toEqual([]);
    expect(deleted).toEqual(['reformer-builder.workspace']);
    expect(session.keys()).toEqual(['host.session']);
    await expect(opfs.root.getDirectoryHandle('reformer-forms')).resolves.toBeDefined();
    await expect(opfs.root.getDirectoryHandle('reformer-builder')).rejects.toMatchObject({
      name: 'NotFoundError',
    });
    await expect(opfs.root.getDirectoryHandle('ws')).rejects.toMatchObject({
      name: 'NotFoundError',
    });
  });

  it('выбор профиля предлагается: перезагрузить свой документ билдер вправе', async () => {
    const { started } = startBeside();
    const { profiles } = await askFromPlugin(started);

    expect(profiles?.offered().map((profile) => profile.id)).toEqual(['minimal', 'other']);
  });

  it('в рамке адреса превью — страницы, поверх которой билдер открыт', async () => {
    const { started } = startBeside(framedWindow({ pathname: '/contacts', search: '?tab=open' }));
    const { preview } = await askFromPlugin(started);

    expect(preview?.pageUrl()).toBe(`${ORIGIN}/contacts?tab=open`);
    expect(preview?.formUrl('src/forms/contact/index.tsx')).toContain('/contacts?');
  });

  it('вкладкой с того же адреса превью — корень приложения, а не адрес самого билдера', async () => {
    const { started } = startBeside(tabWindow());
    const { preview } = await askFromPlugin(started);

    expect(preview?.pageUrl()).toBe(`${ORIGIN}/`);
  });
});

describe('где приложение', () => {
  it('адрес страницы-хозяина читается в момент вопроса: по приложению ходят', () => {
    const win = framedWindow({ pathname: '/contacts' });
    const location = appLocationOf(win);
    expect(location().pathname).toBe('/contacts');

    (win.parent.location as { pathname: string }).pathname = '/orders';

    expect(location().pathname).toBe('/orders');
  });

  it('рамку держит страница другого источника — приложением считается корень своего', () => {
    const win = {
      location: { origin: ORIGIN, pathname: BUILDER_PATH, search: '', hash: '' },
      parent: {
        get location(): never {
          throw new Error('Blocked a frame with origin');
        },
      },
    } as unknown as EmbeddingWindow;

    expect(appLocationOf(win)()).toEqual({ origin: ORIGIN, pathname: '/', search: '', hash: '' });
  });
});

describe('сохранения проекта — событие для превью', () => {
  interface Change {
    readonly type: string;
  }
  type Listener = (event: { readonly changes: readonly Change[] }) => void;
  interface OpenedWorkspace {
    readonly listeners: Set<Listener>;
    emit(changes: readonly Change[]): void;
  }

  /** Проект в объёме, который нужен слежению: сессия с рабочей областью и её смена. */
  function projectDouble(): {
    readonly project: Pick<BuilderApp, 'project'>;
    readonly projectListeners: Set<() => void>;
    open(): OpenedWorkspace;
  } {
    const projectListeners = new Set<() => void>();
    let session: unknown = null;
    return {
      projectListeners,
      project: {
        project: {
          get: () => session,
          subscribe: (listener: () => void) => {
            projectListeners.add(listener);
            return { dispose: () => projectListeners.delete(listener) };
          },
        },
      } as unknown as Pick<BuilderApp, 'project'>,
      open() {
        const listeners = new Set<Listener>();
        session = {
          workspace: {
            onDidChange: (cb: Listener) => {
              listeners.add(cb);
              return { dispose: () => listeners.delete(cb) };
            },
          },
        };
        for (const listener of [...projectListeners]) listener();
        return {
          listeners,
          emit: (changes) => {
            for (const listener of [...listeners]) listener({ changes });
          },
        };
      },
    };
  }

  it('сохранение сообщается, прочие перемены рабочей области — нет', () => {
    const { project, open } = projectDouble();
    const emit = vi.fn();
    followProjectSaves(project, { emit });
    const workspace = open();

    workspace.emit([{ type: 'changed' }]);
    expect(emit).not.toHaveBeenCalled();

    workspace.emit([{ type: 'changed' }, { type: 'saved' }]);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('подписка переезжает вместе с проектом и снимается целиком', () => {
    const { project, open, projectListeners } = projectDouble();
    const emit = vi.fn();
    const following = followProjectSaves(project, { emit });
    const first = open();
    const second = open();

    // Прежняя рабочая область больше не слушается.
    expect(first.listeners.size).toBe(0);
    second.emit([{ type: 'saved' }]);
    expect(emit).toHaveBeenCalledTimes(1);

    following.dispose();

    expect(second.listeners.size).toBe(0);
    expect(projectListeners.size).toBe(0);
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
