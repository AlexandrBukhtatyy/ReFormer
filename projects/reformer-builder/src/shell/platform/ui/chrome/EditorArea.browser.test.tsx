/**
 * Центр с вкладками: ряд действий над документом стоит в полосе вкладок.
 *
 * Отдельно от [EditorActions.browser.test.tsx](EditorActions.browser.test.tsx): тот проверяет
 * сам ряд, а этот — что он ДОХОДИТ до полосы. Между ними ровно тот шов, на котором «кнопок
 * не видно» и случается: ряд собран правильно, но область редактора не передала ему ни
 * реестра команд, ни ссылки на документ.
 *
 * @module shell/platform/ui/chrome/EditorArea.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { ReactElement } from 'react';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import {
  makeResourceId,
  mediaTypeFor,
  type ResourceId,
  type ResourceRef,
} from '@reformer/builder-plugin-api/internal';
import { whenContext } from '@reformer/builder-plugin-api/internal';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createDocument } from '@/shell/platform/workspace/document';
import { type Document } from '@reformer/builder-plugin-api/internal';
import type { SaveResult, WorkspaceChange } from '@/shell/platform/workspace/workspace';
import { renderReact } from '@/testing/render';
import { EditorArea } from './EditorArea';
import { EditorPoint, type EditorContribution } from '@reformer/builder-plugin-api/internal';
import { EDITOR_TITLE_MENU, whenEditor } from '@reformer/builder-plugin-api/internal';
import { MenuPoint, type MenuContribution } from '@reformer/builder-plugin-api/internal';
import { ResourceDecorationPoint } from '@reformer/builder-plugin-api/internal';
import { createDocumentTabsStore, type TabsWorkspace } from '@/shell/platform/ui/state/tabs';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';

const MESSAGES: Readonly<Record<string, string>> = {
  'shell.editor.empty': 'Нет открытых редакторов',
  'shell.editor.opening': 'Документ открывается…',
  'shell.editor.actions.more': 'Ещё действия',
  'shell.tabs.label': 'Открытые документы',
  'shell.tabs.close': 'Закрыть «{name}»',
};

const PLUGIN_MESSAGES: Readonly<Record<string, string>> = {
  'command.showPreview': 'Показать предпросмотр',
  'editor.label': 'Markdown',
};

function ref(path: string): ResourceRef {
  return {
    id: makeResourceId('mem', path),
    sourceId: 'mem',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType: mediaTypeFor(path),
  };
}

/** Рабочая область в объёме вкладок — тот же двойник, что в соседних браузерных тестах. */
function fakeWorkspace(files: Readonly<Record<string, string>>): TabsWorkspace {
  const opened: ResourceId[] = [];
  const documents = new Map<ResourceId, Document>();
  const listeners = new Set<(change: WorkspaceChange) => void>();
  const emit = (): void => {
    for (const listener of [...listeners]) listener({ changes: [] });
  };

  return {
    open(id) {
      let document = documents.get(id);
      if (document === undefined) {
        const path = id.slice(id.indexOf(':') + 1);
        document = createDocument(ref(path), files[path] ?? '', false).document;
        documents.set(id, document);
      }
      if (!opened.includes(id)) opened.push(id);
      emit();
      return Promise.resolve(document);
    },
    close(id) {
      const at = opened.indexOf(id);
      if (at >= 0) opened.splice(at, 1);
      emit();
      return Promise.resolve();
    },
    save() {
      const result: SaveResult = { ok: true, saved: [], conflicts: [], failures: [] };
      return Promise.resolve(result);
    },
    openedResources: () => [...opened],
    isDirty: () => false,
    onDidChange(cb): Disposable {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },
  };
}

const Preview = (): ReactElement => <span data-testid="icon">◐</span>;
const Working = (): ReactElement => <span data-testid="working">✦</span>;

async function mountArea(
  path: string,
  setup?: (extensions: ReturnType<typeof createExtensionRegistry>) => void
): Promise<{ readonly unmount: () => void }> {
  const extensions = createExtensionRegistry();
  setup?.(extensions);
  const commands = createCommandRegistry({ getContext: () => whenContext({ focus: 'editable' }) });

  commands.forPlugin('markdown').register({
    id: 'markdown.showPreview',
    titleKey: 'command.showPreview',
    run: () => undefined,
  });

  const contribute = extensions.forPlugin('markdown');
  const editor: EditorContribution = {
    id: 'markdown.editor',
    titleKey: 'editor.label',
    canOpen: (candidate) => (candidate.name.endsWith('.md') ? 10 : false),
    Body: () => <div data-testid="body">рендер</div>,
  };
  contribute.contribute(EditorPoint, editor);

  const button: MenuContribution = {
    kind: 'item',
    menu: EDITOR_TITLE_MENU,
    command: 'markdown.showPreview',
    group: '1_view',
    icon: Preview,
    when: whenEditor((target) => target.ref.name.endsWith('.md')),
  };
  contribute.contribute(MenuPoint, button, { id: 'markdown.title.preview' });

  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(MESSAGES),
    dev: false,
  });
  await i18n.setLocale('ru');
  i18n.forPlugin('markdown').contribute('ru', PLUGIN_MESSAGES);
  i18n.forPlugin('ai').contribute('ru', { 'decoration.working': 'Ассистент правит эту форму' });

  const workspace = fakeWorkspace({ 'README.md': '# привет', 'notes.txt': 'текст' });
  const documents = createDocumentTabsStore({
    workspace,
    whenContext: createWhenContextStore(),
  });
  await documents.open(makeResourceId('mem', path), { preview: false });

  const mounted = renderReact(
    <div style={{ height: '400px' }}>
      <EditorArea
        extensions={extensions}
        i18n={i18n}
        documents={documents}
        panels={[]}
        commands={commands}
        whenContext={() => whenContext({ focus: 'editable' })}
      />
    </div>
  );

  await vi.waitFor(() => {
    expect(mounted.container.textContent).toContain(path.slice(path.lastIndexOf('/') + 1));
  });

  return { unmount: mounted.unmount };
}

describe('ряд действий в полосе вкладок', () => {
  it('кнопка вклада видна рядом с вкладкой открытого markdown', async () => {
    const fixture = await mountArea('README.md');

    await expect.element(page.getByRole('button', { name: 'Показать предпросмотр' })).toBeVisible();

    fixture.unmount();
  });

  it('над чужим документом кнопки нет: предикат вклада смотрит на его ссылку', async () => {
    const fixture = await mountArea('notes.txt');

    expect(document.body.textContent).not.toContain('Показать предпросмотр');

    fixture.unmount();
  });
});

describe('пометки ресурсов на вкладках', () => {
  it('пометка вклада видна на вкладке и уходит по его сигналу', async () => {
    // Так ассистент помечает форму, которую правит в фоне: человек остаётся на своей вкладке,
    // и только пометка говорит, над какой из открытых идёт ход.
    let working = true;
    const listeners = new Set<() => void>();
    const fixture = await mountArea('README.md', (extensions) => {
      extensions.forPlugin('ai').contribute(
        ResourceDecorationPoint,
        {
          id: 'ai.working',
          decorate: (candidate) =>
            working && candidate.name === 'README.md'
              ? { icon: Working, tone: 'accent', tooltipKey: 'decoration.working' }
              : null,
          onDidChange(cb) {
            listeners.add(cb);
            return toDisposable(() => {
              listeners.delete(cb);
            });
          },
        },
        { id: 'ai.working' }
      );
    });

    const tab = page.getByRole('tab', { name: /^README\.md/ });
    await expect.element(tab.getByTestId('working')).toBeVisible();
    // Подсказка — у значка; подсказка вкладки остаётся её путём: по нему вкладку находят.
    await expect.element(tab.getByTitle('Ассистент правит эту форму')).toBeVisible();
    await expect.element(tab).toHaveAttribute('title', 'README.md');

    working = false;
    for (const listener of [...listeners]) listener();
    await expect.element(tab.getByTestId('working')).not.toBeInTheDocument();

    fixture.unmount();
  });
});
