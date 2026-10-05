/**
 * Стартовая страница в настоящем браузере.
 *
 * Проверяется то, чего компиляция не видит: сколько проектов показано и куда ведёт щелчок,
 * перерисовка по сигналу службы и поведение там, где выбрать каталог нечем. Перевод здесь —
 * сами ключи: словарь проверяется отдельно (`shell/boot/integration/i18n-completeness`).
 *
 * @module plugins/base/project/ui/WelcomePage.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Disposable, RecentProject, RecentProjects } from '@reformer/builder-plugin-api';
import { renderReact } from '@/testing/render';
import { WelcomePage } from './WelcomePage';

function project(id: string): RecentProject {
  return { id, label: `папка-${id}`, lastOpenedAt: 1 };
}

/** Список недавних, который умеет меняться: `set` — «пришло новое чтение хранилища». */
function fakeRecent(initial: readonly RecentProject[]) {
  let list = initial;
  const listeners = new Set<() => void>();
  const recent: RecentProjects = {
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
    set: (next: readonly RecentProject[]) => {
      list = next;
      for (const cb of [...listeners]) cb();
    },
  };
}

/** Перевод — сами ключи: словарь проверяется отдельно. */
const i18n = {
  locale: 'ru',
  t: (key: string) => key,
  onDidChangeLocale: (): Disposable => ({ dispose: () => {} }),
};

describe('стартовая страница', () => {
  it('показывает пять последних и «Ещё…», щелчок открывает проект по адресу', async () => {
    const { recent } = fakeRecent(['a', 'b', 'c', 'd', 'e', 'f'].map(project));
    const openRecent = vi.fn();

    renderReact(
      <WelcomePage
        i18n={i18n}
        recent={recent}
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
        i18n={i18n}
        recent={recent}
        openFolder={() => undefined}
        openRecent={() => undefined}
      />
    );

    await expect.element(page.getByText('welcome.recent.empty')).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'menu.recent.more' }))
      .not.toBeInTheDocument();
  });

  it('список обновляется по сигналу службы: только что открытый проект появляется сам', async () => {
    const { recent, set } = fakeRecent([]);

    renderReact(
      <WelcomePage
        i18n={i18n}
        recent={recent}
        openFolder={() => undefined}
        openRecent={() => undefined}
      />
    );
    await expect.element(page.getByText('welcome.recent.empty')).toBeVisible();

    set([project('a')]);

    await expect.element(page.getByRole('button', { name: 'папка-a' })).toBeVisible();
  });

  it('без службы недавних раздела нет, а «Открыть папку…» есть', async () => {
    renderReact(
      <WelcomePage i18n={i18n} openFolder={() => undefined} openRecent={() => undefined} />
    );

    await expect.element(page.getByRole('button', { name: 'command.openProject' })).toBeVisible();
    await expect.element(page.getByText('welcome.recent.empty')).not.toBeInTheDocument();
  });

  it('«Открыть папку…» зовёт команду открытия', async () => {
    const openFolder = vi.fn();

    renderReact(
      <WelcomePage i18n={i18n} canOpenFolder openFolder={openFolder} openRecent={() => undefined} />
    );
    await userEvent.click(page.getByRole('button', { name: 'command.openProject' }));

    expect(openFolder).toHaveBeenCalledOnce();
  });

  it('выбирать каталог нельзя — кнопка погашена и объяснено почему', async () => {
    // Два разных «нельзя» приходят сюда ОДНИМ ответом: движок браузера не умеет выбирать
    // каталог или плагину не подтвердили право `workspace.resources`. Странице разбирать
    // их незачем — объяснение на экране одно и то же.
    renderReact(
      <WelcomePage
        i18n={i18n}
        canOpenFolder={false}
        openFolder={() => undefined}
        openRecent={() => undefined}
      />
    );

    await expect.element(page.getByRole('button', { name: 'command.openProject' })).toBeDisabled();
    await expect.element(page.getByText('welcome.unsupported')).toBeVisible();
  });
});
