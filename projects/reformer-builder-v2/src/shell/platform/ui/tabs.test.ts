import { describe, expect, it, vi } from 'vitest';

import type { Disposable } from '@/shell/platform/primitives/disposable';
import { toDisposable } from '@/shell/platform/primitives/disposable';
import {
  makeResourceId,
  mediaTypeFor,
  type ResourceId,
  type ResourceRef,
} from '@/shell/platform/primitives/resource';
import { createDocument, type Document } from '@/shell/platform/workspace/document';
import type { SaveResult, WorkspaceChange } from '@/shell/platform/workspace/workspace';
import {
  EMPTY_TABS,
  activateTab,
  closeTab,
  createDocumentTabsStore,
  findTab,
  moveTab,
  openTab,
  pinTab,
  refFromResourceId,
  requestCloseTab,
  resourceKindOf,
  syncTabs,
  withDirtyFlags,
  type TabsState,
  type TabsWorkspace,
} from './tabs';
import { createWhenContextStore } from './when-context-store';

function ref(path: string, mediaType = mediaTypeFor(path)): ResourceRef {
  return {
    id: makeResourceId('mem', path),
    sourceId: 'mem',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType,
  };
}

const A = ref('a.json');
const B = ref('b.json');
const C = ref('c.md');

const ids = (state: TabsState): readonly string[] => state.tabs.map((tab) => tab.ref.id);

describe('openTab — режим предпросмотра', () => {
  it('первое открытие делает временную вкладку и активирует её', () => {
    const state = openTab(EMPTY_TABS, A);
    expect(ids(state)).toEqual([A.id]);
    expect(state.tabs[0].preview).toBe(true);
    expect(state.activeId).toBe(A.id);
  });

  it('второй файл ЗАМЕНЯЕТ непринятую предпросмотровую вкладку', () => {
    const state = openTab(openTab(EMPTY_TABS, A), B);
    expect(ids(state)).toEqual([B.id]);
    expect(state.activeId).toBe(B.id);
  });

  it('замена происходит на месте, а не в конце ряда', () => {
    // Закреплённая, временная, закреплённая — новая временная обязана встать в середину.
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B);
    state = openTab(state, C, { preview: false });
    expect(ids(state)).toEqual([A.id, B.id, C.id]);

    const replaced = openTab(state, ref('d.json'));
    expect(ids(replaced)).toEqual([A.id, 'mem:d.json', C.id]);
  });

  it('закреплённая вкладка не заменяется — их накапливается сколько угодно', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B, { preview: false });
    expect(ids(state)).toEqual([A.id, B.id]);
  });

  it('повторное открытие только активирует и в конец не переносит', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B, { preview: false });
    state = openTab(state, A, { preview: false });
    expect(ids(state)).toEqual([A.id, B.id]);
    expect(state.activeId).toBe(A.id);
  });

  it('открытие закреплением превращает временную вкладку в постоянную', () => {
    const preview = openTab(EMPTY_TABS, A);
    const pinned = openTab(preview, A, { preview: false });
    expect(pinned.tabs[0].preview).toBe(false);

    // Обратное невозможно: закреплённое не становится временным снова.
    expect(openTab(pinned, A).tabs[0].preview).toBe(false);
  });

  it('pinTab закрепляет и не двигает активную вкладку', () => {
    let state = openTab(EMPTY_TABS, A);
    state = openTab(state, B, { preview: false });
    const pinned = pinTab(state, A.id);
    expect(pinned.tabs[0].preview).toBe(false);
    expect(pinned.activeId).toBe(B.id);
    // Повторное закрепление — не изменение: снимок обязан остаться той же ссылкой.
    expect(pinTab(pinned, A.id)).toBe(pinned);
  });
});

describe('activateTab и moveTab — порядок вкладок', () => {
  it('неизвестная и повторная активация снимок не пересоздают', () => {
    const state = openTab(EMPTY_TABS, A);
    expect(activateTab(state, A.id)).toBe(state);
    expect(activateTab(state, 'mem:нет.json')).toBe(state);
  });

  it('перестановка меняет порядок, но не активную вкладку', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B, { preview: false });
    state = openTab(state, C, { preview: false });

    const moved = moveTab(state, C.id, 0);
    expect(ids(moved)).toEqual([C.id, A.id, B.id]);
    expect(moved.activeId).toBe(C.id);
  });

  it('индекс за краем прижимается к краю', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B, { preview: false });
    expect(ids(moveTab(state, A.id, 99))).toEqual([B.id, A.id]);
    expect(ids(moveTab(state, B.id, -5))).toEqual([B.id, A.id]);
  });
});

describe('closeTab', () => {
  it('активной становится соседняя справа', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B, { preview: false });
    state = openTab(state, C, { preview: false });
    state = activateTab(state, B.id);

    const closed = closeTab(state, B.id);
    expect(ids(closed)).toEqual([A.id, C.id]);
    expect(closed.activeId).toBe(C.id);
  });

  it('у крайней правой — соседняя слева', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B, { preview: false });
    expect(closeTab(state, B.id).activeId).toBe(A.id);
  });

  it('закрытие неактивной вкладки активную не двигает', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B, { preview: false });
    expect(closeTab(state, A.id).activeId).toBe(B.id);
  });

  it('последняя вкладка оставляет `activeId` пустым', () => {
    const closed = closeTab(openTab(EMPTY_TABS, A), A.id);
    expect(closed.tabs).toEqual([]);
    expect(closed.activeId).toBeNull();
  });
});

describe('requestCloseTab — проверка несохранённого', () => {
  const clean = (): boolean => false;

  it('чистая вкладка закрывается без вопросов', () => {
    const state = openTab(EMPTY_TABS, A);
    const decision = requestCloseTab(state, A.id, clean);
    expect(decision.status).toBe('close');
    if (decision.status === 'close') expect(decision.state.tabs).toEqual([]);
  });

  it('изменённая вкладка требует ответа человека и НЕ закрывается сама', () => {
    const state = openTab(EMPTY_TABS, A);
    const decision = requestCloseTab(state, A.id, (id) => id === A.id);
    expect(decision.status).toBe('unsaved');
    if (decision.status === 'unsaved') expect(decision.tab.ref).toBe(A);
    // Состояние не тронуто: спросить — не значит закрыть.
    expect(state.tabs).toHaveLength(1);
  });

  it('несуществующая вкладка — не вопрос и не ошибка', () => {
    expect(requestCloseTab(EMPTY_TABS, A.id, clean).status).toBe('missing');
  });
});

describe('syncTabs — сведение с рабочей областью', () => {
  it('ресурс, открытый мимо вкладок, получает закреплённую вкладку в конце', () => {
    const state = syncTabs(openTab(EMPTY_TABS, A), [A.id, B.id]);
    expect(ids(state)).toEqual([A.id, B.id]);
    expect(state.tabs[1].preview).toBe(false);
    expect(state.tabs[0].preview).toBe(true);
  });

  it('вкладка закрытого ресурса исчезает, активная переезжает', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B, { preview: false });
    const synced = syncTabs(state, [A.id]);
    expect(ids(synced)).toEqual([A.id]);
    expect(synced.activeId).toBe(A.id);
  });

  it('когда сводить нечего — та же ссылка, а не равный снимок', () => {
    const state = openTab(EMPTY_TABS, A);
    expect(syncTabs(state, [A.id])).toBe(state);
  });

  it('порядок и режим предпросмотра не перетираются списком открытых', () => {
    let state = openTab(EMPTY_TABS, A, { preview: false });
    state = openTab(state, B);
    const synced = syncTabs(state, [B.id, A.id]);
    expect(ids(synced)).toEqual([A.id, B.id]);
    expect(synced.tabs[1].preview).toBe(true);
  });
});

describe('withDirtyFlags', () => {
  it('переносит признак изменённости из рабочей области', () => {
    const state = openTab(openTab(EMPTY_TABS, A, { preview: false }), B, { preview: false });
    const dirty = withDirtyFlags(state, (id) => id === B.id);
    expect(dirty.tabs.map((tab) => tab.dirty)).toEqual([false, true]);
  });

  it('без изменений отдаёт ту же ссылку', () => {
    const state = openTab(EMPTY_TABS, A);
    expect(withDirtyFlags(state, () => false)).toBe(state);
  });
});

describe('refFromResourceId', () => {
  it('восстанавливает имя, путь и медиатип из идентификатора', () => {
    expect(refFromResourceId('mem:forms/credit/schema.json')).toEqual({
      id: 'mem:forms/credit/schema.json',
      sourceId: 'mem',
      path: 'forms/credit/schema.json',
      name: 'schema.json',
      kind: 'file',
      mediaType: 'application/json',
    });
  });
});

describe('resourceKindOf', () => {
  it('без документа вид неизвестен', () => {
    expect(resourceKindOf(null)).toBeNull();
  });

  it('у текстового документа вид — его медиатип', () => {
    const handle = createDocument(C, '# заголовок', false);
    expect(resourceKindOf(handle.document)).toBe('text/markdown');
  });

  it('у модельного документа вид объявляет провайдер', () => {
    // Модельный документ подделан структурно: `createModelDocument` потребовал бы провайдера
    // с разбором, а проверяется здесь ровно одно — откуда берётся вид ресурса.
    const model = {
      ...createDocument(A, '{}', false).document,
      kind: 'model',
      providerId: 'form.schema',
    } as unknown as Document;
    expect(resourceKindOf(model)).toBe('form.schema');
  });
});

/**
 * Подставная рабочая область: только то, что нужно вкладкам, — и с журналом обращений.
 *
 * Журнал здесь не украшение: «повторное открытие в источник не ходит» и «сохранение перед
 * закрытием случилось» по состоянию не проверить, только по факту обращения.
 */
function fakeWorkspace(files: Readonly<Record<string, string>>) {
  const opened: ResourceId[] = [];
  const dirty = new Set<ResourceId>();
  const listeners = new Set<(e: WorkspaceChange) => void>();
  const documents = new Map<ResourceId, Document>();
  const calls: string[] = [];
  let saveOk = true;

  const emit = (): void => {
    for (const listener of [...listeners]) listener({ changes: [] });
  };

  const workspace: TabsWorkspace = {
    open(id) {
      calls.push(`open ${id}`);
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
      calls.push(`close ${id}`);
      const at = opened.indexOf(id);
      if (at >= 0) opened.splice(at, 1);
      emit();
      return Promise.resolve();
    },
    save(id) {
      calls.push(`save ${String(id)}`);
      if (saveOk && id !== undefined) dirty.delete(id);
      const result: SaveResult = {
        ok: saveOk,
        saved: saveOk && id !== undefined ? [id] : [],
        conflicts: [],
        failures: [],
      };
      emit();
      return Promise.resolve(result);
    },
    openedResources: () => [...opened],
    isDirty: (id) => (id === undefined ? dirty.size > 0 : dirty.has(id)),
    onDidChange(cb): Disposable {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },
  };

  return {
    workspace,
    calls,
    markDirty(id: ResourceId) {
      dirty.add(id);
      emit();
    },
    openElsewhere(id: ResourceId) {
      if (!opened.includes(id)) opened.push(id);
      emit();
    },
    failSave() {
      saveOk = false;
    },
  };
}

describe('createDocumentTabsStore', () => {
  it('открывает документ, показывает вкладку и уведомляет подписчика', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}' });
    const whenContext = createWhenContextStore();
    const store = createDocumentTabsStore({ workspace: fake.workspace, whenContext });
    const listener = vi.fn();
    store.subscribe(listener);

    await store.open(A.id);

    expect(ids(store.get())).toEqual([A.id]);
    expect(store.get().tabs[0].preview).toBe(true);
    expect(store.documentOf(A.id)?.id).toBe(A.id);
    expect(listener).toHaveBeenCalled();
    store.dispose();
  });

  it('вкладка вписывает `activeEditorId` и `activeResourceKind` в контекст применимости', async () => {
    const fake = fakeWorkspace({ 'c.md': '# ok' });
    const whenContext = createWhenContextStore();
    const store = createDocumentTabsStore({ workspace: fake.workspace, whenContext });

    expect(whenContext.get().activeEditorId).toBeNull();

    await store.open(C.id);
    expect(whenContext.get().activeEditorId).toBe(C.id);
    expect(whenContext.get().activeResourceKind).toBe('text/markdown');

    await store.close(C.id);
    expect(whenContext.get().activeEditorId).toBeNull();
    expect(whenContext.get().activeResourceKind).toBeNull();
    store.dispose();
  });

  it('переключение вкладки переписывает контекст под новый ресурс', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}', 'c.md': '#' });
    const whenContext = createWhenContextStore();
    const store = createDocumentTabsStore({ workspace: fake.workspace, whenContext });

    await store.open(A.id, { preview: false });
    await store.open(C.id, { preview: false });
    expect(whenContext.get().activeResourceKind).toBe('text/markdown');

    store.activate(A.id);
    expect(whenContext.get().activeEditorId).toBe(A.id);
    expect(whenContext.get().activeResourceKind).toBe('application/json');
    store.dispose();
  });

  it('повторное открытие не идёт в рабочую область второй раз', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}' });
    const store = createDocumentTabsStore({
      workspace: fake.workspace,
      whenContext: createWhenContextStore(),
    });

    await store.open(A.id);
    await store.open(A.id, { preview: false });

    expect(fake.calls.filter((call) => call.startsWith('open'))).toHaveLength(1);
    expect(store.get().tabs[0].preview).toBe(false);
    store.dispose();
  });

  it('открытие второго файла заменяет непринятую предпросмотровую вкладку', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}', 'b.json': '{}' });
    const store = createDocumentTabsStore({
      workspace: fake.workspace,
      whenContext: createWhenContextStore(),
    });

    await store.open(A.id);
    await store.open(B.id);

    // Ровно та ловушка, ради которой сведение пропускает открывающийся ресурс: пакет
    // изменений от `workspace.open` не должен успеть добавить вкладку раньше.
    expect(ids(store.get())).toEqual([B.id]);
    store.dispose();
  });

  it('изменённость приходит из рабочей области пакетом изменений', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}' });
    const store = createDocumentTabsStore({
      workspace: fake.workspace,
      whenContext: createWhenContextStore(),
    });
    await store.open(A.id);
    expect(store.get().tabs[0].dirty).toBe(false);

    fake.markDirty(A.id);
    expect(store.get().tabs[0].dirty).toBe(true);
    store.dispose();
  });

  it('закрытие изменённой вкладки требует подтверждения, а не закрывает молча', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}' });
    const store = createDocumentTabsStore({
      workspace: fake.workspace,
      whenContext: createWhenContextStore(),
    });
    await store.open(A.id);
    fake.markDirty(A.id);

    expect(store.requestClose(A.id).status).toBe('unsaved');
    expect(ids(store.get())).toEqual([A.id]);
    store.dispose();
  });

  it('`save: true` сохраняет перед закрытием', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}' });
    const store = createDocumentTabsStore({
      workspace: fake.workspace,
      whenContext: createWhenContextStore(),
    });
    await store.open(A.id);
    fake.markDirty(A.id);

    await store.close(A.id, { save: true });

    expect(fake.calls).toContain(`save ${A.id}`);
    expect(fake.calls).toContain(`close ${A.id}`);
    expect(store.get().tabs).toEqual([]);
    store.dispose();
  });

  it('неудачное сохранение оставляет вкладку открытой', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}' });
    const onError = vi.fn();
    const store = createDocumentTabsStore({
      workspace: fake.workspace,
      whenContext: createWhenContextStore(),
      onError,
    });
    await store.open(A.id);
    fake.markDirty(A.id);
    fake.failSave();

    await store.close(A.id, { save: true });

    expect(ids(store.get())).toEqual([A.id]);
    expect(fake.calls).not.toContain(`close ${A.id}`);
    expect(onError).toHaveBeenCalledOnce();
    store.dispose();
  });

  it('ресурс, открытый мимо вкладок, получает вкладку сам', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}' });
    const store = createDocumentTabsStore({
      workspace: fake.workspace,
      whenContext: createWhenContextStore(),
    });

    fake.openElsewhere(B.id);

    expect(ids(store.get())).toEqual([B.id]);
    expect(findTab(store.get(), B.id)?.preview).toBe(false);
    store.dispose();
  });

  it('после `dispose` пакеты изменений вкладок больше не трогают', async () => {
    const fake = fakeWorkspace({ 'a.json': '{}' });
    const store = createDocumentTabsStore({
      workspace: fake.workspace,
      whenContext: createWhenContextStore(),
    });
    await store.open(A.id);
    store.dispose();

    fake.openElsewhere(B.id);
    expect(ids(store.get())).toEqual([A.id]);
  });
});
