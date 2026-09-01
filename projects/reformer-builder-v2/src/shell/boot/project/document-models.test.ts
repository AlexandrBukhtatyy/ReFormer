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

import { describe, expect, it } from 'vitest';

import type { Diagnostic } from '@/shell/platform/diagnostics/types';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import { createMemorySource } from '@/shell/platform/source/memory';
import { isModelDocument } from '@/shell/platform/workspace/model/model-document';
import { DocumentModelPoint } from '@/shell/platform/workspace/model/provider';
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
  options: { readonly withProvider?: boolean } = {}
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
  if (options.withProvider !== false) {
    extensions.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());
  }

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
    diagnostics: {
      publish: (resource, diagnosticSource, items) =>
        published.push({ resource, source: diagnosticSource, items }),
    },
  });

  return {
    session,
    whenContext,
    published,
    focused,
    id: (path: string): ResourceId => `${source.id}:${path}`,
    /** Правка «руками в редакторе»: рабочая копия меняется мимо модели. */
    type: (path: string, text: string) => session.workspace.writeText(`${source.id}:${path}`, text),
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
