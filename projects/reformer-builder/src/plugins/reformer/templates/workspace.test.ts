/**
 * Сборка рабочей области шаблонов и печатник, взятый у СОСЕДНЕГО плагина.
 *
 * Главное здесь — второе. Печатает встроенный шаблон генерация кода, и до сих пор переходник
 * жил в композиции: она тянула кодоген динамическим импортом мимо состава, поэтому профиль
 * без генерации всё равно печатал бы её кодом. Теперь это возможность, и у неё три состояния,
 * каждое из которых ломается молча: её нет (печатать нечем), она появилась ПОЗЖЕ активации
 * шаблонов (оба плагина ленивые, порядок незначим), она есть.
 *
 * @module plugins/reformer/templates/workspace.test
 */

import { describe, expect, it, vi } from 'vitest';

import {
  DocumentsServiceToken,
  WorkspaceFilesServiceToken,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import {
  hasPrinter,
  ModulePrinterCapability,
  templatesPrinter,
  templatesWorkspace,
} from './workspace';

const FORM = 'fs:forms/credit/form.json';

/** Схема в объёме подписи печатника: её содержимое здесь ни на что не влияет. */
const SCHEMA = { version: '1.0', root: { component: '$html(div)' } } as unknown as Parameters<
  ReturnType<typeof templatesPrinter>
>[0];
const DIR = 'fs:forms/credit';

/** Службы в объёме раскладки: каждая помнит, о чём её спросили. */
function harness(options: { readonly printer?: boolean } = {}) {
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

  const print = vi.fn(() => Promise.resolve([{ path: 'model.ts', content: 'export {};' }]));
  let printer: { print: typeof print } | undefined =
    options.printer === false ? undefined : { print };

  const ctx = {
    id: 'templates',
    subscriptions: [],
    i18n: {
      locale: 'ru',
      t: (key: string) => key,
      contribute: () => {},
      onDidChangeLocale: () => ({ dispose: () => {} }),
    },
    services: {
      get: (token: { id: string }) =>
        token.id === ModulePrinterCapability.id ? printer : undefined,
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
    print,
    ref,
    raise: () => {
      printer = { print };
    },
  };
}

describe('печатник берётся возможностью соседа', () => {
  it('печать уходит в возможность, а не в собственную копию конвейера', async () => {
    const h = harness();

    const files = await templatesPrinter(h.ctx)(SCHEMA, 'credit');

    expect(files.map((file) => file.path)).toEqual(['model.ts']);
    expect(h.print).toHaveBeenCalledTimes(1);
  });

  it('без возможности печатать нечем — пустой список, а не падение', async () => {
    // Профиль без генерации кода законен: раздел встроенных шаблонов просто не показывается.
    const h = harness({ printer: false });

    await expect(templatesPrinter(h.ctx)(SCHEMA, 'credit')).resolves.toEqual([]);
    expect(hasPrinter(h.ctx)).toBe(false);
  });

  it('возможность, появившаяся ПОЗЖЕ, доходит до раздела: оба плагина ленивые', async () => {
    // Ответ, снятый при активации, оставил бы встроенные шаблоны недоступными навсегда —
    // порядок активации плагинов объявлен незначимым.
    const h = harness({ printer: false });
    expect(hasPrinter(h.ctx)).toBe(false);

    h.raise();

    expect(hasPrinter(h.ctx)).toBe(true);
    await expect(templatesPrinter(h.ctx)(SCHEMA, 'credit')).resolves.toHaveLength(1);
  });
});

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
