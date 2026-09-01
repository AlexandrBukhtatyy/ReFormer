/**
 * Центр с вкладками: ряд действий над документом стоит в полосе вкладок.
 *
 * Отдельно от [EditorActions.browser.test.tsx](EditorActions.browser.test.tsx): тот проверяет
 * сам ряд, а этот — что он ДОХОДИТ до полосы. Между ними ровно тот шов, на котором «кнопок
 * не видно» и случается: ряд собран правильно, но область редактора не передала ему ни
 * реестра команд, ни ссылки на документ.
 *
 * @module host/ui/EditorArea.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { ReactElement } from 'react';
import { createCommandRegistry } from '../primitives/command';
import { toDisposable, type Disposable } from '../primitives/disposable';
import { createExtensionRegistry } from '../primitives/extension-point';
import {
  makeResourceId,
  mediaTypeFor,
  type ResourceId,
  type ResourceRef,
} from '../primitives/resource';
import { whenContext } from '../primitives/when-context';
import { createI18nService } from '../services/i18n/i18n';
import { createDocument, type Document } from '../workspace/document';
import type { SaveResult, WorkspaceChange } from '../workspace/workspace';
import { renderReact } from '@/testing/render';
import { EditorArea } from './EditorArea';
import { EditorPoint, type EditorContribution } from './editors';
import { EDITOR_TITLE_MENU, whenEditor } from './editor-menu';
import { MenuPoint, type MenuContribution } from './menu';
import { createDocumentTabsStore, type TabsWorkspace } from './tabs';
import { createWhenContextStore } from './when-context-store';

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

async function mountArea(path: string): Promise<{ readonly unmount: () => void }> {
  const extensions = createExtensionRegistry();
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
