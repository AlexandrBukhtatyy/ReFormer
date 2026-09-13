/**
 * Сборка рабочей области ассистента из возможностей.
 *
 * Главное здесь — пометка происхождения. Этот класс ошибки компилятор НЕ ловит: реализация
 * с меньшим числом параметров присваивается функции с бо́льшим, и потерянный третий аргумент
 * означает, что ход ассистента лёг в журнал как правка человека — то есть аудит потерял
 * ровно то, ради чего он есть. Раньше шов проверялся у порта композиции
 * (`shell/boot/integration/editor-hosts`); порта больше нет, и проверка переехала сюда.
 *
 * @module plugins/ai/workspace.test
 */

import { describe, expect, it } from 'vitest';

import type { CatalogEntry } from '@/lib/catalog/types';
import {
  DocumentsServiceToken,
  WorkspaceFilesServiceToken,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { aiWorkspace, KitCapability } from './workspace';

const FORM = 'fs:forms/credit/form.json';

/** Службы в объёме раскладки: каждая помнит, о чём её спросили. */
function harness(options: { readonly kit?: boolean; readonly project?: boolean } = {}) {
  const writes: { id: string; text: string; mark?: unknown }[] = [];
  const reads: string[] = [];
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
    fromRoot: (anchor: ResourceId, path: string) => `${anchor}${path}`,
    projectRoot: () => (options.project === false ? null : 'fs:'),
    exists: () => Promise.resolve(true),
    list: () => Promise.resolve([]),
    readText: (id: ResourceId) => {
      reads.push(id);
      return Promise.resolve(id.endsWith('llms.txt') ? 'корпус' : null);
    },
    canWrite: () => true,
    refresh: () => Promise.resolve(),
  };

  const catalog: CatalogEntry[] = [];
  const kits = { catalog: () => catalog, onDidChange: () => ({ dispose: () => {} }) };

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
      get: (token: { id: string }) =>
        token.id === KitCapability.id && options.kit !== false ? kits : undefined,
      require: (token: { id: string }) => {
        if (token.id === DocumentsServiceToken.id) return documents;
        if (token.id === WorkspaceFilesServiceToken.id) return files;
        throw new Error(`сервис «${token.id}» не зарегистрирован`);
      },
    },
  } as unknown as PluginContext;

  return { ctx, writes, reads, catalog, document };
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

  it('каталог читается на КАЖДЫЙ вызов: кит переключают и поднимают позже', () => {
    const h = harness();
    const w = aiWorkspace(h.ctx);

    expect(w.catalog()).toEqual([]);
    h.catalog.push({ name: 'Text' } as unknown as CatalogEntry);

    expect(w.catalog().map((entry) => entry.name)).toEqual(['Text']);
  });

  it('без плагина китов каталог пуст, а не отсутствует', () => {
    expect(aiWorkspace(harness({ kit: false }).ctx).catalog()).toEqual([]);
  });

  it('перевод моста — обычная функция: замечание к ходу пишется вне React', () => {
    const h = harness();

    expect(aiWorkspace(h.ctx).translate('turn.skipped', { file: 'form.json' })).toBe(
      'turn.skipped:{"file":"form.json"}'
    );
  });
});

describe('корпус знаний читается из проекта', () => {
  it('путь считается ОТ КОРНЯ проекта, а не от активного документа', async () => {
    const h = harness();

    const files = aiWorkspace(h.ctx).projectFiles?.();
    await expect(files?.read('node_modules/@reformer/core/llms.txt')).resolves.toEqual({
      text: 'корпус',
    });
    expect(h.reads).toEqual(['fs:node_modules/@reformer/core/llms.txt']);
  });

  it('отсутствие файла — ОТКАЗ, а не пустая строка', async () => {
    // Покалеченный llms.txt нельзя принимать за «пакета нет»: тогда вместо версий проекта
    // ассистент молча возьмёт вшитый корпус и будет советовать не то, что стоит у человека.
    const h = harness();

    const files = aiWorkspace(h.ctx).projectFiles?.();
    await expect(files?.read('node_modules/@reformer/core/package.json')).rejects.toThrow(
      /не прочитан/
    );
  });

  it('без проекта читать нечего, и корпус остаётся вшитым', () => {
    expect(aiWorkspace(harness({ project: false }).ctx).projectFiles?.()).toBeUndefined();
  });
});
