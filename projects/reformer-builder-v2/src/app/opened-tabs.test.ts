/**
 * Вкладки переживают перезагрузку — против настоящей сессии и настоящих хранилищ-двойников.
 *
 * Проверяется то, что ломается молча: запись есть, а ряд после перезагрузки пуст, — или
 * наоборот, ряд восстановился, но не в том порядке и не с той активной вкладкой. Ни то ни
 * другое не видно по одному вызову: нужна ВТОРАЯ сессия над тем же хранилищем метаданных,
 * то есть ровно то, что делает F5.
 *
 * @module app/opened-tabs.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '../host/primitives/resource';
import { createMemorySource } from '../host/source/memory';
import { createWorkspaceMetaStore, type WorkspaceMetaStore } from '../host/workspace/storage/idb';
import { createWorkspaceFileStore } from '../host/workspace/storage/opfs';
import { createMemoryIndexedDb, createMemoryOpfs } from '../host/workspace/storage/testing';
import { createWhenContextStore } from '../host/ui/when-context-store';
import { createWorkspaceSession, type WorkspaceSession } from './workspace-session';
import { restoreOpenedTabs } from './opened-tabs';

const FILES = { 'a.ts': 'a', 'b.ts': 'b', 'c.ts': 'c' };

let seq = 0;

/**
 * Одна «жизнь страницы»: своя сессия над ОБЩИМИ хранилищами.
 *
 * Общее здесь — метаданные и OPFS: их переживание перезагрузки и есть предмет проверки.
 * Всё остальное (рабочая область, вкладки, дерево) создаётся заново, как при запуске.
 */
function session(shared: { meta: WorkspaceMetaStore; opfs: ReturnType<typeof createMemoryOpfs> }) {
  const workspaceId = 'ws';
  const source = createMemorySource(FILES, { id: 'mem', label: 'mem', writable: true });
  const created = createWorkspaceSession({
    workspaceId,
    source,
    files: createWorkspaceFileStore(workspaceId, { directory: shared.opfs.directory }),
    meta: shared.meta,
    whenContext: createWhenContextStore(),
  });
  return {
    session: created,
    workspaceId,
    id: (path: string): ResourceId => `${source.id}:${path}` as ResourceId,
  };
}

function shared() {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  return {
    meta: createWorkspaceMetaStore({ factory, databaseName: `tabs-${seq}` }),
    opfs: createMemoryOpfs(),
  };
}

/** Дать подписке вкладок дописать записи: они уходят обещанием, а не в том же кадре. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Что видно в ряду: путь каждой вкладки по порядку. */
function paths(session: WorkspaceSession): readonly string[] {
  return session.documents.get().tabs.map((tab) => tab.ref.path);
}

describe('вкладки переживают перезагрузку', () => {
  it('ряд, его порядок и активная вкладка возвращаются', async () => {
    const disk = shared();
    const first = session(disk);
    await first.session.documents.open(first.id('a.ts'), { preview: false });
    await first.session.documents.open(first.id('b.ts'), { preview: false });
    await first.session.documents.open(first.id('c.ts'), { preview: false });
    first.session.documents.activate(first.id('b.ts'));
    await settle();
    first.session.dispose();

    // Перезагрузка: новая сессия над теми же хранилищами — ряд пуст, пока его не подняли.
    const second = session(disk);
    expect(paths(second.session)).toEqual([]);

    await restoreOpenedTabs({
      workspaceId: second.workspaceId,
      documents: second.session.documents,
      meta: disk.meta,
    });

    expect(paths(second.session)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(second.session.documents.get().activeId).toBe(second.id('b.ts'));
    second.session.dispose();
    disk.meta.dispose();
  });

  it('закрытая вкладка не возвращается', async () => {
    const disk = shared();
    const first = session(disk);
    await first.session.documents.open(first.id('a.ts'), { preview: false });
    await first.session.documents.open(first.id('b.ts'), { preview: false });
    await settle();
    await first.session.documents.close(first.id('a.ts'));
    await settle();
    first.session.dispose();

    const second = session(disk);
    await restoreOpenedTabs({
      workspaceId: second.workspaceId,
      documents: second.session.documents,
      meta: disk.meta,
    });

    expect(paths(second.session)).toEqual(['b.ts']);
    second.session.dispose();
    disk.meta.dispose();
  });

  it('временная вкладка возвращается временной и на своём месте', async () => {
    // Иначе следующий щелчок в дереве повёл бы себя иначе, чем до перезагрузки: временную
    // он заменяет, а закреплённую — нет.
    const disk = shared();
    const first = session(disk);
    await first.session.documents.open(first.id('a.ts'), { preview: true });
    await first.session.documents.open(first.id('b.ts'), { preview: false });
    await settle();
    first.session.dispose();

    const second = session(disk);
    await restoreOpenedTabs({
      workspaceId: second.workspaceId,
      documents: second.session.documents,
      meta: disk.meta,
    });

    expect(paths(second.session)).toEqual(['a.ts', 'b.ts']);
    expect(second.session.documents.get().tabs.map((tab) => tab.preview)).toEqual([true, false]);
    second.session.dispose();
    disk.meta.dispose();
  });

  it('запись про исчезнувший ресурс не открывается и вычищается', async () => {
    // «Исчез» здесь означает «нет ни в источнике, ни в рабочей копии»: файл, удалённый
    // из источника, но материализованный, вкладкой остаётся намеренно — иначе правки,
    // которые человек не сохранил, пропали бы вместе с ней.
    const disk = shared();
    const first = session(disk);
    await first.session.documents.open(first.id('a.ts'), { preview: false });
    await settle();
    first.session.dispose();

    await disk.meta.putOpened({
      workspaceId: 'ws',
      resourceId: 'mem:ghost.ts' as ResourceId,
      order: 1,
      pinned: true,
      openedAt: 1,
      activatedAt: 1,
    });

    const second = session(disk);
    await restoreOpenedTabs({
      workspaceId: second.workspaceId,
      documents: second.session.documents,
      meta: disk.meta,
    });

    expect(paths(second.session)).toEqual(['a.ts']);
    // Запись убрана тем, кто узнал об исчезновении: иначе она пыталась бы открыться
    // при каждом следующем запуске.
    const left = await disk.meta.listOpened(second.workspaceId);
    expect(left.map((record) => record.resourceId)).toEqual([second.id('a.ts')]);
    second.session.dispose();
    disk.meta.dispose();
  });

  it('несохранённые правки возвращаются вместе со вкладкой', async () => {
    // Рабочая копия лежит в OPFS и переживает перезагрузку; вкладка без неё вернулась бы
    // с содержимым источника, то есть потеряла бы работу человека молча.
    const disk = shared();
    const first = session(disk);
    await first.session.documents.open(first.id('a.ts'), { preview: false });
    await first.session.workspace.writeText(first.id('a.ts'), 'правка');
    await settle();
    first.session.dispose();

    const second = session(disk);
    await restoreOpenedTabs({
      workspaceId: second.workspaceId,
      documents: second.session.documents,
      meta: disk.meta,
    });

    expect(second.session.documents.documentOf(second.id('a.ts'))?.getText()).toBe('правка');
    expect(second.session.documents.get().tabs[0]?.dirty).toBe(true);
    second.session.dispose();
    disk.meta.dispose();
  });
});
