/**
 * Тесты держателя проекта.
 *
 * Проверяется контур переоткрытия целиком: выбранный каталог кладётся в хранилище хэндлов,
 * дескриптор — в метаданные, а «восстановить последний» поднимает источник по этой записи,
 * ничего не зная про File System Access. Выбор каталога и хранилище содержимого подменены —
 * ни окна, ни OPFS в `node` нет; всё остальное настоящее.
 *
 * @module app/project.test
 */

import { describe, expect, it } from 'vitest';

import { createMemorySource } from '@/shell/platform/source/memory';
import type { FsDirectoryHandle } from '@/shell/platform/source/fs-access';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import type { RestoredSource, Source } from '@/shell/platform/source/types';
import { createWhenContextStore } from '@/shell/platform/ui/when-context-store';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createDirectoryHandleStore } from './fs-handles';
import { createProjectHost, type ProjectFailure } from './project';

let seq = 0;

/** Каталог-двойник: важны имя и ответ на «это тот же каталог». */
function directory(name: string): FsDirectoryHandle {
  return {
    kind: 'directory',
    name,
    isSameEntry: (other: { name?: string }) => Promise.resolve(other.name === name),
  } as unknown as FsDirectoryHandle;
}

/**
 * Источник над каталогом. Дескриптор — `fs`, как у настоящего: именно он едет в метаданные,
 * и восстановление обязано пройти по нему.
 */
function fsSource(handleKey: string, files: Readonly<Record<string, string>>): Source {
  seq += 1;
  const base = createMemorySource(files, { id: handleKey, label: `src-${seq}`, writable: true });
  return { ...base, descriptor: { kind: 'fs', handleKey } };
}

function harness(files: Readonly<Record<string, string>> = { 'a.txt': 'привет' }) {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-${seq}` });
  const handles = createDirectoryHandleStore({ factory, databaseName: `handles-${seq}` });
  const sources = createSourceRegistry();
  const whenContext = createWhenContextStore();
  const failures: ProjectFailure[] = [];
  const opfs = createMemoryOpfs();

  /** Что фабрика источника отдаёт на восстановление: источник либо причина, по которой его нет. */
  let restored: (key: string) => RestoredSource = (key) => fsSource(key, files);
  let pick: () => Promise<FsDirectoryHandle> = () => Promise.resolve(directory('project'));
  let keySeq = 0;

  sources.register({
    kind: 'fs',
    restore: (descriptor) =>
      Promise.resolve(
        descriptor.kind === 'fs'
          ? restored((descriptor as { handleKey: string }).handleKey)
          : { unavailable: 'missing' as const }
      ),
  });

  const project = createProjectHost({
    sources,
    handles,
    meta,
    whenContext,
    onFailure: (failure) => failures.push(failure),
    newKey: () => `key-${(keySeq += 1)}`,
    now: () => keySeq,
    supported: () => true,
    pick: () => pick(),
    createFiles: (workspaceId) =>
      createWorkspaceFileStore(workspaceId, {
        directory: opfs.directory,
        lock: (_name, body) => body(),
      }),
  });

  return {
    project,
    meta,
    handles,
    whenContext,
    failures,
    pickDirectory: (name: string) => {
      pick = () => Promise.resolve(directory(name));
    },
    pickFails: (error: unknown) => {
      pick = () => Promise.reject(error);
    },
    setRestored: (next: (key: string) => RestoredSource) => {
      restored = next;
    },
    dispose: () => {
      project.dispose();
      meta.dispose();
      handles.dispose();
    },
  };
}

/** Отказ, которым браузер отвечает на закрытый диалог выбора каталога. */
function abortError(): Error {
  const error = new Error('человек закрыл диалог');
  error.name = 'AbortError';
  return error;
}

describe('открытие проекта', () => {
  it('кладёт хэндл в хранилище, дескриптор — в метаданные и поднимает сессию', async () => {
    const h = harness();

    await expect(h.project.open()).resolves.toBe(true);

    expect(h.project.get()?.workspaceId).toBe('key-1');
    expect(await h.handles.open('key-1')).toMatchObject({ name: 'project' });
    const [record] = await h.meta.listWorkspaces();
    expect(record).toMatchObject({ id: 'key-1', descriptor: { kind: 'fs', handleKey: 'key-1' } });
    h.dispose();
  });

  it('отмена выбора каталога — не ошибка и сессии не создаёт', async () => {
    const h = harness();
    h.pickFails(abortError());

    await expect(h.project.open()).resolves.toBe(false);

    expect(h.project.get()).toBeNull();
    expect(h.failures.map((failure) => failure.kind)).toEqual(['cancelled']);
    h.dispose();
  });

  it('сбой выбора каталога отличается от отмены', async () => {
    const h = harness();
    h.pickFails(new Error('файловая система отвалилась'));

    await expect(h.project.open()).resolves.toBe(false);

    expect(h.failures.map((failure) => failure.kind)).toEqual(['failed']);
    h.dispose();
  });

  it('повторный выбор того же каталога не плодит рабочих областей', async () => {
    const h = harness();
    await h.project.open();

    h.pickDirectory('project');
    await h.project.open();

    expect(h.project.get()?.workspaceId).toBe('key-1');
    expect(await h.meta.listWorkspaces()).toHaveLength(1);
    h.dispose();
  });

  it('другой каталог получает свою рабочую область', async () => {
    const h = harness();
    await h.project.open();

    h.pickDirectory('другой');
    await h.project.open();

    expect(h.project.get()?.workspaceId).toBe('key-2');
    expect(await h.meta.listWorkspaces()).toHaveLength(2);
    h.dispose();
  });

  it('источник, который не поднялся, — обычный ответ «недоступен», а не авария', async () => {
    const h = harness();
    h.setRestored(() => ({ unavailable: 'missing' }));

    await expect(h.project.open()).resolves.toBe(false);

    expect(h.project.get()).toBeNull();
    expect(h.failures).toEqual([{ kind: 'unavailable', reason: 'missing' }]);
    h.dispose();
  });

  it('движок без выбора каталога говорит об этом отдельным отказом', async () => {
    const h = harness();
    const unsupported = createProjectHost({
      sources: createSourceRegistry(),
      handles: h.handles,
      meta: h.meta,
      whenContext: h.whenContext,
      supported: () => false,
      onFailure: (failure) => h.failures.push(failure),
    });

    await expect(unsupported.open()).resolves.toBe(false);

    expect(unsupported.canOpen()).toBe(false);
    expect(h.failures.map((failure) => failure.kind)).toEqual(['unsupported']);
    unsupported.dispose();
    h.dispose();
  });
});

describe('восстановление последнего проекта', () => {
  it('поднимает источник по дескриптору самой свежей записи', async () => {
    const h = harness();
    await h.project.open();
    h.project.close();
    expect(h.project.get()).toBeNull();

    await expect(h.project.restoreLast()).resolves.toBe(true);

    expect(h.project.get()?.workspaceId).toBe('key-1');
    h.dispose();
  });

  it('пустые метаданные — «восстанавливать нечего», без единого отказа', async () => {
    const h = harness();

    await expect(h.project.restoreLast()).resolves.toBe(false);

    expect(h.failures).toEqual([]);
    h.dispose();
  });

  it('отозванное разрешение — «доступ не дан», а не «источника нет»', async () => {
    // Разница не косметическая: здесь человеку хватит нажатия «разрешить», после которого
    // `restoreLast()` спросит разрешение уже по жесту, — а «источника нет» лечится только
    // выбором проекта заново. Одним ответом эти две кнопки не выразить.
    const h = harness();
    await h.project.open();
    h.project.close();
    h.setRestored(() => ({ unavailable: 'denied' }));

    await expect(h.project.restoreLast()).resolves.toBe(false);

    expect(h.project.get()).toBeNull();
    expect(h.failures).toEqual([{ kind: 'unavailable', reason: 'denied' }]);
    h.dispose();
  });

  it('пропавший дескриптор — «источника нет»: переоткрывать нечего', async () => {
    const h = harness();
    await h.project.open();
    h.project.close();
    h.setRestored(() => ({ unavailable: 'missing' }));

    await expect(h.project.restoreLast()).resolves.toBe(false);

    expect(h.failures).toEqual([{ kind: 'unavailable', reason: 'missing' }]);
    h.dispose();
  });

  it('повторная попытка после «разрешить» поднимает проект: дескриптор никуда не делся', async () => {
    // Это и есть та самая «одна кнопка»: интерфейс, получив `denied`, зовёт `restoreLast()`
    // из обработчика нажатия — и на этот раз разрешение спрашивается по жесту.
    const h = harness();
    await h.project.open();
    h.project.close();
    h.setRestored(() => ({ unavailable: 'denied' }));
    await h.project.restoreLast();

    h.setRestored((key) => fsSource(key, { 'a.txt': 'привет' }));

    await expect(h.project.restoreLast()).resolves.toBe(true);
    expect(h.project.get()?.workspaceId).toBe('key-1');
    h.dispose();
  });
});

describe('закрытие проекта', () => {
  it('чистит активный редактор в контексте применимости', async () => {
    const h = harness();
    await h.project.open();
    await h.project.get()?.documents.open('key-1:a.txt');
    expect(h.whenContext.get().activeEditorId).toBe('key-1:a.txt');

    h.project.close();

    expect(h.whenContext.get().activeEditorId).toBeNull();
    h.dispose();
  });

  it('будит подписчиков на смену проекта', async () => {
    const h = harness();
    let woken = 0;
    h.project.subscribe(() => {
      woken += 1;
    });

    await h.project.open();
    h.project.close();

    expect(woken).toBe(2);
    h.dispose();
  });
});
