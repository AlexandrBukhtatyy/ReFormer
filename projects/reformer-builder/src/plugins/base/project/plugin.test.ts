/**
 * Тесты плагина «Проект».
 *
 * Службы оболочки здесь двойники — настоящие требуют рабочей области. Проверяется то, чем
 * владеет плагин: какие команды, на каких клавишах, когда они доступны и что зовут; состав
 * вкладов; деградация там, где привилегированная служба не пришла.
 *
 * @module plugins/base/project/plugin.test
 */

import { describe, expect, it, vi } from 'vitest';

import {
  DocumentsServiceToken,
  MenuPoint,
  PanelPoint,
  WorkspaceResourcesServiceToken,
  WorkspaceSaveServiceToken,
  type PluginContext,
  type RecentProjects,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import {
  CLEAR_RECENT_COMMAND_ID,
  OPEN_PROJECT_COMMAND_ID,
  OPEN_RECENT_COMMAND_ID,
  PROJECT_PLUGIN_ID,
  PROJECT_WELCOME_PANEL_ID,
  SAVE_ALL_COMMAND_ID,
  SAVE_COMMAND_ID,
} from './contract';
import { PROJECT_MESSAGES } from './messages';
import {
  createProjectPlugin,
  projectCommands,
  projectMenuItems,
  type ProjectCommandsDeps,
} from './plugin';

/** Контекст применимости в том виде, в каком его видит предикат команды. */
function context(activeEditorId: string | null) {
  return {
    focus: 'editable' as const,
    activeEditorId,
    activeResourceKind: null,
    hasSelection: false,
    previewMode: null,
  };
}

/** Службы команд: по умолчанию всё есть, проект открыт, активна вкладка `fs:a.txt`. */
function deps(overrides: Partial<ProjectCommandsDeps> = {}): ProjectCommandsDeps {
  return {
    resources: () => ({ canOpenProject: () => true, openProject: () => Promise.resolve(true) }),
    saving: () => ({ save: () => Promise.resolve(true), saveAll: () => Promise.resolve(true) }),
    documents: () => ({ activeResource: () => 'fs:a.txt', hasProject: () => true }),
    ...overrides,
  };
}

describe('команды', () => {
  it('плагин везёт ровно три команды рабочей области', () => {
    expect(projectCommands(deps()).map((command) => command.id)).toEqual([
      OPEN_PROJECT_COMMAND_ID,
      SAVE_COMMAND_ID,
      SAVE_ALL_COMMAND_ID,
    ]);
  });

  it('сохранение доступно только при открытом редакторе', () => {
    const [, save] = projectCommands(deps());

    expect(save.enabled?.(context('fs:a.txt'))).toBe(true);
    expect(save.enabled?.(context(null))).toBe(false);
  });

  it('сохранение работает и в поле ввода: иначе оно недоступно при наборе', () => {
    const [, save] = projectCommands(deps());

    expect(save.keybinding).toBe('mod+s');
    expect(save.allowInEditable).toBe(true);
  });

  it('сохраняет активный ресурс, а не «какой-нибудь»', async () => {
    const save = vi.fn((ids: readonly ResourceId[]) => Promise.resolve(ids.length > 0));
    const [, command] = projectCommands(
      deps({
        documents: () => ({ activeResource: () => 'fs:b.txt', hasProject: () => true }),
        saving: () => ({ save, saveAll: () => Promise.resolve(true) }),
      })
    );

    await command.run();

    expect(save).toHaveBeenCalledWith(['fs:b.txt']);
  });

  it('исчезнувшая между проверкой и запуском вкладка не приводит к записи не того файла', async () => {
    const save = vi.fn(() => Promise.resolve(true));
    const [, command] = projectCommands(
      deps({
        documents: () => ({ activeResource: () => null, hasProject: () => true }),
        saving: () => ({ save, saveAll: () => Promise.resolve(true) }),
      })
    );

    await expect(command.run()).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('«сохранить всё» доступно только при открытом проекте и зовёт один глагол службы', async () => {
    const saveAll = vi.fn(() => Promise.resolve(true));
    const [, , closed] = projectCommands(
      deps({ documents: () => ({ activeResource: () => null, hasProject: () => false }) })
    );
    const [, , open] = projectCommands(
      deps({ saving: () => ({ save: () => Promise.resolve(true), saveAll }) })
    );

    expect(closed.enabled?.(context('fs:a.txt'))).toBe(false);
    expect(open.enabled?.(context(null))).toBe(true);
    await expect(open.run()).resolves.toBe(true);
    expect(saveAll).toHaveBeenCalledOnce();
  });

  it('без права сохранения обе команды недоступны, а не падают при нажатии', async () => {
    // `workspace.save` не подтверждено — служба не пришла. Названная деградация: `Ctrl+S`
    // ничего не делает, и молчаливой «записи в никуда» нет.
    const [, save, saveAll] = projectCommands(deps({ saving: () => undefined }));

    expect(save.enabled?.(context('fs:a.txt'))).toBe(false);
    expect(saveAll.enabled?.(context('fs:a.txt'))).toBe(false);
    await expect(save.run()).resolves.toBe(false);
    await expect(saveAll.run()).resolves.toBe(false);
  });

  it('открытие проекта недоступно там, где движок не умеет выбирать каталог', () => {
    const [open] = projectCommands(
      deps({
        resources: () => ({
          canOpenProject: () => false,
          openProject: () => Promise.resolve(false),
        }),
      })
    );

    expect(open.enabled?.(context(null))).toBe(false);
  });

  it('без права открытия каталога команда недоступна, а не падает при нажатии', async () => {
    // `workspace.resources` не подтверждено — служба не пришла.
    const [open] = projectCommands(deps({ resources: () => undefined }));

    expect(open.enabled?.(context(null))).toBe(false);
    await expect(open.run?.(undefined)).resolves.toBe(false);
  });
});

describe('пункты меню', () => {
  it('все три стоят в меню «Файл» и ссылаются на команды плагина', () => {
    expect(projectMenuItems().map((item) => item.value)).toEqual([
      expect.objectContaining({ kind: 'item', menu: 'file', command: OPEN_PROJECT_COMMAND_ID }),
      expect.objectContaining({ kind: 'item', menu: 'file', command: SAVE_COMMAND_ID }),
      expect.objectContaining({ kind: 'item', menu: 'file', command: SAVE_ALL_COMMAND_ID }),
    ]);
  });

  it('ни один не несёт своего заголовка: имя приходит от команды', () => {
    for (const { value } of projectMenuItems()) {
      expect(value).not.toHaveProperty('titleKey');
    }
  });

  it('открытие и сохранение — разные группы: линия между ними появится сама', () => {
    const [open, save, saveAll] = projectMenuItems().map((item) => item.value);

    expect(open).toMatchObject({ group: '1_open' });
    expect(save).toMatchObject({ group: '2_save' });
    expect(saveAll).toMatchObject({ group: '2_save' });
  });
});

/** Список недавних в объёме службы; каждый метод — шпион, чтобы видеть, кто его трогал. */
function fakeRecent() {
  return {
    list: vi.fn(() => []),
    onDidChange: vi.fn(() => ({ dispose: () => undefined })),
    open: vi.fn(() => Promise.resolve(true)),
    forget: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  } satisfies RecentProjects;
}

/**
 * Контекст в объёме, который трогает `activate`.
 *
 * `resources: false` — привилегированная служба записей не пришла (право не подтверждено).
 */
function fakeContext(options: { readonly resources?: false | RecentProjects } = {}) {
  const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
  const registered: { id: string; titleKey?: string }[] = [];
  const executed: { id: string; args: unknown }[] = [];
  const dictionary = new Map<string, Readonly<Record<string, string>>>();
  const recent = options.resources === false ? null : (options.resources ?? fakeRecent());
  const services = new Map<string, unknown>([
    [
      WorkspaceSaveServiceToken.id,
      { save: () => Promise.resolve(true), saveAll: () => Promise.resolve(true) },
    ],
    [DocumentsServiceToken.id, { activeResource: () => null, hasProject: () => false }],
  ]);
  if (recent !== null) {
    services.set(WorkspaceResourcesServiceToken.id, {
      canOpenProject: () => true,
      openProject: () => Promise.resolve(true),
      recentProjects: recent,
    });
  }
  const ctx = {
    id: PROJECT_PLUGIN_ID,
    subscriptions: [],
    i18n: {
      locale: 'ru',
      t: (key: string) => key,
      onDidChangeLocale: () => ({ dispose: () => undefined }),
      contribute: (locale: string, messages: Readonly<Record<string, string>>) => {
        dictionary.set(locale, messages);
      },
    },
    services: { get: (token: { id: string }) => services.get(token.id) },
    extensions: {
      contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id, value });
        return { dispose: () => undefined };
      },
    },
    commands: {
      register: (command: { id: string; titleKey?: string }) => {
        registered.push(command);
        return { dispose: () => undefined };
      },
      execute: (id: string, args: unknown) => {
        executed.push({ id, args });
        return Promise.resolve(undefined);
      },
    },
  } as unknown as PluginContext;
  return { ctx, contributed, registered, executed, dictionary, recent };
}

describe('активация', () => {
  it('идентификатор плагина — пространство имён во всех реестрах', () => {
    expect(createProjectPlugin().id).toBe(PROJECT_PLUGIN_ID);
  });

  it('регистрирует команды, вносит меню «Файл», подменю недавних и стартовую страницу', () => {
    const { ctx, contributed, registered } = fakeContext();

    createProjectPlugin().activate(ctx);

    expect(registered.map((command) => command.id)).toEqual([
      OPEN_PROJECT_COMMAND_ID,
      SAVE_COMMAND_ID,
      SAVE_ALL_COMMAND_ID,
      OPEN_RECENT_COMMAND_ID,
      CLEAR_RECENT_COMMAND_ID,
    ]);
    expect(contributed.map((entry) => `${entry.point}:${entry.id ?? ''}`)).toEqual(
      expect.arrayContaining([
        `${MenuPoint.id}:project.menu.openProject`,
        `${MenuPoint.id}:project.menu.save`,
        `${MenuPoint.id}:project.menu.saveAll`,
        `${MenuPoint.id}:project.menu.recent`,
        `${MenuPoint.id}:project.menu.recent.projects`,
        `${MenuPoint.id}:project.menu.recent.more`,
        `${MenuPoint.id}:project.menu.recent.clear`,
        `${PanelPoint.id}:${PROJECT_WELCOME_PANEL_ID}`,
      ])
    );
  });

  it('всё зарегистрированное лежит в подписках: иначе выключение плагина оставит следы', () => {
    const { ctx, contributed, registered } = fakeContext();

    createProjectPlugin().activate(ctx);

    // Инвариант, а не число: «сколько всего вкладов» меняется с каждой новой командой или
    // пунктом меню, а «всё зарегистрированное снимается при выключении» — не меняется никогда.
    expect(ctx.subscriptions).toHaveLength(registered.length + contributed.length);
  });

  it('словарь вносит сам плагин, и заголовок каждой команды в нём есть', () => {
    const { ctx, registered, dictionary } = fakeContext();

    createProjectPlugin().activate(ctx);

    expect(dictionary.get('ru')).toEqual(PROJECT_MESSAGES.ru);
    expect(dictionary.get('en')).toEqual(PROJECT_MESSAGES.en);
    for (const command of registered) {
      expect(PROJECT_MESSAGES.ru?.[command.titleKey ?? '']).toBeDefined();
    }
  });

  it('обе локали покрывают одни и те же ключи', () => {
    expect(Object.keys(PROJECT_MESSAGES.ru ?? {}).sort()).toEqual(
      Object.keys(PROJECT_MESSAGES.en ?? {}).sort()
    );
  });

  it('активация список недавних не читает: только регистрирует', () => {
    const recent = fakeRecent();
    const { ctx } = fakeContext({ resources: recent });

    createProjectPlugin().activate(ctx);

    expect(recent.list).not.toHaveBeenCalled();
    expect(recent.onDidChange).not.toHaveBeenCalled();
  });

  it('без службы записей проекта нет ни подменю, ни команд недавних, а страница — есть', () => {
    // Право `workspace.resources` не подтверждено. Стартовая страница остаётся: она говорит,
    // почему каталог открыть нельзя, а не оставляет пустой экран.
    const { ctx, contributed, registered } = fakeContext({ resources: false });

    createProjectPlugin().activate(ctx);

    expect(registered.map((command) => command.id)).not.toContain(OPEN_RECENT_COMMAND_ID);
    expect(contributed.map((entry) => entry.id)).not.toContain('project.menu.recent');
    expect(contributed.map((entry) => `${entry.point}:${entry.id ?? ''}`)).toContain(
      `${PanelPoint.id}:${PROJECT_WELCOME_PANEL_ID}`
    );
  });

  it('стартовая страница стоит в центре: слот editor.main для неё и заведён', () => {
    const { ctx, contributed } = fakeContext();

    createProjectPlugin().activate(ctx);

    expect(contributed.find((entry) => entry.id === PROJECT_WELCOME_PANEL_ID)?.value).toMatchObject(
      { id: PROJECT_WELCOME_PANEL_ID, slot: 'editor.main', titleKey: 'welcome.title' }
    );
  });
});
