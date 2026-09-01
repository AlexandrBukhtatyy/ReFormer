/**
 * Плагин целиком в настоящей полосе вкладок: кнопка переключает вид.
 *
 * Отдельно от [plugin.test.ts](plugin.test.ts): тот проверяет вклады как данные, а этот —
 * что нажатие доходит до команды и меняет то, что нарисовано. Между ними ровно тот шов,
 * на котором «кнопка есть, но не работает»: пункт собран верно, команда зарегистрирована,
 * а применимость посчитана по состоянию, которого в этот момент нет.
 *
 * Тест живёт в КОМПОЗИЦИИ, а не в плагине: он поднимает настоящую оболочку, а
 * `plugins/**` не видит `@/shell` — это правило слоёв, и обходить его тестом нельзя.
 * Композиции же видны обе стороны, и именно она отвечает за то, что они сходятся.
 *
 * @module app/markdown-view.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import {
  makeResourceId,
  mediaTypeFor,
  type ResourceId,
  type ResourceRef,
} from '@/shell/platform/primitives/resource';
import { whenContext } from '@/shell/platform/primitives/when-context';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { EditorArea } from '@/shell/platform/ui/EditorArea';
import { createDocumentTabsStore, type TabsWorkspace } from '@/shell/platform/ui/tabs';
import { createWhenContextStore } from '@/shell/platform/ui/when-context-store';
import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import { createDocument, type Document } from '@/shell/platform/workspace/document';
import type { SaveResult, WorkspaceChange } from '@/shell/platform/workspace/workspace';
import { renderReact } from '@/testing/render';
import type { MarkdownHost } from '@/plugins/editor-markdown/host';
import { createMarkdownPlugin } from '@/plugins/editor-markdown/plugin';
import { MARKDOWN_MESSAGES } from '@/plugins/editor-markdown/messages';

const HOST_MESSAGES: Readonly<Record<string, string>> = {
  'shell.editor.empty': 'Нет открытых редакторов',
  'shell.editor.actions.more': 'Ещё действия',
  'shell.editor.next': 'Открыть другим редактором',
  'shell.tabs.label': 'Открытые документы',
  'shell.tabs.close': 'Закрыть «{name}»',
};

const README = 'README.md';

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

/** Рабочая область в объёме вкладок. */
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

async function mountWithPlugin(): Promise<{ readonly unmount: () => void }> {
  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  const commands = createCommandRegistry({ getContext: () => whenContext({ focus: 'editable' }) });
  const events = createEventBus();

  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(HOST_MESSAGES),
    dev: false,
  });
  await i18n.setLocale('ru');
  const pluginI18n = i18n.forPlugin('editor-markdown');
  for (const [locale, messages] of Object.entries(MARKDOWN_MESSAGES)) {
    pluginI18n.contribute(locale, messages);
  }

  const workspace = fakeWorkspace({ [README]: '# Заголовок' });
  const documents = createDocumentTabsStore({
    workspace,
    whenContext: createWhenContextStore(),
  });

  // Порт: то же, что даёт композиция, включая редактор кода для режима «рядом».
  const host: MarkdownHost = {
    useTranslate: () => (key: string) => pluginI18n.t(key),
    activeDocument: () => documents.get().activeId,
    documentOf: (id) => documents.documentOf(id),
    readBytes: () => Promise.resolve(null),
    resourceAt: (document, path) => makeResourceId(document.ref.sourceId, path),
    TextEditor: ({ documentId }: { documentId: ResourceId }) => (
      <div data-testid="source">исходник {documentId}</div>
    ),
  };

  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    storage: createMemoryStorageBackend(),
  });
  const plugin = createMarkdownPlugin({ host });
  plugins.registerAll([plugin]);
  plugins.activateAll();

  await documents.open(makeResourceId('mem', README), { preview: false });

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
    expect(mounted.container.textContent).toContain(README);
  });

  return { unmount: mounted.unmount };
}

describe('переключатель вида в полосе вкладок', () => {
  it('нажатие меняет исходник на предпросмотр и обратно', async () => {
    const fixture = await mountWithPlugin();

    // Умолчание — исходник: markdown в проекте форм чаще правят, чем читают.
    await expect.element(page.getByTestId('source')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Показать предпросмотр' }));

    await expect.element(page.getByRole('heading', { name: 'Заголовок' })).toBeVisible();
    expect(document.querySelector('[data-testid="source"]')).toBeNull();

    // Та же кнопка на том же месте ведёт обратно — теперь она называется иначе.
    await userEvent.click(page.getByRole('button', { name: 'Показать исходник' }));
    await expect.element(page.getByTestId('source')).toBeVisible();

    fixture.unmount();
  });

  it('кнопка «рядом» показывает обе половины', async () => {
    const fixture = await mountWithPlugin();

    await userEvent.click(page.getByRole('button', { name: 'Показать рядом' }));

    await expect.element(page.getByTestId('source')).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Заголовок' })).toBeVisible();

    fixture.unmount();
  });
});
