/**
 * Сборка рабочей области ассистента из возможностей.
 *
 * Главное здесь — пометка происхождения. Этот класс ошибки компилятор НЕ ловит: реализация
 * с меньшим числом параметров присваивается функции с бо́льшим, и потерянный третий аргумент
 * означает, что ход ассистента лёг в журнал как правка человека — то есть аудит потерял
 * ровно то, ради чего он есть. Раньше шов проверялся у порта композиции
 * (`shell/boot/integration/editor-hosts`); порта больше нет, и проверка переехала сюда.
 *
 * @module plugins/forms/ai/workspace.test
 */

import { describe, expect, it } from 'vitest';

import {
  DocumentsServiceToken,
  WorkspaceFilesServiceToken,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { aiWorkspace } from './workspace';

const FORM = 'fs:forms/credit/form.json';

/** Службы в объёме раскладки: каждая помнит, о чём её спросили. */
function harness(options: { readonly project?: boolean } = {}) {
  const writes: { id: string; text: string; mark?: unknown }[] = [];
  const document = { ref: { id: FORM }, getText: () => '{}' };

  const documents = {
    hasProject: () => options.project !== false,
    activeResource: () => (options.project === false ? null : FORM),
    documentOf: (id: ResourceId) => (id === FORM ? document : null),
    writeText: (id: ResourceId, text: string, mark?: unknown) => {
      writes.push({ id, text, mark });
      return Promise.resolve();
    },
    open: () => Promise.resolve(),
    onDidChange: () => ({ dispose: () => {} }),
  };

  const files = {
    parentOf: (id: ResourceId) => id,
    resolve: (dir: ResourceId) => dir,
    exists: () => Promise.resolve(true),
    list: () => Promise.resolve([]),
    readText: () => Promise.resolve(null),
    canWrite: () => true,
    refresh: () => Promise.resolve(),
  };

  const ctx = {
    id: 'ai',
    subscriptions: [],
    i18n: {
      locale: 'ru',
      t: (key: string, params?: Record<string, unknown>) =>
        params === undefined ? key : `${key}:${JSON.stringify(params)}`,
      contribute: () => {},
      onDidChangeLocale: () => ({ dispose: () => {} }),
    },
    services: {
      get: () => undefined,
      require: (token: { id: string }) => {
        if (token.id === DocumentsServiceToken.id) return documents;
        if (token.id === WorkspaceFilesServiceToken.id) return files;
        throw new Error(`сервис «${token.id}» не зарегистрирован`);
      },
    },
  } as unknown as PluginContext;

  return { ctx, writes, document };
}

describe('пометка происхождения доходит до рабочей области', () => {
  it('третий аргумент пробрасывается, а не глотается', () => {
    const h = harness();

    void aiWorkspace(h.ctx).writeText(FORM, '{}', { origin: 'agent', txId: 'turn-1' });

    expect(h.writes).toEqual([{ id: FORM, text: '{}', mark: { origin: 'agent', txId: 'turn-1' } }]);
  });

  it('без пометки зовёт с тем же числом аргументов: умолчание решает рабочая область', () => {
    const h = harness();

    void aiWorkspace(h.ctx).writeText(FORM, '{}');

    expect(h.writes.map((write) => write.mark)).toEqual([undefined]);
  });
});

describe('раскладка по службам', () => {
  it('активная вкладка и её документ берутся у службы документов', () => {
    const h = harness();
    const w = aiWorkspace(h.ctx);

    expect(w.activeResource()).toBe(FORM);
    expect(w.documentOf(FORM)).toBe(h.document);
    expect(w.documentOf('fs:нет.json')).toBeNull();
  });

  it('перевод моста — обычная функция: замечание к ходу пишется вне React', () => {
    const h = harness();

    expect(aiWorkspace(h.ctx).translate('turn.skipped', { file: 'form.json' })).toBe(
      'turn.skipped:{"file":"form.json"}'
    );
  });
});

describe('файлы рабочей копии — режим файлов', () => {
  /** Службы, где адрес ресурса — путь: так видно, куда порт поднимается и что читает. */
  function moduleHarness(open: Record<string, string>, onDisk: Record<string, string> = {}) {
    const calls: string[] = [];
    const writes: { id: string; text: string; mark?: unknown }[] = [];
    const documents = {
      activeResource: () => Object.keys(open)[0] ?? null,
      documentOf: (id: ResourceId) =>
        id in open ? { ref: { id, path: id }, getText: () => open[id] } : null,
      writeText: (id: ResourceId, text: string, mark?: unknown) => {
        writes.push({ id, text, mark });
        return Promise.resolve();
      },
      flush: (id: ResourceId) => {
        calls.push(`flush ${id}`);
      },
    };
    const files = {
      parentOf: (id: ResourceId) => id.slice(0, Math.max(0, id.lastIndexOf('/'))),
      resolve: (dir: ResourceId, ...segments: string[]) => [dir, ...segments].join('/'),
      readText: (id: ResourceId) => {
        calls.push(`readText ${id}`);
        return Promise.resolve(onDisk[id] ?? null);
      },
      list: () => Promise.resolve([]),
      exists: () => Promise.resolve(true),
    };
    const ctx = {
      i18n: { t: (key: string) => key },
      services: {
        get: () => undefined,
        require: (token: { id: string }) =>
          token.id === DocumentsServiceToken.id ? documents : files,
      },
    } as unknown as PluginContext;
    return { files: aiWorkspace(ctx).files!, calls, writes };
  }

  it('открытый документ читается из буфера после flush, закрытый — из рабочей копии', async () => {
    const { files, calls } = moduleHarness(
      { 'forms/loan/schema/form.schema.json': 'буфер' },
      { 'forms/loan/validation/form.ts': 'файл' }
    );
    expect(await files.read('forms/loan/schema/form.schema.json')).toBe('буфер');
    expect(await files.read('forms/loan/validation/form.ts')).toBe('файл');
    expect(calls).toEqual([
      'flush forms/loan/schema/form.schema.json',
      'readText forms/loan/validation/form.ts',
    ]);
  });

  it('запись — службой документов, с пометкой хода', () => {
    const { files, writes } = moduleHarness({});
    void files.write('forms/loan/api/index.ts', 'x', { origin: 'agent', txId: 't' });
    expect(writes).toEqual([
      { id: 'forms/loan/api/index.ts', text: 'x', mark: { origin: 'agent', txId: 't' } },
    ]);
  });
});
