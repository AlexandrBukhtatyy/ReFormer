/**
 * Служба записей рабочей области — против НАСТОЯЩЕГО держателя проекта над двойниками хранилищ.
 *
 * Проверяется шов, а не рабочая область: адресация обязана отвечать и без проекта (она
 * выводится из самого адреса), а чтение, листинг и проверка существования — отвечать
 * ЗНАЧЕНИЕМ на отказ источника, а не исключением. Второе ломается молча и в худшую сторону:
 * генерация спрашивает `exists`, чтобы не затереть чужой файл, и исключение здесь означало бы
 * либо падение на полпути, либо `catch` у каждого вызывающего.
 *
 * @module shell/boot/ports/workspace-files.test
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
import { createWorkspaceFilesService } from './workspace-files';

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

  const files = createWorkspaceFilesService({ project });

  return {
    files,
    id: (path: string): ResourceId => `${sourceId}:${path}`,
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

describe('адресация: отвечает и без проекта', () => {
  it('каталог ресурса, а для корня источника — сам корень', () => {
    const h = harness();

    expect(h.files.parentOf(h.id('forms/credit/form.json'))).toBe(h.id('forms/credit'));
    // Подниматься из корня некуда: это был бы выход за пределы источника.
    expect(h.files.parentOf(h.id('readme.md'))).toBe(h.id(''));
    h.dispose();
  });

  it('соседний адрес собирается из каталога и имён', () => {
    const h = harness();
    const dir = h.id('forms/credit');

    expect(h.files.resolve(dir, 'validation.ts')).toBe(h.id('forms/credit/validation.ts'));
    expect(h.files.resolve(dir, 'nested', 'deep.ts')).toBe(h.id('forms/credit/nested/deep.ts'));
    h.dispose();
  });

  it('путь ОТ КОРНЯ источника считается от опоры, а не от активного документа', () => {
    // Так записаны импорты и ссылки в схеме: `src/forms/credit`, а не «на два вверх».
    const h = harness();

    expect(h.files.fromRoot(h.id('forms/credit/form.json'), 'shared/kit.ts')).toBe(
      h.id('shared/kit.ts')
    );
    h.dispose();
  });

  it('корень проекта без проекта — `null`, а не выдуманный адрес', () => {
    const h = harness();

    expect(h.files.projectRoot()).toBeNull();
    h.dispose();
  });
});

describe('чтение рабочей области', () => {
  it('без проекта отвечает значением, а не отказом: «нет», пусто и `null`', async () => {
    // Значением, потому что спрашивают это, чтобы РЕШИТЬ, что делать дальше. Исключение
    // заставило бы каждого вызывающего отличать «нет» от «не знаю» там, где различать нечем.
    const h = harness();
    const id = h.id('forms/credit/form.json');

    await expect(h.files.exists(id)).resolves.toBe(false);
    await expect(h.files.list(h.id('forms'))).resolves.toEqual([]);
    await expect(h.files.readText(id)).resolves.toBeNull();
    h.dispose();
  });

  it('с проектом: существование, один уровень каталога и текст', async () => {
    const h = harness();
    await h.open();

    await expect(h.files.exists(h.id('forms/credit/form.json'))).resolves.toBe(true);
    await expect(h.files.exists(h.id('forms/credit/нет.json'))).resolves.toBe(false);

    const listed = await h.files.list(h.id('forms/credit'));
    expect(listed.map((ref) => ref.name).sort()).toEqual(['form.json', 'validation.ts']);

    await expect(h.files.readText(h.id('forms/credit/validation.ts'))).resolves.toBe(
      'export const rules = {};'
    );
    h.dispose();
  });

  it('корень проекта — корень ИСТОЧНИКА, а не каталог открытого файла', async () => {
    const h = harness();
    await h.open();

    expect(h.files.projectRoot()).toBe(h.id(''));
    h.dispose();
  });

  it('листинг несуществующего каталога — пусто: «здесь ничего не нашлось»', async () => {
    const h = harness();
    await h.open();

    await expect(h.files.list(h.id('нет-такого'))).resolves.toEqual([]);
    h.dispose();
  });
});
