/**
 * Редактор RJSF целиком в настоящей полосе вкладок: кнопки «Структура», «Форма» и «Исходник» переключают
 * то, что нарисовано во вкладке.
 *
 * Отдельно от тестов плагина: те проверяют вклады как данные и тело редактора на двойниках,
 * а этот — что кнопка доходит до команды и меняет тело. Между ними ровно тот шов, на котором
 * «кнопка есть, но выключена»: доступность команды вида считается по ручке модели платформы,
 * и ряд кнопок обязан застать её уже заведённой — с первого кадра, без чужой перерисовки.
 * Поэтому вкладки здесь настоящие и открывают документ через настоящую надстройку модели
 * (`createDocumentModels`), как в приложении.
 *
 * Тест живёт в КОМПОЗИЦИИ, а не в плагине: он поднимает настоящую оболочку, а `plugins/**`
 * не видит `@/shell` — это правило слоёв, и обходить его тестом нельзя.
 *
 * @module shell/boot/integration/rjsf-view.browser.test
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
  DocumentModelsCapability,
  DocumentsServiceToken,
  makeResourceId,
  mediaTypeFor,
  PreviewLiveCapability,
  toDisposable,
  type Disposable,
  type DocumentsService,
  type ResourceId,
  type ResourceRef,
} from '@reformer/builder-plugin-api/internal';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { EditorArea } from '@/shell/platform/ui/chrome/EditorArea';
import { createDocumentTabsStore, type TabsWorkspace } from '@/shell/platform/ui/state/tabs';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { createDocument, type DocumentHandle } from '@/shell/platform/workspace/document';
import type { SaveResult, WorkspaceChange } from '@/shell/platform/workspace/workspace';
import { createDocumentModels, type ModelsWorkspace } from '@/shell/boot/project/document-models';
import { renderReact } from '@/testing/render';
import { printRjsfForm, RJSF_PROVIDER_ID, sampleForm } from '@/plugins/rjsf/core';
import { createRjsfEditorPlugin } from '@/plugins/rjsf/editor';
import { TextEditorCapability } from '@/plugins/rjsf/editor/plugin';
import { createFakeLive } from '@/plugins/rjsf/editor/testing';

const HOST_MESSAGES: Readonly<Record<string, string>> = {
  'shell.editor.empty': 'Нет открытых редакторов',
  'shell.editor.actions.more': 'Ещё действия',
  'shell.editor.next': 'Открыть другим редактором',
  'shell.tabs.label': 'Открытые документы',
  'shell.tabs.close': 'Закрыть «{name}»',
};

const FORM = 'contact.rjsf.json';

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

/** Рабочая область в объёме вкладок и надстройки модели: буферы в памяти. */
function fakeWorkspace(
  files: Readonly<Record<string, string>>
): Omit<TabsWorkspace, 'open' | 'close'> & ModelsWorkspace {
  const opened: ResourceId[] = [];
  const buffers = new Map<ResourceId, DocumentHandle>();
  const listeners = new Set<(change: WorkspaceChange) => void>();
  const emit = (): void => {
    for (const listener of [...listeners]) listener({ changes: [] });
  };
  const bufferOf = (id: ResourceId): DocumentHandle => {
    let buffer = buffers.get(id);
    if (buffer === undefined) {
      const path = id.slice(id.indexOf(':') + 1);
      buffer = createDocument(ref(path), files[path] ?? '', false);
      buffers.set(id, buffer);
    }
    return buffer;
  };

  return {
    open(id) {
      const { document } = bufferOf(id);
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
    readText: (id) => Promise.resolve(bufferOf(id).document.getText()),
    writeText(id, text) {
      // Печать модели возвращается в буфер — как в приложении; эхо отсеивает сама ручка.
      bufferOf(id).setText(text);
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

async function mountWithPlugin(options: { withPreview?: boolean; withTextEditor?: boolean } = {}) {
  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  const whenContext = createWhenContextStore();
  const commands = createCommandRegistry({ getContext: () => whenContext.get() });
  const events = createEventBus();

  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(HOST_MESSAGES),
    dev: false,
  });
  await i18n.setLocale('ru');

  // Вкладки открывают документ ЧЕРЕЗ надстройку модели — та же подстановка, что у рабочей
  // сессии (`workspace-session`): ручка заведена раньше, чем вкладка появилась.
  const workspace = fakeWorkspace({ [FORM]: printRjsfForm(sampleForm()) });
  const models = createDocumentModels({ workspace, extensions });
  const documents = createDocumentTabsStore({
    workspace: { ...workspace, open: (id) => models.open(id), close: (id) => models.close(id) },
    whenContext,
  });

  // Службы, которыми живёт плагин, — в объёме редактора: активная вкладка и ручки моделей.
  services.register(DocumentsServiceToken, {
    hasProject: () => true,
    activeResource: () => documents.get().activeId,
    documentOf: (id: ResourceId) => documents.documentOf(id),
    onDidChange: (cb: () => void) => documents.subscribe(cb),
  } as unknown as DocumentsService);
  services.register(DocumentModelsCapability, { handleOf: (id) => models.handleOf(id) });
  // Поверхность превью — двойником: проверяется переключение вида, а не отрисовка RJSF.
  const live = createFakeLive();
  if (options.withPreview !== false) services.register(PreviewLiveCapability, live);
  // Редактор кода — тоже двойником: проверяется, что вид «исходник» отдаёт ему тело вкладки.
  if (options.withTextEditor === true) {
    services.register(TextEditorCapability, {
      TextEditor: ({ documentId }) => <div data-testid="fake-text-editor">{documentId}</div>,
    });
  }

  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    i18n,
    storage: createMemoryStorageBackend(),
  });
  plugins.registerAll([createRjsfEditorPlugin()]);
  plugins.activateAll();

  const id = makeResourceId('mem', FORM);
  await documents.open(id, { preview: false });

  const mounted = renderReact(
    <div style={{ height: '400px' }}>
      <EditorArea
        extensions={extensions}
        i18n={i18n}
        documents={documents}
        panels={[]}
        commands={commands}
        whenContext={() => whenContext.get()}
      />
    </div>
  );

  await vi.waitFor(() => {
    expect(mounted.container.textContent).toContain(FORM);
  });

  return { live, whenContext, unmount: mounted.unmount };
}

const structure = () => page.getByRole('button', { name: 'Структура', exact: true });
const form = () => page.getByRole('button', { name: 'Форма', exact: true });
const source = () => page.getByRole('button', { name: 'Исходник', exact: true });
const pressed = (locator: ReturnType<typeof structure>): string | null =>
  locator.element().getAttribute('data-state');

describe('переключатель вида формы RJSF в полосе вкладок', () => {
  it('обе кнопки доступны с первого кадра, нажата «Структура»', async () => {
    const fixture = await mountWithPlugin();

    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
    await expect.element(structure()).toBeVisible();
    // Читается сразу, без ожидания: ручка модели заведена до появления вкладки, и ряд кнопок
    // обязан застать команды доступными уже первой отрисовкой.
    expect((structure().element() as HTMLButtonElement).disabled).toBe(false);
    expect((form().element() as HTMLButtonElement).disabled).toBe(false);
    expect(pressed(structure())).toBe('on');
    expect(pressed(form())).toBeNull();
    // Вид ресурса — провайдер модели: по нему оболочка показывает панель свойств.
    expect(fixture.whenContext.get().activeResourceKind).toBe(RJSF_PROVIDER_ID);

    fixture.unmount();
  });

  it('«Форма» рисует форму на всю вкладку, «Структура» возвращает список полей', async () => {
    const fixture = await mountWithPlugin();
    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();

    await userEvent.click(form());

    await expect.element(page.getByTestId('fake-surface')).toBeVisible();
    expect(document.querySelector('[data-testid="rjsf-structure"]')).toBeNull();
    expect(fixture.live.mounts()).toBe(1);
    await vi.waitFor(() => {
      expect(pressed(form())).toBe('on');
      expect(pressed(structure())).toBeNull();
    });

    await userEvent.click(structure());

    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
    expect(document.querySelector('[data-testid="fake-surface"]')).toBeNull();
    await vi.waitFor(() => {
      expect(pressed(structure())).toBe('on');
    });

    fixture.unmount();
  });

  it('«Исходник» отдаёт вкладку редактору кода, «Структура» возвращает список полей', async () => {
    const fixture = await mountWithPlugin({ withTextEditor: true });
    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();

    await userEvent.click(source());

    await expect.element(page.getByTestId('fake-text-editor')).toBeVisible();
    expect(document.querySelector('[data-testid="rjsf-structure"]')).toBeNull();
    await vi.waitFor(() => {
      expect(pressed(source())).toBe('on');
      expect(pressed(structure())).toBeNull();
    });

    await userEvent.click(structure());

    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
    expect(document.querySelector('[data-testid="fake-text-editor"]')).toBeNull();

    fixture.unmount();
  });

  it('без редактора кода кнопки «Исходник» нет', async () => {
    const fixture = await mountWithPlugin();

    await expect.element(structure()).toBeVisible();
    expect(document.querySelector('button[aria-label="Исходник"]')).toBeNull();

    fixture.unmount();
  });

  it('без превью в составе кнопок нет, а вкладка показывает структуру', async () => {
    const fixture = await mountWithPlugin({ withPreview: false });

    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
    expect(document.querySelector('button[aria-label="Структура"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Форма"]')).toBeNull();

    fixture.unmount();
  });
});
