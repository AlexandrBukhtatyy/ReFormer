/**
 * Служба правки записей — против НАСТОЯЩЕГО держателя проекта над двойниками хранилищ.
 *
 * Проверяется шов и ОДНО правило, которого у соседней службы нет: без проекта операции
 * отказывают вызывающему, а не отвечают пустотой. Пустота здесь читалась бы как «сделали,
 * ничего не изменилось» — и команда, создавшая файл в закрытом проекте, отчиталась бы
 * об успехе.
 *
 * @module shell/boot/ports/workspace-resources.test
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
import { createWorkspaceResourcesService } from './workspace-resources';

let seq = 0;

/** Приложение в объёме службы: настоящий держатель проекта над памятью вместо IndexedDB и OPFS. */
function harness() {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-files-${seq}` });
  const opfs = createMemoryOpfs();
  const sources = createSourceRegistry();

  const sourceId = `mem${seq}`;
  const source: Source = {
    ...createMemorySource(
      {
        'readme.md': '# привет',
        'forms/credit/form.json': '{}',
        'forms/credit/validation.ts': 'export const rules = {};',
      },
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

  const resources = createWorkspaceResourcesService({ project });

  return {
    resources,
    id: (path: string): ResourceId => `${sourceId}:${path}`,
    canOpen: () => project.canOpen(),
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

describe('правка записей проекта', () => {
  it('без проекта каждая операция отказывает вызывающему', async () => {
    const app = harness();
    try {
      // Отказ, а не `null`: вызов без проекта — ошибка вызывающего. Ответь служба пустотой,
      // команда создания файла отчиталась бы об успехе, не создав ничего.
      await expect(app.resources.createFile(app.id('src'), 'a.ts')).rejects.toThrow(
        'проект не открыт'
      );
      await expect(app.resources.remove([app.id('readme.md')])).rejects.toThrow('проект не открыт');
    } finally {
      app.dispose();
    }
  });

  it('с проектом создаёт, переименовывает и удаляет в источнике', async () => {
    const app = harness();
    try {
      await app.open();

      const created = await app.resources.createFile(app.id(''), 'новый.ts', 'export {};');
      const renamed = await app.resources.rename(created, 'другой.ts');
      const removed = await app.resources.remove([renamed]);

      expect(removed.done).toEqual([renamed]);
      expect(removed.failed).toEqual([]);
    } finally {
      app.dispose();
    }
  });

  it('открытие каталога спрашивает держателя проекта, а не решает само', async () => {
    const app = harness();
    try {
      // Движок в стенде выбирать каталог не умеет (`supported: () => true`, но выбора нет),
      // и служба обязана отдать ответ держателя, а не выдумать свой.
      expect(app.resources.canOpenProject()).toBe(app.canOpen());
    } finally {
      app.dispose();
    }
  });
});
