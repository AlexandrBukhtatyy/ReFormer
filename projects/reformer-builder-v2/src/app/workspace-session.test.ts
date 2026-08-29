/**
 * Тесты рабочей сессии — против настоящей рабочей области над подставными хранилищами.
 *
 * Мока здесь нет ни одного: OPFS, IndexedDB и источник заменены двойниками из `storage/testing`
 * и `source/memory`, а рабочая область, вкладки и дерево — настоящие. Иначе проверялось бы,
 * что сессия зовёт то, что мы ей подсунули, а не что из неё получается работающий проект.
 *
 * @module app/workspace-session.test
 */

import { describe, expect, it } from 'vitest';

import { toDisposable, type Disposable } from '../host/primitives/disposable';
import type { ResourceId } from '../host/primitives/resource';
import { createMemorySource } from '../host/source/memory';
import type { Document } from '../host/workspace/document';
import type { WorkspaceChange } from '../host/workspace/workspace';
import { createWorkspaceMetaStore } from '../host/workspace/storage/idb';
import { createWorkspaceFileStore } from '../host/workspace/storage/opfs';
import { createMemoryIndexedDb, createMemoryOpfs } from '../host/workspace/storage/testing';
import { createWhenContextStore } from '../host/ui/when-context-store';
import type { DocumentTabsStore } from '../host/ui/tabs';
import type { Journal } from '../host/workspace/journal/journal';
import {
  createWorkspaceSession,
  createWorkspaceStatusSource,
  watchOpenDocuments,
  type StatusWorkspace,
} from './workspace-session';

let seq = 0;

/** Сессия над двойниками: хранилища в памяти, источник в памяти, всё остальное настоящее. */
function harness(
  files: Readonly<Record<string, string>> = { 'a.txt': 'привет' },
  journals?: Map<string, Journal>
) {
  seq += 1;
  const workspaceId = `ws-${seq}`;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-${seq}` });
  const opfs = createMemoryOpfs();
  const store = createWorkspaceFileStore(workspaceId, {
    directory: opfs.directory,
    lock: (_name, body) => body(),
  });
  const source = createMemorySource(files, {
    id: `mem${seq}`,
    label: `mem-${seq}`,
    writable: true,
  });
  const whenContext = createWhenContextStore();

  const session = createWorkspaceSession({
    workspaceId,
    source,
    files: store,
    meta,
    whenContext,
    journals,
  });

  return {
    session,
    whenContext,
    workspaceId,
    id: (path: string): ResourceId => `${source.id}:${path}`,
    dispose: () => {
      session.dispose();
      meta.dispose();
    },
  };
}

describe('рабочая сессия', () => {
  it('дерево читает верхний уровень источника', async () => {
    const h = harness({ 'a.txt': 'a', 'sub/b.txt': 'b' });

    await h.session.tree.expand(h.session.tree.get().rootId);

    const level = h.session.tree.get().children.get(h.session.tree.get().rootId) ?? [];
    expect(level.map((ref) => ref.name).sort()).toEqual(['a.txt', 'sub']);
    h.dispose();
  });

  it('открытие ресурса даёт вкладку и документ с содержимым', async () => {
    const h = harness();

    await h.session.documents.open(h.id('a.txt'));

    expect(h.session.documents.get().tabs.map((tab) => tab.ref.path)).toEqual(['a.txt']);
    expect(h.session.documents.documentOf(h.id('a.txt'))?.getText()).toBe('привет');
    h.dispose();
  });

  it('открытие пишет активный документ в контекст применимости', async () => {
    const h = harness();

    await h.session.documents.open(h.id('a.txt'));

    expect(h.whenContext.get().activeEditorId).toBe(h.id('a.txt'));
    h.dispose();
  });

  it('правка рабочей копии поднимает счётчик несохранённого в строке состояния', async () => {
    const h = harness();
    await h.session.documents.open(h.id('a.txt'));
    expect(h.session.status.get()).toMatchObject({ hasWorkspace: true, dirtyCount: 0 });

    await h.session.workspace.writeText(h.id('a.txt'), 'правка');

    expect(h.session.status.get().dirtyCount).toBe(1);
    h.dispose();
  });

  it('сохранение возвращает правку в источник и гасит счётчик', async () => {
    const h = harness();
    await h.session.documents.open(h.id('a.txt'));
    await h.session.workspace.writeText(h.id('a.txt'), 'правка');

    const result = await h.session.workspace.save(h.id('a.txt'));

    expect(result.ok).toBe(true);
    expect(h.session.status.get().dirtyCount).toBe(0);
    expect(await h.session.workspace.readText(h.id('a.txt'))).toBe('правка');
    h.dispose();
  });
});

/** Рабочая область в объёме строки состояния — управляемая руками. */
function fakeStatusWorkspace(): StatusWorkspace & {
  markDirty(id: ResourceId): void;
  change(): void;
} {
  const open: ResourceId[] = ['s:a', 's:b'];
  const dirty = new Set<ResourceId>();
  const listeners = new Set<(event: WorkspaceChange) => void>();
  return {
    openedResources: () => open,
    isDirty: (id?: ResourceId) => (id === undefined ? dirty.size > 0 : dirty.has(id)),
    onDidChange(cb) {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },
    markDirty(id) {
      dirty.add(id);
    },
    change() {
      for (const listener of [...listeners]) listener({ changes: [] });
    },
  };
}

describe('итог по рабочей области', () => {
  it('считает несохранённые среди открытых', () => {
    const workspace = fakeStatusWorkspace();
    const status = createWorkspaceStatusSource(workspace);

    workspace.markDirty('s:a');
    workspace.change();

    expect(status.get()).toEqual({
      hasWorkspace: true,
      dirtyCount: 1,
      externallyChangedCount: 0,
    });
  });

  it('пакет изменений, ничего не изменивший, не двигает ссылку снимка', () => {
    const workspace = fakeStatusWorkspace();
    const status = createWorkspaceStatusSource(workspace);
    const before = status.get();
    let woken = 0;
    status.subscribe(() => {
      woken += 1;
    });

    workspace.change();

    expect(status.get()).toBe(before);
    expect(woken).toBe(0);
  });

  it('после `dispose` подписка на рабочую область снята', () => {
    const workspace = fakeStatusWorkspace();
    const status = createWorkspaceStatusSource(workspace);
    let woken = 0;
    status.subscribe(() => {
      woken += 1;
    });

    status.dispose();
    workspace.markDirty('s:a');
    workspace.change();

    expect(woken).toBe(0);
  });
});

/** Вкладки в объёме, нужном наблюдению валидации. */
function fakeTabs() {
  let ids: ResourceId[] = [];
  const listeners = new Set<() => void>();
  const store = {
    get: () => ({ tabs: ids.map((id) => ({ ref: { id } })), activeId: ids[0] ?? null }),
    subscribe(listener: () => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
    documentOf: (id: ResourceId) => ({ id }) as unknown as Document,
  } as unknown as DocumentTabsStore;
  return {
    store,
    set(next: readonly ResourceId[]) {
      ids = [...next];
      for (const listener of [...listeners]) listener();
    },
  };
}

/** Оркестратор в объёме одного метода: остальное наблюдению не нужно. */
function fakeValidation() {
  const watched: ResourceId[] = [];
  const released: ResourceId[] = [];
  return {
    watched,
    released,
    orchestrator: {
      validate: () => [],
      revalidate: () => undefined,
      dispose: () => undefined,
      watch(document: Document): Disposable {
        watched.push(document.id);
        return toDisposable(() => {
          released.push(document.id);
        });
      },
    },
  };
}

describe('наблюдение валидации за открытыми вкладками', () => {
  it('ставит наблюдение на каждую открытую вкладку', () => {
    const tabs = fakeTabs();
    const validation = fakeValidation();
    watchOpenDocuments(tabs.store, validation.orchestrator);

    tabs.set(['s:a', 's:b']);

    expect(validation.watched).toEqual(['s:a', 's:b']);
  });

  it('повторное изменение вкладок не удваивает наблюдение', () => {
    const tabs = fakeTabs();
    const validation = fakeValidation();
    watchOpenDocuments(tabs.store, validation.orchestrator);

    tabs.set(['s:a']);
    tabs.set(['s:a']);

    expect(validation.watched).toEqual(['s:a']);
  });

  it('закрытая вкладка снимает наблюдение — вместе с опубликованными находками', () => {
    const tabs = fakeTabs();
    const validation = fakeValidation();
    watchOpenDocuments(tabs.store, validation.orchestrator);
    tabs.set(['s:a', 's:b']);

    tabs.set(['s:b']);

    expect(validation.released).toEqual(['s:a']);
  });

  it('снятие подписки убирает все наблюдения разом', () => {
    const tabs = fakeTabs();
    const validation = fakeValidation();
    const subscription = watchOpenDocuments(tabs.store, validation.orchestrator);
    tabs.set(['s:a', 's:b']);

    subscription.dispose();

    expect(validation.released.sort()).toEqual(['s:a', 's:b']);
  });
});

describe('счётчик расхождений в строке состояния', () => {
  it('берётся из наблюдения, а не из рабочей области', () => {
    // Рабочая область узнаёт о внешнем изменении только в момент сохранения, то есть слишком
    // поздно, чтобы предупредить. Раньше здесь стоял жёсткий ноль — и это была честная
    // заглушка ровно до тех пор, пока наблюдения не существовало.
    let count = 0;
    const listeners = new Set<() => void>();
    const status = createWorkspaceStatusSource(
      {
        isDirty: () => false,
        openedResources: () => [],
        onDidChange: () => ({ dispose: () => {} }),
      },
      {
        get: () => ({ records: [], count }),
        subscribe: (cb: () => void) => {
          listeners.add(cb);
          return { dispose: () => listeners.delete(cb) };
        },
      } as never
    );

    expect(status.get().externallyChangedCount).toBe(0);

    count = 2;
    for (const cb of listeners) cb();

    expect(status.get().externallyChangedCount).toBe(2);
  });

  it('без наблюдения счётчик ноль: «никто не смотрел», а не «расхождений нет»', () => {
    const status = createWorkspaceStatusSource({
      isDirty: () => false,
      openedResources: () => [],
      onDidChange: () => ({ dispose: () => {} }),
    });

    expect(status.get().externallyChangedCount).toBe(0);
  });

  it('снимок не меняет ссылку, если счётчик не изменился', () => {
    // `useSyncExternalStore` сравнивает по ссылке: новый объект на каждое уведомление
    // означал бы перерисовку строки состояния на каждое чужое событие.
    const listeners = new Set<() => void>();
    const status = createWorkspaceStatusSource(
      {
        isDirty: () => false,
        openedResources: () => [],
        onDidChange: () => ({ dispose: () => {} }),
      },
      {
        get: () => ({ records: [], count: 0 }),
        subscribe: (cb: () => void) => {
          listeners.add(cb);
          return { dispose: () => listeners.delete(cb) };
        },
      } as never
    );

    const before = status.get();
    for (const cb of listeners) cb();

    expect(status.get()).toBe(before);
  });
});

describe('журнал правок подключён к рабочей области', () => {
  it('правка попадает в журнал, а не пропадает', async () => {
    // Механика журнала — ретенция, якорные снимки, схлопывание — была написана целиком
    // и НЕ ВЫЗЫВАЛАСЬ НИ РАЗУ: `createJournal` не звал никто, кроме тестов самого журнала.
    // Пометка происхождения при этом уже доезжала до записи и там пропадала.
    const journals = new Map<string, Journal>();
    const h = harness({ 'a.txt': 'было' }, journals);
    await h.session.workspace.open(h.id('a.txt'));

    await h.session.workspace.writeText(h.id('a.txt'), 'стало');

    const journal = journals.get(h.workspaceId);
    expect(journal).toBeDefined();
    const records = await journal!.list(h.id('a.txt'));
    expect(records.length).toBeGreaterThan(0);
    h.dispose();
  });

  it('происхождение правки различимо: ассистент и человек не сливаются', async () => {
    // Ровно половина ценности журнала. До подключения производитель пометки существовал,
    // а потребителя не было вовсе.
    const journals = new Map<string, Journal>();
    const h = harness({ 'a.txt': '1' }, journals);
    await h.session.workspace.open(h.id('a.txt'));

    await h.session.workspace.writeText(h.id('a.txt'), '2');
    await h.session.workspace.writeText(h.id('a.txt'), '3', {
      origin: 'agent',
      txId: 'turn-1',
    });

    const records = await journals.get(h.workspaceId)!.list(h.id('a.txt'));
    const origins = records.map((r) => r.origin);
    expect(origins).toContain('user');
    expect(origins).toContain('agent');
    h.dispose();
  });

  it('без реестра журнал всё равно работает: реестр нужен только разгрузке', async () => {
    const h = harness({ 'a.txt': '1' });
    await h.session.workspace.open(h.id('a.txt'));

    await expect(h.session.workspace.writeText(h.id('a.txt'), '2')).resolves.not.toThrow();
    h.dispose();
  });
});
