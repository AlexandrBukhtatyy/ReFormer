/**
 * Тесты недавно открытых в плагине файлов: команды и подменю «Файл › Недавно открытые».
 *
 * Порт и службы — двойники. Проверяется то, чем владеет плагин: какие команды, на каких
 * клавишах, что они спрашивают и куда ведут, и как список ложится в меню.
 *
 * @module plugins/files/recent.test
 */

import { describe, expect, it, vi } from 'vitest';

import type { Disposable, MenuContribution, PromptService, WhenContext } from '@/sdk';
import type { FilesRecentProject, FilesRecentProjects } from './host';
import {
  CLEAR_RECENT_COMMAND_ID,
  MENU_RECENT_LIMIT,
  OPEN_RECENT_COMMAND_ID,
  RECENT_SUBMENU,
  recentCommands,
  recentMenuItems,
  type RecentCommandsDeps,
} from './recent';

const context: WhenContext = {
  focus: 'editable',
  activeEditorId: null,
  activeResourceKind: null,
  hasSelection: false,
  previewMode: null,
};

function project(id: string, lastOpenedAt = 1): FilesRecentProject {
  return { id, label: `папка-${id}`, lastOpenedAt };
}

function fakeRecent(list: readonly FilesRecentProject[] = [project('a'), project('b')]) {
  const listeners = new Set<() => void>();
  const recent = {
    list: () => list,
    onDidChange: (cb: () => void): Disposable => {
      listeners.add(cb);
      return {
        dispose: () => {
          listeners.delete(cb);
        },
      };
    },
    open: vi.fn<FilesRecentProjects['open']>(() => Promise.resolve(true)),
    forget: vi.fn<FilesRecentProjects['forget']>(() => Promise.resolve()),
    clear: vi.fn<FilesRecentProjects['clear']>(() => Promise.resolve()),
  } satisfies FilesRecentProjects;
  return {
    ...recent,
    fire: () => {
      for (const cb of [...listeners]) cb();
    },
  };
}

/** Служба запросов в объёме, который трогают команды. `busy` — уже что-то спрашивают. */
function fakePrompt(answers: { readonly pick?: string | null; readonly confirm?: boolean } = {}) {
  let pending: ReturnType<PromptService['current']> = null;
  const pick = vi.fn<PromptService['pick']>(() => Promise.resolve(answers.pick ?? null));
  const confirm = vi.fn<PromptService['confirm']>(() => Promise.resolve(answers.confirm ?? true));
  const prompt: PromptService = {
    input: () => Promise.resolve(null),
    confirm,
    pick,
    current: () => pending,
    resolve: () => undefined,
    cancelAll: () => undefined,
    observe: () => ({ dispose: () => undefined }),
  };
  return {
    prompt,
    pick,
    confirm,
    busy: () => {
      pending = { kind: 'confirm', id: 'p1', titleKey: 'другой вопрос' };
    },
  };
}

function command(id: string, deps: RecentCommandsDeps) {
  const found = recentCommands(deps).find((it) => it.id === id);
  if (found === undefined) throw new Error(`команды «${id}» нет`);
  return found;
}

/** Вклад меню по идентификатору — без корня: у того нет ни группы, ни сигнала. */
function menuValue(
  recent: FilesRecentProjects,
  id: string
): Exclude<MenuContribution, { kind: 'root' }> {
  const found = recentMenuItems(recent).find((it) => it.id === id)?.value;
  if (found === undefined || found.kind === 'root') throw new Error(`вклада «${id}» нет`);
  return found;
}

describe('«Открыть недавний проект…»', () => {
  it('на Ctrl+R и работает в поле ввода: иначе браузер перезагрузит страницу', () => {
    const open = command(OPEN_RECENT_COMMAND_ID, { recent: fakeRecent() });

    expect(open.keybinding).toBe('mod+r');
    expect(open.allowInEditable).toBe(true);
    // Недоступная команда не гасит нажатие — и `Ctrl+R` перезагружал бы страницу.
    expect(open.enabled).toBeUndefined();
  });

  it('с адресом открывает этот проект, ничего не спрашивая', async () => {
    const recent = fakeRecent();
    const { prompt, pick } = fakePrompt();

    await command(OPEN_RECENT_COMMAND_ID, { recent, prompt }).run({ id: 'b' });

    expect(recent.open).toHaveBeenCalledWith('b');
    expect(pick).not.toHaveBeenCalled();
  });

  it('без аргументов показывает список с датами и открывает выбранное', async () => {
    const recent = fakeRecent([project('a', 10), project('b', 20)]);
    const { prompt, pick } = fakePrompt({ pick: 'b' });

    await command(OPEN_RECENT_COMMAND_ID, {
      recent,
      prompt,
      formatDate: (at) => `в ${String(at)}`,
    }).run();

    expect(pick).toHaveBeenCalledWith(
      expect.objectContaining({
        titleKey: 'recent.pick.title',
        pluginId: 'files',
        items: [
          { id: 'a', label: 'папка-a', description: 'в 10' },
          { id: 'b', label: 'папка-b', description: 'в 20' },
        ],
      })
    );
    expect(recent.open).toHaveBeenCalledWith('b');
  });

  it('кнопка «убрать» в списке убирает проект из недавних', async () => {
    const recent = fakeRecent();
    const { prompt, pick } = fakePrompt();

    await command(OPEN_RECENT_COMMAND_ID, { recent, prompt }).run();
    await pick.mock.calls[0]?.[0].remove?.run('a');

    expect(recent.forget).toHaveBeenCalledWith('a');
  });

  it('отмена ничего не открывает', async () => {
    const recent = fakeRecent();
    const { prompt } = fakePrompt({ pick: null });

    await expect(command(OPEN_RECENT_COMMAND_ID, { recent, prompt }).run()).resolves.toBe(false);

    expect(recent.open).not.toHaveBeenCalled();
  });

  it('повторное нажатие при открытом запросе второго списка в очередь не ставит', async () => {
    const recent = fakeRecent();
    const { prompt, pick, busy } = fakePrompt();
    busy();

    await expect(command(OPEN_RECENT_COMMAND_ID, { recent, prompt }).run()).resolves.toBe(false);

    expect(pick).not.toHaveBeenCalled();
  });

  it('без службы запросов списка нет, но проект по адресу открывается', async () => {
    const recent = fakeRecent();
    const open = command(OPEN_RECENT_COMMAND_ID, { recent, prompt: null });

    await expect(open.run()).resolves.toBe(false);
    await open.run({ id: 'a' });

    expect(recent.open).toHaveBeenCalledWith('a');
  });
});

describe('«Очистить список недавних…»', () => {
  it('недоступна, когда убирать нечего', () => {
    const { prompt } = fakePrompt();

    expect(
      command(CLEAR_RECENT_COMMAND_ID, { recent: fakeRecent([]), prompt }).enabled?.(context)
    ).toBe(false);
  });

  it('спрашивает подтверждение и только потом чистит', async () => {
    const recent = fakeRecent();
    const { prompt, confirm } = fakePrompt({ confirm: true });

    await command(CLEAR_RECENT_COMMAND_ID, { recent, prompt }).run();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ titleKey: 'recent.clear.title', pluginId: 'files' })
    );
    expect(recent.clear).toHaveBeenCalledOnce();
  });

  it('отказ в подтверждении список не трогает', async () => {
    const recent = fakeRecent();
    const { prompt } = fakePrompt({ confirm: false });

    await command(CLEAR_RECENT_COMMAND_ID, { recent, prompt }).run();

    expect(recent.clear).not.toHaveBeenCalled();
  });
});

describe('подменю «Файл › Недавно открытые»', () => {
  it('стоит в «Файле» сразу за «Открыть папку…»', () => {
    expect(menuValue(fakeRecent(), 'files.menu.recent')).toMatchObject({
      kind: 'submenu',
      menu: 'file',
      submenu: RECENT_SUBMENU,
      titleKey: 'menu.recent',
      group: '1_open',
      order: 10,
    });
  });

  it('проекты — пунктами команды открытия с адресом проекта, не больше десяти', () => {
    const many = Array.from({ length: 12 }, (_, index) => project(`p${String(index)}`));
    const dynamic = menuValue(fakeRecent(many), 'files.menu.recent.projects');
    if (dynamic.kind !== 'dynamic') throw new Error('ожидалась динамическая группа');

    const items = dynamic.items(context, undefined);

    expect(items).toHaveLength(MENU_RECENT_LIMIT);
    expect(items[0]).toEqual({
      id: 'p0',
      command: OPEN_RECENT_COMMAND_ID,
      args: { id: 'p0' },
      title: 'папка-p0',
    });
  });

  it('«Ещё…» — та же команда без аргументов: у пункта видно Ctrl+R', () => {
    const more = menuValue(fakeRecent(), 'files.menu.recent.more');

    expect(more).toMatchObject({ kind: 'item', command: OPEN_RECENT_COMMAND_ID });
    expect(more).not.toHaveProperty('args');
  });

  it('очистка — отдельной группой в конце подменю', () => {
    expect(menuValue(fakeRecent(), 'files.menu.recent.clear')).toMatchObject({
      kind: 'item',
      command: CLEAR_RECENT_COMMAND_ID,
      group: '3_clear',
    });
  });

  it('меню пересобирается по сигналу списка: и заголовок подменю, и группа проектов', () => {
    const recent = fakeRecent();
    // Два разных шпиона: подписчики списка лежат во множестве, и один и тот же дважды
    // не посчитался бы — тест проверял бы множество, а не меню.
    const submenu = vi.fn();
    const projects = vi.fn();
    menuValue(recent, 'files.menu.recent').onDidChange?.(submenu);
    menuValue(recent, 'files.menu.recent.projects').onDidChange?.(projects);

    recent.fire();

    expect(submenu).toHaveBeenCalledOnce();
    expect(projects).toHaveBeenCalledOnce();
  });
});
