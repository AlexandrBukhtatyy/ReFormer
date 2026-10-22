/**
 * Плагин файлов для ассистента: адреса `source:`, чтение из источника, поиск для пикера,
 * `list_source` и пункт меню «Прикрепить к ассистенту».
 *
 * Источник здесь — двойник службы `WorkspaceSourceService` над картой «путь → текст»: проверяется
 * то, что делает плагин, а не платформа (её служба покрыта в оболочке).
 *
 * @module plugins/base/files/assistant/assistant.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  ASSISTANT_ATTACH_COMMAND_ID,
  isAssistantToolName,
  type CommandContribution,
  type Disposable,
  type ResourceRef,
  type SourceReadError,
  type WorkspaceSourceService,
} from '@reformer/builder-plugin-api';
import { attachMenuItem, contributeAttachMenu } from './attach-menu';
import { listSourceTool } from './list-source';
import type { SourceAccess } from './source-errors';
import { createSourceIndex } from './source-index';
import { readSource, SOURCE_DESCRIBE, sourceResourceProvider } from './source-provider';
import { deniedReason, normalizeSourcePath, pathOfUri, uriOfPath } from './source-uri';

const signal = new AbortController().signal;
const ROOT = 'disk:';

/** Двойник источника: файлы по путям, каталоги — по префиксам; `binary` — не текст. */
function fakeSource(
  files: Readonly<Record<string, string>>,
  options: { binary?: readonly string[]; open?: boolean } = {}
) {
  const pathOf = (id: string): string => id.slice(ROOT.length);
  const isDir = (path: string): boolean =>
    path === '' || Object.keys(files).some((file) => file.startsWith(`${path}/`));
  const fail = (kind: SourceReadError['kind']) => ({
    ok: false as const,
    error: { kind, message: kind },
  });
  const lists = vi.fn();
  const open = options.open ?? true;

  const source: WorkspaceSourceService = {
    stat(id) {
      if (!open) return Promise.resolve(fail('no-project'));
      const path = pathOf(id);
      if (path in files) {
        return Promise.resolve({
          ok: true,
          value: { kind: 'file', mediaType: 'text/plain', size: files[path].length },
        });
      }
      return Promise.resolve(
        isDir(path) ? { ok: true, value: { kind: 'directory' } } : fail('not-found')
      );
    },
    list(id) {
      lists(id);
      if (!open) return Promise.resolve(fail('no-project'));
      const base = pathOf(id);
      if (!isDir(base)) return Promise.resolve(fail('not-found'));
      const prefix = base === '' ? '' : `${base}/`;
      const children = new Map<string, ResourceRef>();
      for (const file of Object.keys(files)) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        const slash = rest.indexOf('/');
        const name = slash < 0 ? rest : rest.slice(0, slash);
        const path = `${prefix}${name}`;
        children.set(name, {
          id: `${ROOT}${path}`,
          sourceId: 'disk',
          path,
          name,
          kind: slash < 0 ? 'file' : 'directory',
          mediaType: 'text/plain',
        });
      }
      const sorted = [...children.values()].sort((a, b) =>
        a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
      );
      return Promise.resolve({ ok: true, value: sorted });
    },
    readText(id, readOptions) {
      if (!open) return Promise.resolve(fail('no-project'));
      const path = pathOf(id);
      if (!(path in files))
        return Promise.resolve(fail(isDir(path) ? 'is-directory' : 'not-found'));
      if (options.binary?.includes(path)) return Promise.resolve(fail('not-text'));
      if (files[path].length > (readOptions?.maxBytes ?? Infinity)) {
        return Promise.resolve(fail('too-large'));
      }
      return Promise.resolve({ ok: true, value: { text: files[path], mediaType: 'text/plain' } });
    },
  };
  const access: SourceAccess = {
    source,
    files: {
      projectRoot: () => (open ? ROOT : null),
      resolve: (dir, ...segments) => `${dir}${dir === ROOT ? '' : '/'}${segments.join('/')}`,
    },
  };
  return { access, lists };
}

const PROJECT = {
  'package.json': '{"name":"demo"}',
  'notes/brief.md': '# Brief',
  'src/forms/credit/schema.json': '{}',
  'src/forms/credit/validation.ts': 'export {};',
  '.env': 'SECRET=1',
  'node_modules/lib/index.js': 'x',
};

describe('адреса source:', () => {
  it('путь от корня проекта туда и обратно', () => {
    expect(uriOfPath('notes/brief.md')).toBe('source:notes/brief.md');
    expect(pathOfUri('source:notes/brief.md')).toBe('notes/brief.md');
    expect(pathOfUri('source:')).toBe('');
    expect(pathOfUri('source:./notes/')).toBe('notes');
  });

  it('за корень, абсолютный путь, буква диска и чужая схема — не путь', () => {
    expect(pathOfUri('source:../etc/passwd')).toBeNull();
    expect(pathOfUri('source:/etc/passwd')).toBeNull();
    expect(pathOfUri('source:C:/x')).toBeNull();
    expect(pathOfUri('kit:notes')).toBeNull();
    expect(normalizeSourcePath('a//b')).toBeNull();
  });

  it('секреты и служебная история модели не показываются', () => {
    expect(deniedReason('.env')).not.toBeNull();
    expect(deniedReason('config/.env.local')).not.toBeNull();
    expect(deniedReason('.git/config')).not.toBeNull();
    expect(deniedReason('src/env.ts')).toBeNull();
  });

  it('строка каталога укладывается в предел затравки', () => {
    expect(SOURCE_DESCRIBE.length).toBeLessThanOrEqual(200);
    expect(SOURCE_DESCRIBE).not.toContain('\n');
  });
});

describe('чтение source:', () => {
  it('файл — его сохранённый текст', async () => {
    const { access } = fakeSource(PROJECT);
    expect(await readSource(access, 'source:notes/brief.md', signal)).toEqual({
      ok: true,
      text: '# Brief',
      mediaType: 'text/plain',
    });
  });

  it('каталог — его записи, каталоги со слэшем', async () => {
    const { access } = fakeSource(PROJECT);
    const read = await readSource(access, 'source:src/forms/credit', signal);
    expect(read).toEqual({
      ok: true,
      text: 'schema.json\nvalidation.ts',
      mediaType: 'inode/directory',
    });
    const root = await readSource(access, 'source:', signal);
    expect(root.ok && root.text.split('\n')).toEqual([
      'node_modules/',
      'notes/',
      'src/',
      '.env',
      'package.json',
    ]);
  });

  it('нет файла — NOT_FOUND с соседями ближайшего существующего каталога', async () => {
    const { access } = fakeSource(PROJECT);
    const read = await readSource(access, 'source:src/forms/credit/validaton.ts', signal);
    expect(!read.ok && read.error.code).toBe('NOT_FOUND');
    expect(!read.ok && read.error.suggestions?.[0]).toBe('src/forms/credit/validation.ts');
  });

  it('секрет, двоичный, проекта нет — свои коды', async () => {
    const binary = fakeSource({ ...PROJECT, 'logo.png': 'png' }, { binary: ['logo.png'] });
    expect(await readSource(binary.access, 'source:.env', signal)).toMatchObject({
      ok: false,
      error: { code: 'REFUSED' },
    });
    expect(await readSource(binary.access, 'source:logo.png', signal)).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED' },
    });
    const closed = fakeSource(PROJECT, { open: false });
    expect(await readSource(closed.access, 'source:package.json', signal)).toMatchObject({
      ok: false,
      error: { code: 'UNAVAILABLE' },
    });
  });

  it('провайдер — схема source и чтение тем же путём', async () => {
    const { access } = fakeSource(PROJECT);
    const provider = sourceResourceProvider(access, createSourceIndex({ access }));
    expect(provider.scheme).toBe('source');
    expect(await provider.read('source:package.json', signal)).toMatchObject({ ok: true });
  });
});

describe('поиск для пикера', () => {
  it('находит по началу имени раньше, чем по пути; зависимости и секреты не индексирует', async () => {
    const { access } = fakeSource({
      ...PROJECT,
      'docs/credit-notes.md': '#',
    });
    const index = createSourceIndex({ access });
    const found = await index.search('credit', signal);
    expect(found.map((entry) => entry.uri)).toEqual([
      'source:docs/credit-notes.md',
      'source:src/forms/credit/schema.json',
      'source:src/forms/credit/validation.ts',
    ]);
    expect(found[1]).toEqual({
      uri: 'source:src/forms/credit/schema.json',
      name: 'schema.json',
      description: 'src/forms/credit',
    });
    const all = await index.search('', signal);
    expect(all.map((entry) => entry.name)).not.toContain('.env');
    expect(all.map((entry) => entry.name)).not.toContain('index.js');
  });

  it('обходит проект один раз, пока индекс свеж, и заново — после записи или срока', async () => {
    let clock = 0;
    const listeners: (() => void)[] = [];
    const { access, lists } = fakeSource(PROJECT);
    const index = createSourceIndex({
      access,
      now: () => clock,
      ttlMs: 1000,
      changes: {
        onDidChange: (cb): Disposable => {
          listeners.push(() => cb([]));
          return { dispose: () => {} };
        },
      },
    });
    await index.search('a', signal);
    const walked = lists.mock.calls.length;
    await index.search('b', signal);
    expect(lists.mock.calls.length).toBe(walked);

    listeners[0]();
    await index.search('c', signal);
    expect(lists.mock.calls.length).toBe(walked * 2);

    clock = 2000;
    await index.search('d', signal);
    expect(lists.mock.calls.length).toBe(walked * 3);
  });
});

describe('list_source', () => {
  const run = async (access: SourceAccess, params: { path?: string; depth?: number }) =>
    listSourceTool(access).run(params, {
      signal,
      write: () => Promise.reject(new Error('не нужно')),
    });

  it('имя годно для ассистента, инструмент только читает', () => {
    const { access } = fakeSource(PROJECT);
    const tool = listSourceTool(access);
    expect(isAssistantToolName(tool.name)).toBe(true);
    expect(tool.readOnly).toBe(true);
  });

  it('дерево в глубину; зависимости показаны, но не раскрыты; секреты скрыты', async () => {
    const { access } = fakeSource(PROJECT);
    // Три уровня: `credit/` на третьем показан, но не раскрыт.
    expect(await run(access, { depth: 3 })).toBe(
      [
        'source: — 7 entries',
        'node_modules/',
        'notes/',
        '  brief.md',
        'src/',
        '  forms/',
        '    credit/',
        'package.json',
      ].join('\n')
    );
  });

  it('каталога нет — NOT_FOUND, путь за корнем — REFUSED', async () => {
    const { access } = fakeSource(PROJECT);
    expect(await run(access, { path: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(await run(access, { path: '../up' })).toMatchObject({
      ok: false,
      error: { code: 'REFUSED' },
    });
  });
});

describe('пункт «Прикрепить к ассистенту»', () => {
  it('только над файлом; адрес — source: по пути записи', () => {
    const item = attachMenuItem();
    const file = {
      kind: 'resource',
      ref: { id: 'disk:notes/brief.md', path: 'notes/brief.md', name: 'brief.md', kind: 'file' },
      dir: 'disk:notes',
      selection: [],
    };
    expect(item.kind === 'item' && item.command).toBe(ASSISTANT_ATTACH_COMMAND_ID);
    expect(item.kind === 'item' && item.argsOf?.(file as never)).toEqual({
      uri: 'source:notes/brief.md',
      name: 'brief.md',
    });
    const dir = { ...file, ref: { ...file.ref, kind: 'directory' } };
    expect(item.kind === 'item' && item.when?.({} as never, dir as never)).toBe(false);
  });

  it('появляется вместе с командой ассистента и уходит вместе с ней', () => {
    const contributed: string[] = [];
    let command: CommandContribution | undefined;
    let changed: () => void = () => {};
    const ctx = {
      commands: {
        get: () => command,
        onDidChange: (cb: () => void): Disposable => {
          changed = cb;
          return { dispose: () => {} };
        },
      },
      extensions: {
        contribute: (_point: unknown, _item: unknown, meta?: { id?: string }): Disposable => {
          contributed.push(meta?.id ?? '');
          return {
            dispose: () => {
              contributed.splice(contributed.indexOf(meta?.id ?? ''), 1);
            },
          };
        },
      },
    };

    const off = contributeAttachMenu(ctx as never);
    expect(contributed).toEqual([]);

    command = { id: ASSISTANT_ATTACH_COMMAND_ID, titleKey: 'x', run: () => undefined };
    changed();
    expect(contributed).toEqual(['files.context.attachToAssistant']);

    command = undefined;
    changed();
    expect(contributed).toEqual([]);
    off.dispose();
  });
});
