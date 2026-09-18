/**
 * Сборка рабочей области генерации из возможностей — шов, которого раньше не было.
 *
 * Проверяется РАСКЛАДКА: какой член к какой службе обращается. Ломается она молча и в самую
 * дорогую сторону — запись мимо единственной двери не попадёт в журнал как чужая, а каталог,
 * прочитанный один раз на активации, останется пустым навсегда, — и ни то, ни другое
 * не выражается ошибкой.
 *
 * Службы здесь двойники, и это осознанно: их собственное поведение проверено у портов
 * (`shell/boot/ports/documents`, `ports/workspace-files`), а здесь важно, КУДА уходит вызов.
 *
 * @module plugins/codegen/workspace.test
 */

import { describe, expect, it, vi } from 'vitest';

import type { CatalogEntry } from '@reformer/builder-stack-reformer/catalog';
import type { KitDescriptor } from '@reformer/builder-stack-reformer/kits';
import {
  DocumentsServiceToken,
  WorkspaceFilesServiceToken,
  WorkspaceSaveServiceToken,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { codegenWorkspace, KitCapability } from './workspace';

const FORM = 'fs:forms/credit/form.json';

/** Службы в объёме раскладки: каждая помнит, о чём её спросили. */
function harness(
  options: {
    readonly kit?: boolean;
    readonly project?: boolean;
    /** Привилегированная служба сохранения; без неё — право не подтверждено. */
    readonly save?: (ids: readonly ResourceId[]) => Promise<boolean>;
  } = {}
) {
  const calls: string[] = [];
  const document = { id: FORM, kind: 'model' as const };

  const documents = {
    hasProject: () => options.project !== false,
    activeResource: () => FORM,
    documentOf: (id: ResourceId) => {
      calls.push(`documents.documentOf(${id})`);
      return id === FORM ? document : null;
    },
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
    parentOf: (id: ResourceId) => {
      calls.push(`files.parentOf(${id})`);
      return 'fs:forms/credit';
    },
    resolve: (dir: ResourceId, ...segments: readonly string[]) => `${dir}/${segments.join('/')}`,
    fromRoot: (anchor: ResourceId, path: string) => `${anchor}|${path}`,
    projectRoot: () => 'fs:',
    exists: (id: ResourceId) => {
      calls.push(`files.exists(${id})`);
      return Promise.resolve(true);
    },
    list: () => Promise.resolve([]),
    readText: (id: ResourceId) => {
      calls.push(`files.readText(${id})`);
      return Promise.resolve('текст');
    },
    canWrite: () => true,
  };

  const catalog: CatalogEntry[] = [];
  const descriptor = { id: 'kit-a' } as unknown as KitDescriptor;
  const kits = {
    catalog: () => catalog,
    descriptor: () => descriptor,
    onDidChange: () => ({ dispose: () => {} }),
  };

  const ctx = {
    id: 'codegen',
    subscriptions: [],
    i18n: {
      locale: 'ru',
      t: (key: string) => key,
      contribute: () => {},
      onDidChangeLocale: () => ({ dispose: () => {} }),
    },
    services: {
      get: (token: { id: string }) => {
        if (token.id === KitCapability.id) return options.kit !== false ? kits : undefined;
        if (token.id === WorkspaceSaveServiceToken.id) {
          return options.save === undefined ? undefined : { save: options.save };
        }
        return undefined;
      },
      require: (token: { id: string }) => {
        if (token.id === DocumentsServiceToken.id) return documents;
        if (token.id === WorkspaceFilesServiceToken.id) return files;
        throw new Error(`сервис «${token.id}» не зарегистрирован`);
      },
    },
  } as unknown as PluginContext;

  return { ctx, calls, catalog, document };
}

describe('раскладка по службам', () => {
  it('документ берётся у службы документов, а не у записей рабочей области', () => {
    const h = harness();

    expect(codegenWorkspace(h.ctx).documentOf(FORM)).toBe(h.document);
    expect(h.calls).toContain(`documents.documentOf(${FORM})`);
  });

  it('запись идёт ОДНОЙ дверью — службой документов', () => {
    // Пометка происхождения живёт у той двери, и второй путь означал бы записи, не попавшие
    // в журнал как чужие. Поэтому в службе записей рабочей области writeText нет вовсе.
    const h = harness();

    void codegenWorkspace(h.ctx).writeText(FORM, 'новый');

    expect(h.calls).toContain(`documents.writeText(${FORM}, новый)`);
  });

  it('открытие ресурса — закреплённой вкладкой: сгенерированный файл пришли смотреть', () => {
    const h = harness();

    codegenWorkspace(h.ctx).openResource?.(FORM);

    expect(h.calls).toContain(`documents.open(${FORM}, preview=false)`);
  });

  it('существование, чтение и адресация — у записей рабочей области', async () => {
    const h = harness();
    const w = codegenWorkspace(h.ctx);

    await expect(w.exists(FORM)).resolves.toBe(true);
    await expect(w.readText(FORM)).resolves.toBe('текст');
    expect(w.parentOf(FORM)).toBe('fs:forms/credit');
    expect(w.resolve('fs:forms/credit', 'registry.ts')).toBe('fs:forms/credit/registry.ts');
    expect(w.resolveFromRoot?.(FORM, 'shared')).toBe(`${FORM}|shared`);
    expect(w.projectRoot?.()).toBe('fs:');
    expect(h.calls).toEqual(
      expect.arrayContaining([`files.exists(${FORM})`, `files.readText(${FORM})`])
    );
  });
});

describe('кит спрашивается в момент вопроса', () => {
  it('каталог читается НА КАЖДЫЙ вызов: кит переключают и поднимают позже', () => {
    const h = harness();
    const w = codegenWorkspace(h.ctx);

    expect(w.catalog()).toEqual([]);
    h.catalog.push({ name: 'Text' } as unknown as CatalogEntry);

    expect(w.catalog().map((entry) => entry.name)).toEqual(['Text']);
  });

  it('без плагина китов: пустой каталог, дескриптора нет, подписка безвредна', () => {
    // Порядок активации незначим, а состав без китов законен — деградация, а не отказ.
    const h = harness({ kit: false });
    const w = codegenWorkspace(h.ctx);

    expect(w.catalog()).toEqual([]);
    expect(w.kit()).toBeNull();
    expect(() => w.onDidChangeKit(() => {}).dispose()).not.toThrow();
  });
});

describe('права и дыры', () => {
  it('без проекта источника нет, и право на запись не выдумывается', () => {
    const h = harness({ project: false });

    expect(codegenWorkspace(h.ctx).sourceOf(FORM)).toBeNull();
  });

  it('с проектом право берётся у ИСТОЧНИКА, а не у билдера', () => {
    const h = harness();

    expect(codegenWorkspace(h.ctx).sourceOf(FORM)).toEqual({ write: true });
  });

  it('сохранение берётся у привилегированной службы, а не у композиции', async () => {
    const save = vi.fn(() => Promise.resolve(true));
    const h = harness({ save });

    await expect(codegenWorkspace(h.ctx).save?.([FORM])).resolves.toBe(true);
    expect(save).toHaveBeenCalledWith([FORM]);
  });

  it('без права сохранения плагин работает, а сохранение отвечает «не сохранил»', async () => {
    // Право не подтверждено — службы для этого плагина не существует (`get` → undefined).
    // Это названная деградация, а не поломка: файлы остаются в рабочей копии.
    const h = harness();

    await expect(codegenWorkspace(h.ctx).save?.([FORM])).resolves.toBe(false);
  });

  it('без служб рабочей области сборка ОТКАЗЫВАЕТ, а не собирает половину', () => {
    // Это службы самой оболочки: они есть с запуска. Отсутствие означает не «состав без
    // плагина», а поломку сборки приложения, и молчать о ней нельзя.
    const ctx = {
      id: 'codegen',
      services: {
        get: () => undefined,
        require: (token: { id: string }) => {
          throw new Error(`сервис «${token.id}» не зарегистрирован`);
        },
      },
    } as unknown as PluginContext;

    expect(() => codegenWorkspace(ctx)).toThrow(/reformer\.workspace/);
  });
});
