/**
 * Служба источника проекта — против НАСТОЯЩЕГО держателя проекта над двойниками хранилищ.
 *
 * Проверяется ровно то, чем служба отличается от соседки (`./workspace-files`): она читает
 * сохранённое, а не рабочую копию, ничего не копирует в хранилище браузера и называет отказ
 * видом, а не сводит его к `null`.
 *
 * @module shell/boot/ports/workspace-source.test
 */

import { describe, expect, it } from 'vitest';

import { createDiagnosticsService } from '@/shell/platform/services/diagnostics/service';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId, SourceResult } from '@reformer/builder-plugin-api/internal';
import { createMemorySource } from '@/shell/platform/source/memory';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createProjectHost } from '@/shell/boot/project/project';
import { createWorkspaceSourceService } from './workspace-source';

let seq = 0;

/** Приложение в объёме службы: настоящий держатель проекта над памятью вместо IndexedDB и OPFS. */
function harness() {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-source-${seq}` });
  const opfs = createMemoryOpfs();
  const sources = createSourceRegistry();

  const sourceId = `mem${seq}`;
  const memory = createMemorySource(
    {
      'readme.md': '# привет',
      'forms/credit/form.json': '{}',
      'forms/credit/validation.ts': 'export const rules = {};',
    },
    { id: sourceId, label: `src-${seq}`, writable: true }
  );
  const source = Object.assign(memory, { descriptor: { kind: 'fs', handleKey: sourceId } });
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

  const service = createWorkspaceSourceService({ project });

  const workspace = () => {
    const session = project.get();
    if (session === null) throw new Error('проект не открыт');
    return session.workspace;
  };

  return {
    service,
    memory,
    opfs,
    workspace,
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

/** Вид отказа или `'ok'` — так ожидания читаются одной строкой. */
const kindOf = (result: SourceResult<unknown>): string => (result.ok ? 'ok' : result.error.kind);

describe('без проекта', () => {
  it('каждый вопрос — отказ no-project, а не исключение', async () => {
    const h = harness();
    expect(kindOf(await h.service.stat(h.id('readme.md')))).toBe('no-project');
    expect(kindOf(await h.service.list(h.id('')))).toBe('no-project');
    expect(kindOf(await h.service.readText(h.id('readme.md')))).toBe('no-project');
    h.dispose();
  });
});

describe('читает сохранённое, мимо рабочей копии', () => {
  it('несохранённая правка не видна: служба отдаёт текст источника', async () => {
    const h = harness();
    await h.open();
    await h.workspace().writeText(h.id('readme.md'), '# правка без сохранения');

    const read = await h.service.readText(h.id('readme.md'));

    expect(read).toEqual({ ok: true, value: { text: '# привет', mediaType: 'text/markdown' } });
    expect(await h.workspace().readText(h.id('readme.md'))).toBe('# правка без сохранения');
    h.dispose();
  });

  it('чтение ничего не копирует в хранилище браузера', async () => {
    const h = harness();
    await h.open();
    const before = { ...h.opfs.writes };

    expect(kindOf(await h.service.readText(h.id('forms/credit/validation.ts')))).toBe('ok');
    expect(kindOf(await h.service.list(h.id('forms/credit')))).toBe('ok');

    expect(h.opfs.writes).toEqual(before);
    h.dispose();
  });

  it('листинг — каталог источника: файл, созданный в рабочей копии и не сохранённый, не входит', async () => {
    const h = harness();
    await h.open();
    await h.workspace().writeText(h.id('forms/credit/draft.ts'), 'export {};');

    const listed = await h.service.list(h.id('forms/credit'));

    expect(listed.ok && listed.value.map((ref) => ref.name)).toEqual([
      'form.json',
      'validation.ts',
    ]);
    const fromWorkspace = await h.workspace().list(h.id('forms/credit'));
    expect(fromWorkspace.map((ref) => ref.name)).toContain('draft.ts');
    h.dispose();
  });

  it('каталоги в листинге — первыми, ссылка той же формы, что у рабочей области', async () => {
    const h = harness();
    await h.open();

    const listed = await h.service.list(h.id(''));

    expect(listed.ok && listed.value.map((ref) => [ref.name, ref.kind])).toEqual([
      ['forms', 'directory'],
      ['readme.md', 'file'],
    ]);
    expect(listed.ok && listed.value[1]).toEqual({
      id: h.id('readme.md'),
      sourceId: h.id('').slice(0, -1),
      path: 'readme.md',
      name: 'readme.md',
      kind: 'file',
      mediaType: 'text/markdown',
    });
    h.dispose();
  });
});

describe('stat', () => {
  it('файл — с медиатипом и размером, каталог и корень — каталог', async () => {
    const h = harness();
    await h.open();

    expect(await h.service.stat(h.id('readme.md'))).toEqual({
      ok: true,
      value: {
        kind: 'file',
        mediaType: 'text/markdown',
        size: new TextEncoder().encode('# привет').length,
      },
    });
    expect(await h.service.stat(h.id('forms'))).toEqual({ ok: true, value: { kind: 'directory' } });
    expect(await h.service.stat(h.id(''))).toEqual({ ok: true, value: { kind: 'directory' } });
    expect(kindOf(await h.service.stat(h.id('nope.md')))).toBe('not-found');
    h.dispose();
  });
});

describe('отказы — видом', () => {
  it('каталог — is-directory, нет файла — not-found', async () => {
    const h = harness();
    await h.open();
    expect(kindOf(await h.service.readText(h.id('forms')))).toBe('is-directory');
    expect(kindOf(await h.service.readText(h.id('')))).toBe('is-directory');
    expect(kindOf(await h.service.readText(h.id('forms/nope.json')))).toBe('not-found');
    h.dispose();
  });

  it('двоичный ресурс — not-text, и тело его не читается', async () => {
    const h = harness();
    await h.open();
    h.memory.put('assets/logo.png', 'не текст', 'image/png');
    h.memory.forget();

    const read = await h.service.readText(h.id('assets/logo.png'));

    expect(kindOf(read)).toBe('not-text');
    expect(read.ok ? '' : read.error.message).toContain('image/png');
    expect(h.memory.bodyReads).toBe(0);
    h.dispose();
  });

  it('больше maxBytes — too-large ДО чтения тела', async () => {
    const h = harness();
    await h.open();
    h.memory.forget();

    expect(kindOf(await h.service.readText(h.id('readme.md'), { maxBytes: 4 }))).toBe('too-large');
    expect(h.memory.bodyReads).toBe(0);
    h.dispose();
  });

  it('побег за корень — forbidden, адрес чужого источника — not-found', async () => {
    const h = harness();
    await h.open();
    expect(kindOf(await h.service.readText(h.id('../secret')))).toBe('forbidden');
    expect(kindOf(await h.service.readText('elsewhere:readme.md'))).toBe('not-found');
    h.dispose();
  });

  it('отказ источника сохраняет вид: отозванный доступ — unauthorized', async () => {
    const h = harness();
    await h.open();
    h.memory.failNext('unauthorized', { op: 'stat', path: 'readme.md' });

    expect(kindOf(await h.service.readText(h.id('readme.md')))).toBe('unauthorized');
    h.dispose();
  });

  it('вид, которого у службы нет, сводится к failed', async () => {
    const h = harness();
    await h.open();
    h.memory.failNext('network', { op: 'list' });

    expect(kindOf(await h.service.list(h.id('forms')))).toBe('failed');
    h.dispose();
  });

  it('остановленный сигнал — aborted, источник не спрашивают', async () => {
    const h = harness();
    await h.open();
    h.memory.forget();
    const controller = new AbortController();
    controller.abort();

    const read = await h.service.readText(h.id('readme.md'), { signal: controller.signal });

    expect(kindOf(read)).toBe('aborted');
    expect(h.memory.calls).toEqual([]);
    h.dispose();
  });
});
