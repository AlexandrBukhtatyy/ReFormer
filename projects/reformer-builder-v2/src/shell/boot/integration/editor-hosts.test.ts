/**
 * Тесты двух портов, которым модельный документ отдаётся наружу: Monaco и редактор схемы.
 *
 * Проверяется шов, а не плагины: `flush` обязан доходить до ручки того самого документа,
 * а `modelOf` — отдавать ручку только тому провайдеру, чья модель за ней стоит. Оба ответа
 * стали возможны ровно тогда, когда композиция начала собирать модельные документы;
 * до того один был `undefined`, а второй не существовал.
 *
 * @module shell/boot/integration/editor-hosts.test
 */

import { describe, expect, it } from 'vitest';

import { createDiagnosticsService } from '@/shell/platform/diagnostics/service';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
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
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { createSchemaModelProvider } from '@/plugins/editor-schema/model/provider';
import {
  createFocusRegistry,
  createViewStateRegistry,
  monacoEditorContribution,
} from '@/plugins/editor-monaco';
import { createMonacoHost } from '@/shell/boot/ports/monaco';
import { createProjectHost } from '@/shell/boot/project/project';
import { createSchemaHost } from '@/shell/boot/ports/schema';
import { createAiHost } from '@/shell/boot/ports/ai';
import { KitsServiceToken } from '@/plugins/kits/service';
import type { CatalogEntry } from '@/lib/catalog/types';

let seq = 0;

const SCHEMA_TEXT = JSON.stringify(sampleSchema(), null, 2);

/**
 * Приложение в объёме двух портов: настоящий держатель проекта над двойниками хранилищ,
 * настоящий реестр вкладов с обоими провайдерами модели.
 */
function harness() {
  seq += 1;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-hosts-${seq}` });
  const opfs = createMemoryOpfs();
  const sources = createSourceRegistry();
  const whenContext = createWhenContextStore();
  const extensions = createExtensionRegistry();
  const diagnostics = createDiagnosticsService();
  const services = createServiceRegistry();
  const i18n = createI18nService();
  const focused = new Set<ResourceId>();

  extensions.forPlugin('editor-schema').contribute(DocumentModelPoint, createSchemaModelProvider());
  extensions.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());

  const sourceId = `mem${seq}`;
  const source: Source = {
    ...createMemorySource(
      { 'form.json': SCHEMA_TEXT, 'notes.lines': 'n1 alpha', 'readme.md': '# привет' },
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
    whenContext,
    extensions,
    isTextEditorFocused: (id) => focused.has(id),
    diagnostics,
    supported: () => true,
    createFiles: (workspaceId) =>
      createWorkspaceFileStore(workspaceId, {
        directory: opfs.directory,
        lock: (_name, body) => body(),
      }),
  });

  return {
    project,
    focused,
    services,
    i18n,
    monaco: createMonacoHost({ project, i18n, diagnostics }),
    schema: createSchemaHost({ project, i18n, services }),
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
      project.dispose();
      meta.dispose();
    },
  };
}

describe('порт Monaco', () => {
  it('`flush` выполняет отложенную перерисовку буфера того самого документа', async () => {
    const h = harness();
    const session = await h.open('notes.lines');
    const id = h.id('notes.lines');
    const handle = session.models.handleOf(id);
    if (handle === null) throw new Error('ожидалась ручка модели');

    // Человек печатает в Monaco — перерисовка по модели откладывается.
    h.focused.add(id);
    handle.apply({ type: 'set-text', target: 'n1', params: { text: 'ALPHA' } });
    await Promise.resolve();
    expect(handle.hasPendingSync()).toBe(true);

    // Фокус ушёл: ровно здесь `MonacoEditor` зовёт `host.flush(documentId)`.
    h.focused.delete(id);
    await h.monaco.flush?.(id);

    expect(session.documents.documentOf(id)?.getText()).toBe('n1 ALPHA');
    h.dispose();
  });

  it('`flush` текстового документа безвреден: откладывать нечего', async () => {
    const h = harness();
    await h.open('readme.md');

    await expect(Promise.resolve(h.monaco.flush?.(h.id('readme.md')))).resolves.toBeUndefined();
    h.dispose();
  });
});

describe('порт редактора схемы', () => {
  it('отдаёт ручку документа, модель которого разобрал именно его провайдер', async () => {
    const h = harness();
    const session = await h.open('form.json');

    const handle = h.schema.modelOf(h.id('form.json'));
    expect(handle).not.toBeNull();
    expect(handle?.document.getModel().root).toBeDefined();
    expect(handle).toBe(session.models.handleOf(h.id('form.json')));
    h.dispose();
  });

  it('молчит про чужую модель: приведение к своей было бы ложью о типе', async () => {
    const h = harness();
    await h.open('notes.lines');

    // Ручка есть — но модель за ней чужого формата, и отдать её редактору схемы значило бы
    // выдать `LinesModel` за `JsonFormSchema` на первом же обращении к `root`.
    expect(h.schema.modelOf(h.id('notes.lines'))).toBeNull();
    h.dispose();
  });

  it('молчит про текстовый документ и про закрытый проект', async () => {
    const h = harness();
    await h.open('readme.md');
    expect(h.schema.modelOf(h.id('readme.md'))).toBeNull();

    h.project.close();
    expect(h.schema.modelOf(h.id('form.json'))).toBeNull();
    h.dispose();
  });
});

describe('порт редактора схемы: смена каталога доходит до панелей', () => {
  it('подписка пересылает уведомление сервиса китов', async () => {
    // Ради этого подписка и заводилась. Раньше панели читали каталог прямо в отрисовке,
    // и переход «пусто → загружено» у ленивого каталога до них не доходил вовсе — работало
    // только по совпадению, потому что плагин китов заказывает загрузку при активации.
    const h = await harness();
    let notify: (() => void) | undefined;
    let catalog: readonly CatalogEntry[] = [];

    h.services.register(KitsServiceToken, {
      activeId: () => 'k',
      descriptor: () => ({ palette: { order: undefined } }) as never,
      catalog: () => catalog,
      catalogJson: () => ({}) as never,
      available: () => [],
      activate: () => Promise.resolve(),
      onDidChange: (cb: () => void) => {
        notify = cb;
        return { dispose: () => (notify = undefined) };
      },
    } as never);

    const host = h.schema;
    let seen = 0;
    const off = host.onCatalogChange(() => (seen += 1));

    expect(host.catalog()).toEqual([]);
    catalog = [{ name: 'Input' } as CatalogEntry];
    notify?.();

    expect(seen).toBe(1);
    expect(host.catalog()).toHaveLength(1);

    off.dispose();
    notify?.();
    expect(seen).toBe(1);
  });

  it('без сервиса китов подписка не падает, а отдаёт пустую отписку', () => {
    // Панель может отрисоваться до активации плагина китов. Отказ здесь означал бы, что
    // порядок активации плагинов стал значимым, — а он объявлен незначимым и проверен тестом.
    const services = createServiceRegistry();
    const host = createSchemaHost({
      project: { get: () => null } as never,
      i18n: createI18nService(),
      services,
    });

    expect(() => host.onCatalogChange(() => {}).dispose()).not.toThrow();
    expect(host.catalog()).toEqual([]);
  });
});

describe('порт ассистента: пометка происхождения доходит до рабочей области', () => {
  it('третий аргумент пробрасывается, а не глотается', () => {
    // Этот класс ошибки компилятор НЕ ловит: реализация с меньшим числом параметров
    // присваивается функции с бо́льшим. Тесты плагина тоже молчат — они проверяют плагин,
    // а не композицию. Поймать потерю может только проверка самого шва, то есть эта.
    const calls: Array<{ id: string; text: string; mark?: unknown }> = [];
    const host = createAiHost({
      project: {
        get: () => ({
          workspace: {
            writeText: (id: string, text: string, mark?: unknown) => {
              calls.push({ id, text, mark });
              return Promise.resolve();
            },
          },
        }),
      } as never,
      i18n: createI18nService(),
      services: createServiceRegistry(),
    });

    void host.writeText('mem:form.json' as ResourceId, '{}', {
      origin: 'agent',
      txId: 'turn-1',
    });

    expect(calls).toEqual([
      { id: 'mem:form.json', text: '{}', mark: { origin: 'agent', txId: 'turn-1' } },
    ]);
  });

  it('без пометки зовёт с тем же числом аргументов: умолчание решает рабочая область', () => {
    const marks: Array<unknown> = [];
    const host = createAiHost({
      project: {
        get: () => ({
          workspace: {
            writeText: (_id: string, _text: string, mark?: unknown) => {
              marks.push(mark);
              return Promise.resolve();
            },
          },
        }),
      } as never,
      i18n: createI18nService(),
      services: createServiceRegistry(),
    });

    void host.writeText('mem:a.json' as ResourceId, '{}');

    expect(marks).toEqual([undefined]);
  });
});

/**
 * Предпосылка, на которой держится способ отдавать тело редактора кода.
 *
 * Композиция обязана взять `Body` ОДИН раз и раздать эту ссылку всем троим (обычная вкладка,
 * markdown «рядом», исходник схемы). Именно здесь это чуть не стоило редактора: тело отдавалось
 * обёрткой, которая звала `monacoEditorContribution(...)` внутри себя, — сама обёртка была
 * стабильной, а `Body` рождался заново на каждой отрисовке. React сравнивает тип элемента
 * по ссылке, поэтому любая перерисовка родителя размонтировала Monaco и монтировала заново:
 * курсор и набранное пропадали, то есть править исходник схемы было нельзя вовсе.
 *
 * Тест охраняет не саму композицию, а факт, который делает такую обёртку разрушительной.
 * Станет `Body` стабильным между вызовами — тест упадёт, и это будет поводом перечитать
 * решение, а не молча вернуть обёртку.
 */
describe('тело редактора кода', () => {
  it('рождается заново на каждый вызов вклада — потому и берётся один раз', () => {
    const h = harness();
    const deps = {
      host: h.monaco,
      focus: createFocusRegistry(),
      viewStates: createViewStateRegistry(),
    };

    expect(monacoEditorContribution(deps).Body).not.toBe(monacoEditorContribution(deps).Body);
  });
});
