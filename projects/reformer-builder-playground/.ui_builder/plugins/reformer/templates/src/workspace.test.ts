/**
 * Сборка рабочей области шаблонов из служб контекста. Печатник встроенных шаблонов — у стека
 * (`./stack/workspace.test`).
 *
 * @module plugins/reformer/templates/workspace.test
 */

import { describe, expect, it, vi } from 'vitest';

import {
  DocumentsServiceToken,
  TemplateStackPoint,
  WorkspaceFilesServiceToken,
  type PluginContext,
  type ResourceId,
  type TemplateStack,
} from '@reformer/builder-plugin-api';
import { createFakeTemplateStack } from './testing';
import { templatesWorkspace } from './workspace';

const FORM = 'fs:forms/credit/form.json';

const DIR = 'fs:forms/credit';

/** Службы в объёме раскладки: каждая помнит, о чём её спросили. */
function harness() {
  const calls: string[] = [];
  const ref = { id: FORM, name: 'form.json' };

  const documents = {
    hasProject: () => true,
    activeResource: () => FORM,
    documentOf: (id: ResourceId) => (id === FORM ? { ref } : null),
    writeText: (id: ResourceId, text: string) => {
      calls.push(`documents.writeText(${id}, ${text})`);
      return Promise.resolve();
    },
    open: (id: ResourceId, opts?: { preview?: boolean }) => {
      calls.push(`documents.open(${id}, preview=${String(opts?.preview)})`);
      return Promise.resolve();
    },
    onDidChange: () => ({ dispose: () => {} }),
  };

  const files = {
    parentOf: () => DIR,
    resolve: (dir: ResourceId, ...segments: readonly string[]) => `${dir}/${segments.join('/')}`,
    fromRoot: (anchor: ResourceId, path: string) => `${anchor}|${path}`,
    projectRoot: () => 'fs:',
    exists: () => Promise.resolve(true),
    list: () => Promise.resolve([]),
    readText: () => Promise.resolve('текст'),
    canWrite: () => true,
    refresh: (dir: ResourceId) => {
      calls.push(`files.refresh(${dir})`);
      return Promise.resolve();
    },
  };

  const stacks: { point: string; value: TemplateStack }[] = [];

  const ctx = {
    id: 'templates',
    subscriptions: [],
    i18n: {
      locale: 'ru',
      t: (key: string) => key,
      contribute: () => {},
      onDidChangeLocale: () => ({ dispose: () => {} }),
    },
    extensions: {
      get: (point: { id: string }) => stacks.filter((item) => item.point === point.id),
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

  return {
    ctx,
    calls,
    ref,
    contribute: (value: TemplateStack) => stacks.push({ point: TemplateStackPoint.id, value }),
  };
}

describe('раскладка по службам', () => {
  it('ссылка ресурса берётся у открытого документа', () => {
    const h = harness();

    expect(templatesWorkspace(h.ctx).refOf(FORM)).toBe(h.ref);
    expect(templatesWorkspace(h.ctx).refOf('fs:нет.json')).toBeNull();
  });

  it('запись идёт ОДНОЙ дверью — службой документов', () => {
    const h = harness();

    void templatesWorkspace(h.ctx).writeText(FORM, 'новый');

    expect(h.calls).toContain(`documents.writeText(${FORM}, новый)`);
  });

  it('после записи каталог перечитывается: иначе форма не появится в дереве', async () => {
    // Дерево читает уровни лениво и помнит прочитанное; без этого хода «форма создана»
    // выглядит как несделанная работа.
    const h = harness();

    await templatesWorkspace(h.ctx).invalidate?.(DIR);

    expect(h.calls).toContain(`files.refresh(${DIR})`);
  });

  it('открытие ресурса — закреплённой вкладкой', () => {
    const h = harness();

    templatesWorkspace(h.ctx).openResource?.(FORM);

    expect(h.calls).toContain(`documents.open(${FORM}, preview=false)`);
  });

  it('названная дыра проходит насквозь: сохранение остаётся у композиции', async () => {
    const save = vi.fn(() => Promise.resolve(true));
    const h = harness();

    await expect(templatesWorkspace(h.ctx, { save }).save?.([FORM])).resolves.toBe(true);
    expect(save).toHaveBeenCalledWith([FORM]);
  });

  it('локального хранилища и удаления нет: обещать их нечем', () => {
    // Постоянного хранилища у плагинов пока нет, а удаление ресурса рабочая область
    // не умеет вовсе. Пустое место честнее памяти сессии, выдаваемой за сохранённое.
    const w = templatesWorkspace(harness().ctx);

    expect(w.local).toBeUndefined();
    expect(w.remove).toBeUndefined();
  });
});

describe('стеки шаблонов', () => {
  it('читаются из точки на каждый вопрос: стек вправе подняться позже хозяина', () => {
    const h = harness();
    const workspace = templatesWorkspace(h.ctx);
    expect(workspace.stacks()).toEqual([]);

    const stack = createFakeTemplateStack();
    h.contribute(stack);

    expect(workspace.stacks()).toEqual([stack]);
  });
});
