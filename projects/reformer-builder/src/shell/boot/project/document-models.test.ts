/**
 * Тесты надстройки модели над открываемым документом — на настоящей рабочей области.
 *
 * Мока здесь нет ни одного: OPFS, IndexedDB и источник заменены двойниками, а рабочая область,
 * вкладки, реестр вкладов и сама надстройка — настоящие. Иначе проверялось бы, что композиция
 * зовёт то, что мы ей подсунули, а не что из неё получается работающий документ с моделью.
 *
 * **Провайдер здесь фиктивный** («модель — список строк»), и это условие теста, а не удобство:
 * композиция не знает форматов, и тест, написанный на схеме формы, проверял бы шов вместе
 * с предметным разбором.
 *
 * @module shell/boot/project/document-models.test
 */

import { describe, expect, it, vi } from 'vitest';

import type { Diagnostic } from '@reformer/builder-plugin-api/internal';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import { createMemorySource } from '@/shell/platform/source/memory';
import { isModelDocument } from '@/shell/platform/workspace/model/model-document';
import { DocumentModelPoint } from '@reformer/builder-plugin-api/internal';
import { createLinesProvider, setLineText } from '@/shell/platform/workspace/model/testing';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { createWorkspaceSession } from './workspace-session';

let seq = 0;

interface Published {
  readonly resource: ResourceId;
  readonly source: string;
  readonly items: readonly Diagnostic[];
}

/** Сессия с реестром вкладов, в котором лежит провайдер подставного формата. */
function harness(
  files: Readonly<Record<string, string>> = { 'form.lines': 'n1 alpha\nn2 beta' },
  options: {
    readonly withProvider?: boolean;
    readonly providersReady?: () => Promise<void>;
    readonly providerGraceMs?: number;
  } = {}
) {
  seq += 1;
  const workspaceId = `wsm-${seq}`;
  const { factory } = createMemoryIndexedDb();
  const meta = createWorkspaceMetaStore({ factory, databaseName: `meta-models-${seq}` });
  const opfs = createMemoryOpfs();
  const store = createWorkspaceFileStore(workspaceId, {
    directory: opfs.directory,
    lock: (_name, body) => body(),
  });
  const source = createMemorySource(files, {
    id: `mem${seq}`,
    label: `mem-${seq}`,
    writable: true,
  });
  const whenContext = createWhenContextStore();
  const extensions = createExtensionRegistry();
  let provider =
    options.withProvider === false
      ? undefined
      : extensions.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());

  const published: Published[] = [];
  const focused = new Set<ResourceId>();

  const session = createWorkspaceSession({
    workspaceId,
    source,
    files: store,
    meta,
    whenContext,
    extensions,
    isTextEditorFocused: (id) => focused.has(id),
    modelProvidersReady: options.providersReady,
    modelProviderGraceMs: options.providerGraceMs,
    diagnostics: {
      publish: (resource, diagnosticSource, items) =>
        published.push({ resource, source: diagnosticSource, items }),
    },
  });

  return {
    session,
    extensions,
    whenContext,
    published,
    focused,
    id: (path: string): ResourceId => `${source.id}:${path}`,
    /** Правка «руками в редакторе»: рабочая копия меняется мимо модели. */
    type: (path: string, text: string) => session.workspace.writeText(`${source.id}:${path}`, text),
    /** Плагин формата выключили: вклад провайдера снят. */
    unloadProvider: () => {
      provider?.dispose();
      provider = undefined;
    },
    /** Плагин формата включили (или перечитали): провайдер — новый объект. */
    loadProvider: (providerOptions?: Parameters<typeof createLinesProvider>[0]) => {
      provider = extensions
        .forPlugin('lines')
        .contribute(DocumentModelPoint, createLinesProvider(providerOptions));
    },
    dispose: () => {
      session.dispose();
      meta.dispose();
    },
  };
}

describe('надстройка модели на открытии документа', () => {
  it('без провайдера документ остаётся текстовым, ручки нет', async () => {
    const h = harness({ 'notes.md': '# заметки' }, { withProvider: false });

    await h.session.documents.open(h.id('notes.md'));

    expect(h.session.documents.documentOf(h.id('notes.md'))?.kind).toBe('text');
    expect(h.session.models.handleOf(h.id('notes.md'))).toBeNull();
    h.dispose();
  });

  it('открытие ждёт состава провайдеров: плагин проекта, поднявшийся позже, успевает взяться', async () => {
    let settle: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const h = harness(undefined, { withProvider: false, providersReady: () => ready });

    // Вкладка восстанавливается сразу после открытия проекта, а плагин проекта с провайдером
    // модели поднимается позже — отдельной цепочкой.
    const opening = h.session.documents.open(h.id('form.lines'));
    h.extensions.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());
    settle();
    await opening;

    // Без ожидания документ открылся бы текстовым и остался таким до закрытия вкладки.
    expect(h.session.documents.documentOf(h.id('form.lines'))?.kind).toBe('model');
    h.dispose();
  });

  it('отказ ожидания открытия не отменяет: документ открывается с тем составом, что есть', async () => {
    const h = harness(undefined, {
      providersReady: () => Promise.reject(new Error('цепочка плагинов упала')),
    });

    await h.session.documents.open(h.id('form.lines'));

    expect(h.session.documents.documentOf(h.id('form.lines'))?.kind).toBe('model');
    h.dispose();
  });

  it('провайдер, взявшийся за ресурс, даёт вкладкам МОДЕЛЬНЫЙ документ', async () => {
    const h = harness();

    await h.session.documents.open(h.id('form.lines'));

    const document = h.session.documents.documentOf(h.id('form.lines'));
    if (document === null || !isModelDocument(document)) throw new Error('ожидался ModelDocument');
    expect(document.providerId).toBe('test.lines');
    expect(h.session.models.handleOf(h.id('form.lines'))).not.toBeNull();
    // Буферная часть контракта на месте: для текстового редактора это обычный документ.
    expect(document.getText()).toBe('n1 alpha\nn2 beta');
    h.dispose();
  });

  it('вид ресурса в контексте применимости — идентификатор провайдера, а не медиатип', async () => {
    const h = harness();

    await h.session.documents.open(h.id('form.lines'));

    // Ровно на этом стоит предикат панелей структурного редактора: пока документы открывались
    // текстовыми, здесь лежал медиатип, неотличимый у схемы формы и у конфига пакета.
    expect(h.whenContext.get().activeResourceKind).toBe('test.lines');
    h.dispose();
  });

  it('файл, не разобравшийся с открытия, остаётся текстовым и получает диагностику', async () => {
    const h = harness({ 'form.lines': 'без идентификатора' });

    await h.session.documents.open(h.id('form.lines'));

    // Расхождение — состояние документа, у которого модель БЫЛА. У этого её не было ни секунды.
    expect(h.session.documents.documentOf(h.id('form.lines'))?.kind).toBe('text');
    expect(h.session.models.handleOf(h.id('form.lines'))).toBeNull();
    const parse = h.published.filter((entry) => entry.source === 'document.model');
    expect(parse[parse.length - 1].items[0].code).toBe('document.parse-failed');
    h.dispose();
  });

  it('повторное открытие отдаёт ту же ручку: вторая модель над одним буфером недопустима', async () => {
    const h = harness();

    await h.session.documents.open(h.id('form.lines'));
    const first = h.session.models.handleOf(h.id('form.lines'));
    await h.session.documents.open(h.id('form.lines'));

    expect(h.session.models.handleOf(h.id('form.lines'))).toBe(first);
    h.dispose();
  });

  it('закрытие вкладки убирает ручку', async () => {
    const h = harness();

    await h.session.documents.open(h.id('form.lines'));
    await h.session.documents.close(h.id('form.lines'));

    expect(h.session.models.handleOf(h.id('form.lines'))).toBeNull();
    h.dispose();
  });

  it('закрытие проекта убирает ручки вместе с сессией', async () => {
    const h = harness();

    await h.session.documents.open(h.id('form.lines'));
    h.session.dispose();

    expect(h.session.models.handleOf(h.id('form.lines'))).toBeNull();
    h.dispose();
  });
});

describe('модель и рабочая копия', () => {
  it('правка модели доезжает до рабочей копии', async () => {
    const h = harness();
    await h.session.documents.open(h.id('form.lines'));
    const handle = h.session.models.handleOf(h.id('form.lines'));
    if (handle === null) throw new Error('ожидалась ручка модели');

    handle.apply(setLineText('n1', 'ALPHA'));
    await handle.flush();

    expect(await h.session.workspace.readText(h.id('form.lines'))).toBe('n1 ALPHA\nn2 beta');
    h.dispose();
  });

  it('пока текстовый редактор в фокусе, буфер не перерисовывается — и догоняет по flush', async () => {
    const h = harness();
    const id = h.id('form.lines');
    await h.session.documents.open(id);
    const handle = h.session.models.handleOf(id);
    if (handle === null) throw new Error('ожидалась ручка модели');

    // Реестр фокуса отвечает «человек печатает прямо здесь»: ход ассистента не должен
    // затирать набранное на полуслове.
    h.focused.add(id);
    handle.apply(setLineText('n1', 'ALPHA'));
    await Promise.resolve();
    expect(handle.hasPendingSync()).toBe(true);
    expect(h.session.documents.documentOf(id)?.getText()).toBe('n1 alpha\nn2 beta');

    // Уход фокуса — тот самый момент, когда порт Monaco зовёт `flush`.
    h.focused.delete(id);
    await handle.flush();
    expect(h.session.documents.documentOf(id)?.getText()).toBe('n1 ALPHA\nn2 beta');
    h.dispose();
  });

  it('эхо собственной печати не пересобирает модель', async () => {
    const h = harness();
    const id = h.id('form.lines');
    await h.session.documents.open(id);
    const handle = h.session.models.handleOf(id);
    if (handle === null) throw new Error('ожидалась ручка модели');

    handle.apply(setLineText('n1', 'ALPHA'));
    await handle.flush();
    const model = handle.document.getModel();
    await Promise.resolve();

    // Разбор своего же вывода дал бы РАВНУЮ, но другую модель — и structural sharing,
    // ради которого модельный документ существует, пропал бы на первой правке.
    expect(handle.document.getModel()).toBe(model);
    h.dispose();
  });

  it('чужая правка рабочей копии разводит документ, а починка его возвращает', async () => {
    const h = harness();
    const id = h.id('form.lines');
    await h.session.documents.open(id);
    const handle = h.session.models.handleOf(id);
    if (handle === null) throw new Error('ожидалась ручка модели');
    const valid = handle.document.getModel();

    await h.type('form.lines', 'сломано');
    expect(handle.document.getSyncState()).toBe('diverged');
    expect(handle.document.getModel()).toBe(valid);
    expect(handle.canUndo()).toBe(false);

    await h.type('form.lines', 'n1 gamma');
    expect(handle.document.getSyncState()).toBe('synced');
    h.dispose();
  });
});

describe('смена состава провайдеров', () => {
  /** Сверка по изменению реестра ставится микрозадачей; эта ждёт и её, и всё, что за ней. */
  const settle = async (h: ReturnType<typeof harness>): Promise<void> => {
    await Promise.resolve();
    await h.session.models.reconcile();
  };
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  it('перечитанный провайдер переразбирает открытый документ — несохранённая правка остаётся', async () => {
    const h = harness();
    const id = h.id('form.lines');
    await h.session.documents.open(id);
    const before = h.session.models.handleOf(id);
    if (before === null) throw new Error('ожидалась ручка модели');
    before.apply(setLineText('n1', 'ALPHA'));
    await before.flush();

    // Перезагрузка плагина в каталоге: вклад снят, перечитан, внесён — уже другим объектом.
    h.unloadProvider();
    await Promise.resolve();
    h.loadProvider();

    // Сверку здесь никто не зовёт: её ставит сама подписка на реестр вкладов.
    await vi.waitFor(() => expect(h.session.models.handleOf(id)).not.toBe(before));
    const after = h.session.models.handleOf(id);
    expect(after).not.toBeNull();
    // Вкладка показывает новый документ: старый смотрел бы в модель, которую разбирал мёртвый код.
    expect(h.session.documents.documentOf(id)).toBe(after?.document);
    expect(after?.document.getText()).toBe('n1 ALPHA\nn2 beta');
    expect(h.session.workspace.isDirty(id)).toBe(true);
    // История отмены — снимки прежнего формата: к новому разбору её не перенести.
    expect(after?.canUndo()).toBe(false);
    h.dispose();
  });

  it('текстовый документ становится модельным, когда за него взялся включённый провайдер', async () => {
    const h = harness(undefined, { withProvider: false });
    const id = h.id('form.lines');
    await h.session.documents.open(id);
    expect(h.session.documents.documentOf(id)?.kind).toBe('text');

    h.loadProvider();
    await settle(h);

    expect(h.session.documents.documentOf(id)?.kind).toBe('model');
    expect(h.whenContext.get().activeResourceKind).toBe('test.lines');
    h.dispose();
  });

  it('провайдер ушёл без замены — после выдержки документ становится текстовым', async () => {
    const h = harness(undefined, { providerGraceMs: 20 });
    const id = h.id('form.lines');
    await h.session.documents.open(id);

    h.unloadProvider();
    await settle(h);
    // Посреди выдержки модель на месте: перезагрузка вернёт провайдер через мгновение.
    expect(h.session.models.handleOf(id)).not.toBeNull();

    await wait(40);
    await settle(h);
    expect(h.session.models.handleOf(id)).toBeNull();
    expect(h.session.documents.documentOf(id)?.kind).toBe('text');
    expect(h.session.documents.documentOf(id)?.getText()).toBe('n1 alpha\nn2 beta');
    h.dispose();
  });

  it('провайдер вернулся внутри выдержки — переразбор один, в текст документ не уходит', async () => {
    const h = harness(undefined, { providerGraceMs: 20 });
    const id = h.id('form.lines');
    await h.session.documents.open(id);
    const kinds: string[] = [];
    h.session.models.onDidReattach((_id, document) => kinds.push(document.kind));

    // Перечитывание плагина асинхронно: между снятием и вкладом проходит не одна задача.
    h.unloadProvider();
    await settle(h);
    h.loadProvider();
    await settle(h);
    await wait(40);
    await settle(h);

    expect(kinds).toEqual(['model']);
    expect(h.session.documents.documentOf(id)?.kind).toBe('model');
    h.dispose();
  });

  it('выделение переносится к провайдеру того же формата и не переносится к чужому', async () => {
    const h = harness();
    const id = h.id('form.lines');
    await h.session.documents.open(id);
    h.session.models.handleOf(id)?.setSelection(['n2']);

    h.unloadProvider();
    h.loadProvider();
    await settle(h);
    expect(h.session.models.handleOf(id)?.document.getSelection()).toEqual(['n2']);

    // Адреса узлов — формат провайдера: у другого формата `n2` может значить что угодно.
    h.unloadProvider();
    h.loadProvider({ id: 'test.other' });
    await settle(h);
    expect(h.session.models.handleOf(id)?.document.providerId).toBe('test.other');
    expect(h.session.models.handleOf(id)?.document.getSelection()).toEqual([]);
    h.dispose();
  });

  it('пока человек печатает в отстающем буфере, переразбор ждёт ухода фокуса', async () => {
    const h = harness();
    const id = h.id('form.lines');
    await h.session.documents.open(id);
    const before = h.session.models.handleOf(id);
    if (before === null) throw new Error('ожидалась ручка модели');
    h.focused.add(id);
    before.apply(setLineText('n1', 'ALPHA'));
    await Promise.resolve();

    h.unloadProvider();
    h.loadProvider();
    await settle(h);
    // Переразбор по буферу потерял бы правку, которая ещё в модели, а не в тексте.
    expect(h.session.models.handleOf(id)).toBe(before);

    h.focused.delete(id);
    await before.flush();
    await settle(h);
    const after = h.session.models.handleOf(id);
    expect(after).not.toBe(before);
    expect(after?.document.getText()).toBe('n1 ALPHA\nn2 beta');
    h.dispose();
  });
});
