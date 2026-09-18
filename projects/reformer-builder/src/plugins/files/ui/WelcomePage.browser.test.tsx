/**
 * Стартовая страница в настоящем браузере.
 *
 * Проверяется то, чего компиляция не видит: сколько проектов показано и куда ведёт щелчок,
 * перерисовка по сигналу порта и поведение там, где выбрать каталог нечем. Перевод здесь —
 * сами ключи: словарь проверяется отдельно (`shell/boot/integration/i18n-completeness`).
 *
 * @module plugins/files/ui/WelcomePage.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Disposable } from '@reformer/builder-plugin-api';
import { renderReact } from '@/testing/render';
import type { FilesHost, FilesRecentProject, FilesRecentProjects } from '../host';
import { WelcomePage } from './WelcomePage';

function project(id: string): FilesRecentProject {
  return { id, label: `папка-${id}`, lastOpenedAt: 1 };
}

/** Список недавних, который умеет меняться: `set` — «пришло новое чтение хранилища». */
function fakeRecent(initial: readonly FilesRecentProject[]) {
  let list = initial;
  const listeners = new Set<() => void>();
  const recent: FilesRecentProjects = {
    list: () => list,
    onDidChange: (cb): Disposable => {
      listeners.add(cb);
      return {
        dispose: () => {
          listeners.delete(cb);
        },
      };
    },
    open: () => Promise.resolve(true),
    forget: () => Promise.resolve(),
    clear: () => Promise.resolve(),
  };
  return {
    recent,
    set: (next: readonly FilesRecentProject[]) => {
      list = next;
      for (const cb of [...listeners]) cb();
    },
  };
}

function fakeHost(overrides: Partial<FilesHost> = {}): FilesHost {
  return {
    ResourceTreePanel: () => null,
    useTranslate: () => (key: string) => key,
    hasProject: () => false,
    save: () => Promise.resolve(true),
    saveAll: () => Promise.resolve(true),
    activeResource: () => null,
    isDirty: () => false,
    documentOf: () => null,
    writeText: () => Promise.resolve(),
    isTextual: () => true,
    treeSelection: () => [],
    treeRoot: () => null,
    ...overrides,
  };
}

describe('стартовая страница', () => {
  it('показывает пять последних и «Ещё…», щелчок открывает проект по адресу', async () => {
    const { recent } = fakeRecent(['a', 'b', 'c', 'd', 'e', 'f'].map(project));
    const openRecent = vi.fn();

    renderReact(
      <WelcomePage
        host={fakeHost({ recent })}
        openFolder={() => undefined}
        openRecent={openRecent}
      />
    );

    await expect.element(page.getByRole('button', { name: 'папка-e' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'папка-f' })).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: 'папка-b' }));
    expect(openRecent).toHaveBeenLastCalledWith('b');

    await userEvent.click(page.getByRole('button', { name: 'menu.recent.more' }));
    expect(openRecent).toHaveBeenLastCalledWith();
  });

  it('пустой список говорит об этом, а «Ещё…» не показывает', async () => {
    const { recent } = fakeRecent([]);

    renderReact(
      <WelcomePage
        host={fakeHost({ recent })}
        openFolder={() => undefined}
        openRecent={() => undefined}
      />
    );

    await expect.element(page.getByText('welcome.recent.empty')).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'menu.recent.more' }))
      .not.toBeInTheDocument();
  });

  it('список обновляется по сигналу порта: только что открытый проект появляется сам', async () => {
    const { recent, set } = fakeRecent([]);

    renderReact(
      <WelcomePage
        host={fakeHost({ recent })}
        openFolder={() => undefined}
        openRecent={() => undefined}
      />
    );
    await expect.element(page.getByText('welcome.recent.empty')).toBeVisible();

    set([project('a')]);

    await expect.element(page.getByRole('button', { name: 'папка-a' })).toBeVisible();
  });

  it('без списка от композиции раздела недавних нет, а «Открыть папку…» есть', async () => {
    renderReact(
      <WelcomePage host={fakeHost()} openFolder={() => undefined} openRecent={() => undefined} />
    );

    await expect
      .element(page.getByRole('button', { name: 'files.command.openProject' }))
      .toBeVisible();
    await expect.element(page.getByText('welcome.recent.empty')).not.toBeInTheDocument();
  });

  it('«Открыть папку…» зовёт команду открытия', async () => {
    const openFolder = vi.fn();

    renderReact(
      <WelcomePage
        host={fakeHost()}
        canOpenFolder
        openFolder={openFolder}
        openRecent={() => undefined}
      />
    );
    await userEvent.click(page.getByRole('button', { name: 'files.command.openProject' }));

    expect(openFolder).toHaveBeenCalledOnce();
  });

  it('выбирать каталог нельзя — кнопка погашена и объяснено почему', async () => {
    // Два разных «нельзя» приходят сюда ОДНИМ ответом: движок браузера не умеет выбирать
    // каталог или плагину не подтвердили право `workspace.resources`. Странице разбирать
    // их незачем — объяснение на экране одно и то же.
    renderReact(
      <WelcomePage
        host={fakeHost()}
        canOpenFolder={false}
        openFolder={() => undefined}
        openRecent={() => undefined}
      />
    );

    await expect
      .element(page.getByRole('button', { name: 'files.command.openProject' }))
      .toBeDisabled();
    await expect.element(page.getByText('welcome.unsupported')).toBeVisible();
  });
});
