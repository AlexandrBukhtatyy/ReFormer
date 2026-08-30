/**
 * Ряд действий над документом в настоящем браузере.
 *
 * Правила отбора и порядка живут в [menu.test.ts](menu.test.ts); здесь то, чего компиляция
 * не проверяет: кнопка со значком против строки под «…», нажатое состояние переключателя
 * и то, что щелчок доходит до команды.
 *
 * @module host/ui/EditorActions.browser.test
 */

import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { ReactElement } from 'react';
import { createCommandRegistry } from '../primitives/command';
import { createExtensionRegistry } from '../primitives/extension-point';
import { makeResourceId, mediaTypeFor, type ResourceRef } from '../primitives/resource';
import { whenContext } from '../primitives/when-context';
import { createI18nService } from '../services/i18n/i18n';
import { renderReact } from '../../testing/render';
import { EditorActions } from './EditorActions';
import { EDITOR_TITLE_MENU, whenEditor } from './editor-menu';
import { hostMenuEntry, MenuPoint, type MenuContribution } from './menu';

const MESSAGES: Readonly<Record<string, string>> = {
  'shell.editor.actions.more': 'Ещё действия',
  'shell.editor.next': 'Открыть другим редактором',
};

const PLUGIN_MESSAGES: Readonly<Record<string, string>> = {
  'command.preview': 'Показать предпросмотр',
  'command.settings': 'Настройки предпросмотра',
};

const README: ResourceRef = {
  id: makeResourceId('mem', 'README.md'),
  sourceId: 'mem',
  path: 'README.md',
  name: 'README.md',
  kind: 'file',
  mediaType: mediaTypeFor('README.md'),
};

/** Значок-двойник: настоящие значки здесь не нужны, а найти кнопку по метке — нужно. */
const Dot = (): ReactElement => <span data-testid="icon">•</span>;

async function mountActions(options: { withOverflow?: boolean } = {}): Promise<{
  readonly executed: string[];
  readonly unmount: () => void;
}> {
  const extensions = createExtensionRegistry();
  const commands = createCommandRegistry({ getContext: () => whenContext({ focus: 'editable' }) });
  const executed: string[] = [];

  const registry = commands.forPlugin('markdown');
  registry.register({
    id: 'markdown.preview',
    titleKey: 'command.preview',
    run: () => {
      executed.push('markdown.preview');
    },
  });
  registry.register({
    id: 'markdown.settings',
    titleKey: 'command.settings',
    run: () => {
      executed.push('markdown.settings');
    },
  });

  const contribute = extensions.forPlugin('markdown');
  const button: MenuContribution = {
    kind: 'item',
    menu: EDITOR_TITLE_MENU,
    command: 'markdown.preview',
    group: '1_view',
    icon: Dot,
    when: whenEditor((target) => target.ref.name.endsWith('.md')),
    toggled: () => true,
  };
  contribute.contribute(MenuPoint, button, { id: 'markdown.title.preview' });

  if (options.withOverflow === true) {
    // Пункт БЕЗ значка: в полосе вкладок ему нечего показать, поэтому он уходит под «…».
    const hidden: MenuContribution = {
      kind: 'item',
      menu: EDITOR_TITLE_MENU,
      command: 'markdown.settings',
      group: '2_settings',
    };
    contribute.contribute(MenuPoint, hidden, { id: 'markdown.title.settings' });
  }

  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(MESSAGES),
    dev: false,
  });
  await i18n.setLocale('ru');
  i18n.forPlugin('markdown').contribute('ru', PLUGIN_MESSAGES);

  const mounted = renderReact(
    <EditorActions
      extensions={extensions}
      i18n={i18n}
      ref={README}
      editorId="markdown.editor"
      commands={commands}
      whenContext={() => whenContext({ focus: 'editable' })}
    />
  );

  return { executed, unmount: mounted.unmount };
}

describe('ряд действий', () => {
  it('пункт со значком становится кнопкой с подписью для скринридера', async () => {
    const fixture = await mountActions();

    await expect.element(page.getByRole('button', { name: 'Показать предпросмотр' })).toBeVisible();

    fixture.unmount();
  });

  it('щелчок по кнопке доходит до команды', async () => {
    const fixture = await mountActions();

    await userEvent.click(page.getByRole('button', { name: 'Показать предпросмотр' }));

    expect(fixture.executed).toEqual(['markdown.preview']);
    fixture.unmount();
  });

  it('переключатель показан нажатым — галочке в полосе вкладок места нет', async () => {
    const fixture = await mountActions();

    await expect
      .element(page.getByRole('button', { name: 'Показать предпросмотр' }))
      .toHaveAttribute('data-state', 'on');

    fixture.unmount();
  });

  it('пункт без значка уходит под «…», где у него есть место для подписи', async () => {
    const fixture = await mountActions({ withOverflow: true });

    // В полосе его нет: иначе кнопка была бы пустой.
    expect(document.body.textContent).not.toContain('Настройки предпросмотра');

    await userEvent.click(page.getByRole('button', { name: 'Ещё действия' }));
    await expect.element(page.getByText('Настройки предпросмотра')).toBeVisible();

    fixture.unmount();
  });

  it('встроенная запись оболочки держит «…» на месте без единого вклада плагина', async () => {
    const extensions = createExtensionRegistry();
    const commands = createCommandRegistry();
    const executed: string[] = [];
    commands.register({
      id: 'shell.editor.next',
      titleKey: 'shell.editor.next',
      run: () => {
        executed.push('shell.editor.next');
      },
    });
    const i18n = createI18nService({
      loadHostMessages: () => Promise.resolve(MESSAGES),
      dev: false,
    });
    await i18n.setLocale('ru');

    const mounted = renderReact(
      <EditorActions
        extensions={extensions}
        i18n={i18n}
        ref={README}
        commands={commands}
        builtin={[
          hostMenuEntry('shell.editor.title.next', {
            kind: 'item',
            menu: EDITOR_TITLE_MENU,
            command: 'shell.editor.next',
            group: '9_editor',
          }),
        ]}
      />
    );

    // Кнопка есть, хотя ни один плагин ничего не внёс: у неё постоянное место, и наполняет
    // её тот, кто знает, что открыто.
    await userEvent.click(page.getByRole('button', { name: 'Ещё действия' }));
    await expect.element(page.getByText('Открыть другим редактором')).toBeVisible();

    mounted.unmount();
  });

  it('без вкладов ряда нет вовсе: пустая полоса не должна занимать ширину', async () => {
    const extensions = createExtensionRegistry();
    const commands = createCommandRegistry();
    const i18n = createI18nService({
      loadHostMessages: () => Promise.resolve(MESSAGES),
      dev: false,
    });
    await i18n.setLocale('ru');

    const mounted = renderReact(
      <EditorActions extensions={extensions} i18n={i18n} ref={README} commands={commands} />
    );

    expect(mounted.container.textContent).toBe('');
    mounted.unmount();
  });
});
