/**
 * Служба сохранения — против НАСТОЯЩЕГО держателя проекта над двойниками хранилищ.
 *
 * Проверяется шов: что «сохранить всё» и «есть ли несохранённое» отвечают состоянием рабочей
 * области открытого проекта, а без проекта — отказом значением, а не исключением. Сохранение —
 * единственная дверь наружу, и команда `Ctrl+S` стоит ровно на этой службе.
 *
 * @module shell/boot/ports/workspace-save.test
 */

import { describe, expect, it } from 'vitest';

import { createDiagnosticsService } from '@/shell/platform/services/diagnostics/service';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import { createMemorySource } from '@/shell/platform/source/memory';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import type { Source } from '@/shell/platform/source/types';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createProjectHost } from '@/shell/boot/project/project';
import { createWorkspaceSaveService } from './workspace-save';

let seq = 0;

/** Приложение в объёме службы: настоящий держатель проекта над памятью вместо IndexedDB и OPFS. */
function harness() {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-save-${seq}` });
  const opfs = createMemoryOpfs();
  const sources = createSourceRegistry();

  const sourceId = `save${seq}`;
  const source: Source = {
    ...createMemorySource(
      { 'readme.md': '# привет', 'notes.md': 'заметки' },
      { id: sourceId, label: `src-${seq}`, writable: true }
    ),
    descriptor: { kind: 'fs', handleKey: sourceId },
  };
  sources.register({ kind: 'fs', restore: () => Promise.resolve(source) });

  const project = createProjectHost({
    sources,
    handles: { keys: () => Promise.resolve([]) } as never,
    meta,
    whenContext: createWhenContextStore(),
    extensions: createExtensionRegistry(),
    diagnostics: createDiagnosticsService(),
    supported: () => true,
    createFiles: (workspaceId) =>
      createWorkspaceFileStore(workspaceId, {
        directory: opfs.directory,
        lock: (_name, body) => body(),
      }),
  });

  return {
    saving: createWorkspaceSaveService({ project }),
    id: (path: string): ResourceId => `${sourceId}:${path}`,
    write: (path: string, text: string) => {
      const session = project.get();
      if (session === null) throw new Error('проект не открыт');
      return session.workspace.writeText(`${sourceId}:${path}`, text);
    },
    // Источник адресуется ПУТЁМ, а не адресом ресурса: адрес — понятие рабочей области.
    sourceText: async (path: string) => (await source.read(path)).text,
    open: async () => {
      await meta.putWorkspace({
        id: sourceId,
        sourceId,
        descriptor: { ...source.descriptor },
        createdAt: 1,
        lastOpenedAt: 1,
      });
      await project.restoreLast();
      if (project.get() === null) throw new Error('проект не открылся');
    },
    dispose: () => {
      project.dispose();
      meta.dispose();
    },
  };
}

describe('сохранение рабочей копии', () => {
  it('без проекта сохранять нечего: отказ значением, а не исключением', async () => {
    const app = harness();
    try {
      await expect(app.saving.save([app.id('readme.md')])).resolves.toBe(false);
      await expect(app.saving.saveAll()).resolves.toBe(false);
      expect(app.saving.isDirty()).toBe(false);
    } finally {
      app.dispose();
    }
  });

  it('«сохранить всё» пишет каждую правку в источник и гасит признак несохранённого', async () => {
    const app = harness();
    try {
      await app.open();
      expect(app.saving.isDirty()).toBe(false);

      await app.write('readme.md', '# правка');
      await app.write('notes.md', 'новые заметки');
      expect(app.saving.isDirty()).toBe(true);
      // До сохранения источник нетронут: правка живёт в рабочей копии.
      await expect(app.sourceText('readme.md')).resolves.toBe('# привет');

      await expect(app.saving.saveAll()).resolves.toBe(true);

      await expect(app.sourceText('readme.md')).resolves.toBe('# правка');
      await expect(app.sourceText('notes.md')).resolves.toBe('новые заметки');
      expect(app.saving.isDirty()).toBe(false);
    } finally {
      app.dispose();
    }
  });

  it('сохранение набора адресов трогает только названное', async () => {
    const app = harness();
    try {
      await app.open();
      await app.write('readme.md', '# правка');
      await app.write('notes.md', 'новые заметки');

      await expect(app.saving.save([app.id('readme.md')])).resolves.toBe(true);

      await expect(app.sourceText('readme.md')).resolves.toBe('# правка');
      await expect(app.sourceText('notes.md')).resolves.toBe('заметки');
      // Вторая правка всё ещё не сохранена.
      expect(app.saving.isDirty()).toBe(true);
    } finally {
      app.dispose();
    }
  });
});
