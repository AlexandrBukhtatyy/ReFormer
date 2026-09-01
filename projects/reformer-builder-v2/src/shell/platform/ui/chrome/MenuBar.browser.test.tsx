/**
 * Меню шапки в настоящем Chromium.
 *
 * Правила отбора проверены в `node` (`./menu.test`), и повторять их здесь незачем. Браузеру
 * остаётся то, чего в `node` нет вовсе: открывается ли меню нажатием, доходит ли щелчок
 * до реестра команд, раскрывается ли подменю наведением и виден ли серым корень, в котором
 * сейчас пусто. Всё это — поведение Radix и разметки, то есть ровно та часть, которую
 * «проверка дерева React» подтверждает, ничего не подтверждая.
 *
 * @module host/ui/MenuBar.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createElement } from 'react';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { MenuBar } from './MenuBar';
import {
  hostMenuEntry,
  MenuPoint,
  type MenuContribution,
  type MenuEntry,
} from '@/shell/platform/ui/menu/menu';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { renderReact } from '@/testing/render';

/** Ключи пунктов теста лежат в словаре плагина: иначе на экране были бы маркеры промаха. */
const TITLES: Readonly<Record<string, string>> = {
  'command.open': 'Открыть папку',
  'command.save': 'Сохранить',
  'menu.tools': 'Инструменты',
  'menu.deep': 'Ещё',
};

async function mount(
  contributions: readonly { id: string; value: MenuContribution }[],
  options: {
    builtin?: readonly MenuEntry[];
    commands?: readonly { id: string; titleKey: string; keybinding?: string; run: () => void }[];
  } = {}
) {
  const extensions = createExtensionRegistry();
  for (const item of contributions) {
    extensions.forPlugin('test').contribute(MenuPoint, item.value, { id: item.id });
  }

  const i18n = createI18nService();
  // Словарь Host грузится установкой локали: без него «Файл» и «Справка» были бы маркерами,
  // и проверка «меню открылось» проверяла бы их, а не меню.
  await i18n.setLocale('ru');
  const view = i18n.forPlugin('test');
  view.contribute('ru', TITLES);
  view.contribute('en', TITLES);

  const commands = createCommandRegistry();
  for (const command of options.commands ?? []) commands.forPlugin('test').register(command);

  renderReact(
    createElement(MenuBar, {
      commands,
      extensions,
      whenContext: createWhenContextStore(),
      i18n,
      builtin: options.builtin,
      // Модификатор задан, иначе подпись сочетания зависела бы от того, где идёт прогон.
      modifier: 'ctrl' as const,
    })
  );

  return { commands };
}

describe('меню шапки', () => {
  it('показывает оба корня Host', async () => {
    await mount([]);

    for (const title of ['Файл', 'Справка']) {
      await expect.element(page.getByRole('menuitem', { name: title, exact: true })).toBeVisible();
    }
  });

  it('щелчок по пункту выполняет команду через реестр', async () => {
    const run = vi.fn();
    await mount(
      [
        {
          id: 'test.open',
          value: { kind: 'item', menu: 'file', command: 'test.open' },
        },
      ],
      { commands: [{ id: 'test.open', titleKey: 'command.open', run }] }
    );

    await userEvent.click(page.getByRole('menuitem', { name: 'Файл' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Открыть папку' }));

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('сочетание команды видно в пункте, а `mod` развёрнут по платформе', async () => {
    await mount(
      [{ id: 'test.save', value: { kind: 'item', menu: 'file', command: 'test.save' } }],
      {
        commands: [
          { id: 'test.save', titleKey: 'command.save', keybinding: 'mod+s', run: () => undefined },
        ],
      }
    );

    await userEvent.click(page.getByRole('menuitem', { name: 'Файл' }));

    await expect.element(page.getByText('Ctrl+S')).toBeVisible();
  });

  it('недоступная команда даёт пункт, по которому нельзя щёлкнуть', async () => {
    const run = vi.fn();
    await mount(
      [{ id: 'test.save', value: { kind: 'item', menu: 'file', command: 'test.save' } }],
      {
        commands: [
          { id: 'test.save', titleKey: 'command.save', enabled: () => false, run } as never,
        ],
      }
    );

    await userEvent.click(page.getByRole('menuitem', { name: 'Файл' }));
    const item = page.getByRole('menuitem', { name: 'Сохранить' });

    await expect.element(item).toHaveAttribute('data-disabled');
    await userEvent.click(item, { force: true });
    expect(run).not.toHaveBeenCalled();
  });

  it('корень, в котором сейчас пусто, остаётся на месте недоступным', async () => {
    await mount([]);

    await expect
      .element(page.getByRole('menuitem', { name: 'Справка', exact: true }))
      .toBeDisabled();
  });

  it('подменю раскрывается и показывает внесённое по его адресу', async () => {
    const run = vi.fn();
    await mount(
      [
        {
          id: 'test.tools',
          value: { kind: 'submenu', menu: 'file', submenu: 'file/tools', titleKey: 'menu.tools' },
        },
        {
          id: 'test.tools.save',
          value: { kind: 'item', menu: 'file/tools', command: 'test.save' },
        },
      ],
      { commands: [{ id: 'test.save', titleKey: 'command.save', run }] }
    );

    await userEvent.click(page.getByRole('menuitem', { name: 'Файл' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Инструменты' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Сохранить' }));

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('переключатель показан галочкой, а обычный пункт — нет', async () => {
    await mount(
      [
        {
          id: 'test.toggle',
          value: { kind: 'item', menu: 'file', command: 'test.save', toggled: () => true },
        },
      ],
      { commands: [{ id: 'test.save', titleKey: 'command.save', run: () => undefined }] }
    );

    await userEvent.click(page.getByRole('menuitem', { name: 'Файл' }));

    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Сохранить' }))
      .toHaveAttribute('data-state', 'checked');
  });

  it('встроенные записи оболочки рисуются наравне со вкладами', async () => {
    const run = vi.fn();
    await mount([], {
      builtin: [
        hostMenuEntry('shell.help.about', { kind: 'item', menu: 'help', command: 'test.save' }),
      ],
      commands: [{ id: 'test.save', titleKey: 'command.save', run }],
    });

    await userEvent.click(page.getByRole('menuitem', { name: 'Справка' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Сохранить' }));

    expect(run).toHaveBeenCalledTimes(1);
  });
});
