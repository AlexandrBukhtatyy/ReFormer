/**
 * Служба документов — против НАСТОЯЩЕГО держателя проекта над двойниками хранилищ.
 *
 * Проверяется шов, а не рабочая область: служба обязана отдавать тот же документ, что
 * держат вкладки, доносить пометку происхождения до рабочей области и сообщать о смене
 * проекта в обе стороны. Каждое из трёх ломается молча — тесты плагина проверяют плагин,
 * а компилятор потерю третьего аргумента не ловит (см. `../integration/editor-hosts.test`).
 *
 * @module shell/boot/ports/documents.test
 */

import { describe, expect, it } from 'vitest';

import { createDiagnosticsService } from '@/shell/platform/services/diagnostics/service';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import { createMemorySource } from '@/shell/platform/source/memory';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import type { Source } from '@/shell/platform/source/types';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { DocumentModelPoint } from '@/shell/platform/workspace/model/provider';
import { createLinesProvider } from '@/shell/platform/workspace/model/testing';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createProjectHost } from '@/shell/boot/project/project';
import { createDocumentsService } from './documents';

let seq = 0;

/** Приложение в объёме службы: настоящий держатель проекта над памятью вместо IndexedDB и OPFS. */
function harness() {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-documents-${seq}` });
  const opfs = createMemoryOpfs();
  const sources = createSourceRegistry();
  // Модельный документ нужен ровно одному вопросу — `flush`. Провайдер строк из платформенных
  // двойников надстраивает модель над `.lines`; остальные файлы остаются текстовыми, и на них
  // проверяется, что `flush` над ними безвреден.
  const extensions = createExtensionRegistry();
  extensions.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());
  /** Кто «в фокусе»: тот самый ответ, по которому платформа откладывает перерисовку буфера. */
  const focused = new Set<ResourceId>();

  const sourceId = `mem${seq}`;
  const source: Source = {
    ...createMemorySource(
      { 'readme.md': '# привет', 'notes.txt': 'заметка', 'notes.lines': 'n1 alpha' },
      { id: sourceId, label: `src-${seq}`, writable: true }
    ),
    descriptor: { kind: 'fs', handleKey: sourceId },
  };
  sources.register({ kind: 'fs', restore: () => Promise.resolve(source) });

  const project = createProjectHost({
    sources,
    // Хранилище хэндлов держателю нужно только для выбора каталога; здесь проект поднимается
    // восстановлением по дескриптору, и до хэндлов дело не доходит.
    handles: { keys: () => Promise.resolve([]) } as never,
    meta,
    whenContext: createWhenContextStore(),
    extensions,
    isTextEditorFocused: (id) => focused.has(id),
    diagnostics: createDiagnosticsService(),
    supported: () => true,
    createFiles: (workspaceId) =>
      createWorkspaceFileStore(workspaceId, {
        directory: opfs.directory,
        lock: (_name, body) => body(),
      }),
  });

  const documents = createDocumentsService({ project });

  return {
    project,
    documents,
    focused,
    id: (path: string): ResourceId => `${sourceId}:${path}`,
    open: async (path: string) => {
      await meta.putWorkspace({
        id: sourceId,
        sourceId,
        descriptor: { ...source.descriptor },
        createdAt: 1,
        lastOpenedAt: 1,
      });
      await project.restoreLast();
      const session = project.get();
      if (session === null) throw new Error('проект не открылся');
      await session.documents.open(`${sourceId}:${path}`);
      return session;
    },
    dispose: () => {
      documents.dispose();
      project.dispose();
      meta.dispose();
    },
  };
}

describe('служба документов: без проекта', () => {
  it('отвечает как порты — `null`, `false` и отказом записи, а не падением', async () => {
    const h = harness();
    const id = h.id('readme.md');

    expect(h.documents.hasProject()).toBe(false);
    expect(h.documents.activeResource()).toBeNull();
    expect(h.documents.documentOf(id)).toBeNull();
    // Отказ, а не тишина: правка, ушедшая в никуда, выглядела бы сохранённой.
    await expect(h.documents.writeText(id, 'x')).rejects.toThrow(/проект не открыт/);
    await expect(h.documents.open(id)).rejects.toThrow(/проект не открыт/);
    // Открытых документов нет — пусто, а не `null`: у этого вопроса есть честный ответ
    // и без проекта, и на нём держится правило жизни состояний превью.
    expect(h.documents.openDocuments()).toEqual([]);
    h.dispose();
  });

  it('каталог ресурса отвечает и без проекта: он выводится из самого адреса', () => {
    // Путевая арифметика — служба, а не разрешение плагину разбирать адрес: иначе плагин
    // начнёт различать источники, у которых внутри путь, и те, у которых внутри ответ сервера.
    const h = harness();

    expect(h.documents.parentOf(h.id('forms/credit/form.json'))).toBe(h.id('forms/credit'));
    // Из корня источника подниматься некуда — это был бы выход за его пределы.
    expect(h.documents.parentOf(h.id('readme.md'))).toBe(h.id(''));
    h.dispose();
  });
});

describe('служба документов: с открытым проектом', () => {
  it('отдаёт ТОТ ЖЕ документ, что держат вкладки, и активный ресурс', async () => {
    const h = harness();
    const session = await h.open('readme.md');
    const id = h.id('readme.md');

    expect(h.documents.hasProject()).toBe(true);
    expect(h.documents.activeResource()).toBe(id);
    const document = h.documents.documentOf(id);
    expect(document).not.toBeNull();
    // Та же ссылка, а не копия: подписка на `onDidChangeContent` у копии молчала бы.
    expect(document).toBe(session.documents.documentOf(id));
    expect(document?.getText()).toBe(session.documents.documentOf(id)?.getText());
    expect(document?.getText()).toBe('# привет');
    h.dispose();
  });

  it('отдаёт ВСЕ открытые вкладки, а не только активную', async () => {
    // Активная вкладка и набор открытых — разные вопросы: состояние превью живёт, пока открыт
    // хоть один файл каталога формы, а активным в этот миг бывает файл из другого места.
    const h = harness();
    const session = await h.open('readme.md');
    // Вторая вкладка ЗАКРЕПЛЁННАЯ: временная заместила бы первую — ровно тот щелчок в дереве,
    // ради которого состояние превью привязано к каталогу, а не к вкладке.
    await session.documents.open(h.id('notes.txt'), { preview: false });

    expect([...h.documents.openDocuments()].sort()).toEqual(
      [h.id('readme.md'), h.id('notes.txt')].sort()
    );
    expect(h.documents.activeResource()).toBe(h.id('notes.txt'));
    h.dispose();
  });

  it('запись доходит до буфера открытого документа', async () => {
    const h = harness();
    const session = await h.open('readme.md');
    const id = h.id('readme.md');

    await h.documents.writeText(id, '# пока');

    expect(session.documents.documentOf(id)?.getText()).toBe('# пока');
    expect(h.documents.documentOf(id)?.isDirty()).toBe(true);
    h.dispose();
  });

  it('`open` открывает вкладку и делает её активной; опции доходят до вкладок', async () => {
    const h = harness();
    await h.open('readme.md');
    const notes = h.id('notes.txt');

    await h.documents.open(notes, { preview: false });

    expect(h.documents.activeResource()).toBe(notes);
    expect(h.documents.documentOf(notes)?.getText()).toBe('заметка');
    const tab = h.project
      .get()
      ?.documents.get()
      .tabs.find((t) => t.ref.id === notes);
    expect(tab?.preview).toBe(false);
    h.dispose();
  });
});

describe('служба документов: пометка происхождения доходит до рабочей области', () => {
  it('третий аргумент пробрасывается, а не глотается', () => {
    // Этот класс ошибки компилятор НЕ ловит: реализация с меньшим числом параметров
    // присваивается функции с бо́льшим. Поймать потерю может только проверка самого шва.
    const calls: Array<{ id: string; text: string; mark?: unknown }> = [];
    const documents = createDocumentsService({
      project: {
        get: () => ({
          workspace: {
            writeText: (id: string, text: string, mark?: unknown) => {
              calls.push({ id, text, mark });
              return Promise.resolve();
            },
          },
          documents: { subscribe: () => ({ dispose: () => {} }) },
        }),
        subscribe: () => ({ dispose: () => {} }),
      } as never,
    });

    void documents.writeText('mem:form.json' as ResourceId, '{}', {
      origin: 'agent',
      txId: 'turn-1',
    });

    expect(calls).toEqual([
      { id: 'mem:form.json', text: '{}', mark: { origin: 'agent', txId: 'turn-1' } },
    ]);
    documents.dispose();
  });

  it('без пометки зовёт с тем же числом аргументов: умолчание решает рабочая область', () => {
    const marks: Array<unknown> = [];
    const documents = createDocumentsService({
      project: {
        get: () => ({
          workspace: {
            writeText: (_id: string, _text: string, mark?: unknown) => {
              marks.push(mark);
              return Promise.resolve();
            },
          },
          documents: { subscribe: () => ({ dispose: () => {} }) },
        }),
        subscribe: () => ({ dispose: () => {} }),
      } as never,
    });

    void documents.writeText('mem:a.json' as ResourceId, '{}');

    expect(marks).toEqual([undefined]);
    documents.dispose();
  });
});

describe('служба документов: отложенная перерисовка буфера', () => {
  it('`flush` догоняет буфер по модели, когда фокус ушёл из редактора', async () => {
    // Вторая половина контракта редактора из SDK. Пока фокус жив, платформа откладывает
    // перерисовку буфера по модели — иначе ход ассистента затирал бы набранное на полуслове.
    // Фокус ушёл — откладывать больше не из-за чего, и редактор обязан сказать об этом сам.
    const h = harness();
    const session = await h.open('notes.lines');
    const id = h.id('notes.lines');
    const handle = session.models.handleOf(id);
    if (handle === null) throw new Error('ожидалась ручка модели');

    h.focused.add(id);
    handle.apply({ type: 'set-text', target: 'n1', params: { text: 'ALPHA' } });
    await Promise.resolve();
    expect(handle.hasPendingSync()).toBe(true);

    h.focused.delete(id);
    await h.documents.flush(id);

    expect(session.documents.documentOf(id)?.getText()).toBe('n1 ALPHA');
    h.dispose();
  });

  it('у текстового документа откладывать нечего: вызов безвреден', async () => {
    const h = harness();
    await h.open('readme.md');

    await expect(Promise.resolve(h.documents.flush(h.id('readme.md')))).resolves.toBeUndefined();
    h.dispose();
  });
});

describe('служба документов: уведомление о смене', () => {
  it('срабатывает на открытие проекта, на вкладки и на закрытие проекта', async () => {
    const h = harness();
    let seen = 0;
    const off = h.documents.onDidChange(() => (seen += 1));

    await h.open('readme.md');
    const afterOpen = seen;
    expect(afterOpen).toBeGreaterThan(0);

    // Подписка на вкладки перевешена на новую сессию: открытие второй вкладки доходит.
    await h.documents.open(h.id('notes.txt'));
    const afterTab = seen;
    expect(afterTab).toBeGreaterThan(afterOpen);

    h.project.close();
    expect(seen).toBeGreaterThan(afterTab);
    expect(h.documents.hasProject()).toBe(false);

    // Снятая подписка молчит — и при следующем открытии тоже.
    off.dispose();
    const afterOff = seen;
    await h.open('readme.md');
    expect(seen).toBe(afterOff);
    h.dispose();
  });

  it('`dispose` службы снимает обе подписки: на держателя и на вкладки', async () => {
    const h = harness();
    const session = await h.open('readme.md');
    let seen = 0;
    h.documents.onDidChange(() => (seen += 1));

    h.documents.dispose();

    await session.documents.open(h.id('notes.txt'));
    h.project.close();
    expect(seen).toBe(0);
    h.dispose();
  });
});
