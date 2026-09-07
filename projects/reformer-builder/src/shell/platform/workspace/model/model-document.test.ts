/**
 * Тесты двух видов документа, расхождения, перерисовки буфера и отмены.
 *
 * **Провайдер здесь фиктивный** («модель — список строк», см. `testing.ts`), и это условие
 * теста, а не удобство: Host не знает форматов, и тест, написанный на схеме формы, проверял бы
 * машинерию документа вместе с предметным разбором — а первое же изменение в схеме роняло бы
 * тесты ядра.
 *
 * Проверяются свойства контракта:
 *
 * - без провайдера документ ОСТАЁТСЯ текстовым, с провайдером — становится модельным;
 * - неразбираемый буфер переводит документ в расхождение, а сохранение пишет БУФЕР;
 * - после починки буфера модель догоняет;
 * - правка модели не трогает буфер, пока текстовый редактор в фокусе, и перерисовывает
 *   его, когда фокус ушёл;
 * - выделение переезжает на `focus` операции и входит в снимок отмены;
 * - эхо собственной печати не пересобирает модель — иначе structural sharing пропал бы.
 *
 * @module shell/platform/workspace/model/model-document.test
 */

import { describe, expect, it } from 'vitest';

import type { Diagnostic } from '@/shell/platform/services/diagnostics/types';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import {
  makeResourceId,
  mediaTypeFor,
  type ResourceId,
  type ResourceRef,
} from '@/shell/platform/primitives/resource';
import { createDocument, type Document, type DocumentHandle } from '../document';
import { createWorkspaceMetaStore } from './../storage/idb';
import { createWorkspaceFileStore } from './../storage/opfs';
import { createMemoryIndexedDb, createMemoryOpfs } from './../storage/testing';
import { createMemorySource, type MemorySource } from './../testing';
import { createWorkspace, type Workspace } from './../workspace';
import { mergeKeyOf } from './history';
import {
  attachDocumentModel,
  createModelDocument,
  isModelDocument,
  isTextDocument,
  PARSE_DIAGNOSTIC_SOURCE,
  type ModelDocumentHandle,
} from './model-document';
import { DocumentModelPoint } from './provider';
import {
  createLinesProvider,
  insertLine,
  printLines,
  removeLine,
  setLineText,
  type LinesModel,
} from './testing';

const SOURCE_ID = 'mem';

function refOf(path: string): ResourceRef {
  return {
    id: makeResourceId(SOURCE_ID, path),
    sourceId: SOURCE_ID,
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType: mediaTypeFor(path),
  };
}

interface Published {
  readonly resource: ResourceId;
  readonly source: string;
  readonly items: readonly Diagnostic[];
}

interface Bench {
  /** Буфер: то, чем для документа является рабочая копия Workspace. */
  readonly buffer: DocumentHandle;
  readonly handle: ModelDocumentHandle<LinesModel>;
  /** Всё, что документ отправил в `writeText`. Пусто — значит буфер не трогали. */
  readonly writes: string[];
  readonly published: Published[];
  setFocused(value: boolean): void;
  /** Правка «руками в редакторе»: буфер меняется мимо модели. */
  type(text: string): void;
}

/**
 * Документ с моделью поверх настоящего буфера.
 *
 * `writeText` замыкается на тот же буфер — так же, как это делает Workspace: запись в рабочую
 * копию возвращается документу событием. Без этого кольца эхо собственной печати не проверить.
 */
function makeBench(text: string, path = 'form.lines'): Bench {
  const buffer = createDocument(refOf(path), text, false);
  const writes: string[] = [];
  const published: Published[] = [];
  let focused = false;

  const handle = createModelDocument<LinesModel>({
    document: buffer.document,
    provider: createLinesProvider(),
    writeText: (next) => {
      writes.push(next);
      buffer.setText(next);
    },
    isTextEditorFocused: () => focused,
    diagnostics: {
      publish: (resource, source, items) => published.push({ resource, source, items }),
    },
  });

  return {
    buffer,
    handle,
    writes,
    published,
    setFocused: (value) => {
      focused = value;
    },
    type: (next) => buffer.setText(next),
  };
}

/** Последние опубликованные диагностики разбора. */
function lastDiagnostics(bench: Bench): readonly Diagnostic[] {
  const own = bench.published.filter((entry) => entry.source === PARSE_DIAGNOSTIC_SOURCE);
  return own[own.length - 1]?.items ?? [];
}

describe('вид документа', () => {
  it('без провайдера документ остаётся текстовым — тем же объектом', () => {
    const registry = createExtensionRegistry();
    const buffer = createDocument(refOf('notes.md'), '# заметки', false);

    const attached = attachDocumentModel({
      document: buffer.document,
      extensions: registry,
      writeText: () => {},
    });

    // Именно «остаётся»: никакой обёртки, иначе ссылок на один документ стало бы две.
    expect(attached.document).toBe(buffer.document);
    expect(attached.document.kind).toBe('text');
    expect(attached.handle).toBeUndefined();
    expect(isTextDocument(attached.document)).toBe(true);
  });

  it('провайдер, взявшийся за ресурс, даёт модельный документ', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());
    const buffer = createDocument(refOf('form.lines'), 'n1 alpha\nn2 beta', false);

    const attached = attachDocumentModel({
      document: buffer.document,
      extensions: registry,
      writeText: () => {},
    });

    expect(attached.document.kind).toBe('model');
    expect(isModelDocument(attached.document)).toBe(true);
    if (!isModelDocument<LinesModel>(attached.document)) throw new Error('ожидался ModelDocument');
    expect(attached.document.providerId).toBe('test.lines');
    expect(attached.document.getModel().lines.map((line) => line.text)).toEqual(['alpha', 'beta']);
    // Буферная часть контракта на месте: для текстового редактора это обычный документ.
    expect(attached.document.getText()).toBe('n1 alpha\nn2 beta');
    expect(attached.document.id).toBe(buffer.document.id);
  });

  it('провайдер, не вызвавшийся на ресурс, документ не трогает', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());
    const buffer = createDocument(refOf('readme.md'), 'n1 alpha', false);

    const attached = attachDocumentModel({
      document: buffer.document,
      extensions: registry,
      writeText: () => {},
    });

    expect(attached.document.kind).toBe('text');
  });

  it('файл, не разобравшийся с первого раза, остаётся текстовым и получает диагностику', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());
    const buffer = createDocument(refOf('form.lines'), 'без идентификатора', false);
    const published: Published[] = [];

    const attached = attachDocumentModel({
      document: buffer.document,
      extensions: registry,
      writeText: () => {},
      diagnostics: {
        publish: (resource, source, items) => published.push({ resource, source, items }),
      },
    });

    // Расхождение — состояние документа, у которого модель БЫЛА. У этого её не было ни секунды,
    // и показывать структурному редактору нечего.
    expect(attached.document.kind).toBe('text');
    expect(published[0].items[0].code).toBe('document.parse-failed');
  });
});

describe('расхождение буфера и модели', () => {
  it('неразбираемый буфер разводит документ, модель держит последнюю валидную', () => {
    const bench = makeBench('n1 alpha');
    const document = bench.handle.document;

    bench.type('сломано напрочь');

    expect(document.getSyncState()).toBe('diverged');
    expect(document.getText()).toBe('сломано напрочь');
    expect(document.getModel().lines[0].text).toBe('alpha');
    expect(document.getParseFailure()?.providerId).toBe('test.lines');
    expect(lastDiagnostics(bench)[0].code).toBe('document.parse-failed');
  });

  it('в расхождении структурная правка отвергается, а не применяется к старой модели', () => {
    const bench = makeBench('n1 alpha');
    bench.type('сломано');

    const outcome = bench.handle.apply(insertLine(1, 'beta'));

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') throw new Error('ожидался отказ');
    expect(outcome.reason).toBe('diverged');
    expect(bench.handle.document.isStructurallyEditable()).toBe(false);
    // Главное: буфер не тронут — иначе перерисовка затёрла бы недописанный текст.
    expect(bench.writes).toEqual([]);
    expect(bench.handle.document.getText()).toBe('сломано');
  });

  it('в расхождении отмена тоже отвергается', () => {
    const bench = makeBench('n1 alpha');
    bench.handle.apply(setLineText('n1', 'beta'));
    bench.type('сломано');

    expect(bench.handle.undo()).toBe(false);
    expect(bench.handle.document.getText()).toBe('сломано');
  });

  it('после починки буфера модель догоняет, а диагностика снимается', () => {
    const bench = makeBench('n1 alpha');
    bench.type('сломано');

    bench.type('n1 alpha\nn2 beta');

    expect(bench.handle.document.getSyncState()).toBe('synced');
    expect(bench.handle.document.getModel().lines).toHaveLength(2);
    expect(lastDiagnostics(bench)).toEqual([]);
    expect(bench.handle.document.isStructurallyEditable()).toBe(true);
  });
});

describe('перерисовка буфера по модели', () => {
  it('правка модели перерисовывает буфер, когда редактор не в фокусе', async () => {
    const bench = makeBench('n1 alpha');

    bench.handle.apply(insertLine(1, 'beta'));
    await bench.handle.flush();

    expect(bench.handle.document.getText()).toBe('n1 alpha\nn2 beta');
    expect(bench.writes).toEqual(['n1 alpha\nn2 beta']);
  });

  it('правка модели НЕ трогает буфер, пока редактор в фокусе', async () => {
    const bench = makeBench('n1 alpha');
    bench.setFocused(true);

    bench.handle.apply(insertLine(1, 'beta'));
    await bench.handle.flush();

    // Затирать то, что человек печатает прямо сейчас, нельзя — даже своей же правильной печатью.
    expect(bench.writes).toEqual([]);
    expect(bench.handle.document.getText()).toBe('n1 alpha');
    expect(bench.handle.document.getModel().lines).toHaveLength(2);
  });

  it('отложенная перерисовка догоняет, когда фокус ушёл', async () => {
    const bench = makeBench('n1 alpha');
    bench.setFocused(true);
    bench.handle.apply(insertLine(1, 'beta'));
    expect(bench.handle.hasPendingSync()).toBe(true);

    bench.setFocused(false);
    await bench.handle.flush();

    expect(bench.handle.document.getText()).toBe('n1 alpha\nn2 beta');
    expect(bench.handle.hasPendingSync()).toBe(false);
  });

  it('отложенная перерисовка отменяется, если буфер изменил пользователь', async () => {
    const bench = makeBench('n1 alpha');
    bench.setFocused(true);
    bench.handle.apply(insertLine(1, 'beta'));

    bench.type('n1 переписал руками');
    bench.setFocused(false);
    await bench.handle.flush();

    // Побеждает тот, кто печатает: его текст — то, что он видит и сохранит.
    expect(bench.handle.document.getText()).toBe('n1 переписал руками');
    expect(bench.writes).toEqual([]);
    expect(bench.handle.document.getModel().lines[0].text).toBe('переписал руками');
  });

  it('эхо собственной печати не пересобирает модель', async () => {
    const bench = makeBench('n1 alpha\nn2 beta');
    const before = bench.handle.document.getModel();

    const outcome = bench.handle.apply(setLineText('n1', 'gamma'));
    await bench.handle.flush();
    const after = bench.handle.document.getModel();

    if (outcome.status !== 'applied') throw new Error('ожидалось применение');
    // Разбор своего же вывода вернул бы РАВНУЮ, но другую модель — и structural sharing,
    // ради которого модельный документ и существует, пропал бы на первой же правке.
    expect(after).toBe(outcome.model);
    expect(after.lines[1]).toBe(before.lines[1]);
  });

  it('отставшая запись не выдаёт себя за чужую правку, когда модель уехала дальше', async () => {
    // `writeText` настоящей рабочей области асинхронен (OPFS), и за время записи модель успевает
    // измениться. Тогда вернувшееся эхо не совпадает с последней печатью — и наивная проверка
    // «эхо это текущая печать» приняла бы собственную запись за правку пользователя.
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const buffer = createDocument(refOf('form.lines'), 'n1 alpha', false);
    const writes: string[] = [];
    const handle = createModelDocument<LinesModel>({
      document: buffer.document,
      provider: createLinesProvider(),
      writeText: async (text) => {
        writes.push(text);
        if (writes.length === 1) await gate;
        buffer.setText(text);
      },
    });

    handle.apply(insertLine(1, 'beta'));
    const second = handle.apply(insertLine(2, 'gamma'));
    release();
    await handle.flush();

    if (second.status !== 'applied') throw new Error('ожидалось применение');
    // Модель — та же, что вернула последняя операция: ни одного лишнего разбора.
    expect(handle.document.getModel()).toBe(second.model);
    expect(handle.document.getText()).toBe(printLines(second.model));
    expect(handle.document.getSyncState()).toBe('synced');
  });

  it('печать, совпавшая с буфером, не идёт в запись', async () => {
    const bench = makeBench('n1 alpha');

    // Операция, возвращающая ту же модель по содержанию: текст не изменился, писать нечего.
    bench.handle.apply(setLineText('n1', 'alpha'));
    await bench.handle.flush();

    expect(bench.writes).toEqual([]);
  });
});

describe('выделение', () => {
  it('переезжает на focus операции', () => {
    const bench = makeBench('n1 alpha');

    const outcome = bench.handle.apply(insertLine(1, 'beta'));

    if (outcome.status !== 'applied') throw new Error('ожидалось применение');
    // «Куда смотреть после операции» знает только сама операция: узел родился при вставке.
    expect(outcome.focus).toBeDefined();
    expect(bench.handle.document.getSelection()).toEqual([outcome.focus]);
  });

  it('переезжает на соседа, когда узел удалён', () => {
    const bench = makeBench('n1 alpha\nn2 beta');
    bench.handle.setSelection(['n2']);

    bench.handle.apply(removeLine('n2'));

    expect(bench.handle.document.getSelection()).toEqual(['n1']);
  });

  it('входит в снимок отмены и возвращается вместе с моделью', async () => {
    const bench = makeBench('n1 alpha');
    bench.handle.setSelection(['n1']);

    const outcome = bench.handle.apply(insertLine(1, 'beta'));
    if (outcome.status !== 'applied') throw new Error('ожидалось применение');
    expect(bench.handle.document.getSelection()).toEqual([outcome.focus]);
    bench.handle.undo();
    await bench.handle.flush();

    expect(bench.handle.document.getSelection()).toEqual(['n1']);
    expect(bench.handle.document.getText()).toBe('n1 alpha');
  });
});

describe('история модели', () => {
  it('соседние правки одного свойства одного узла схлопываются в один шаг', async () => {
    const bench = makeBench('n1 alpha');
    const key = mergeKeyOf('text', 'n1');

    bench.handle.apply(setLineText('n1', 'a'), { mergeKey: key });
    bench.handle.apply(setLineText('n1', 'ab'), { mergeKey: key });
    bench.handle.apply(setLineText('n1', 'abc'), { mergeKey: key });
    await bench.handle.flush();
    bench.handle.undo();
    await bench.handle.flush();

    // Иначе набор текста в поле забьёт стек и Ctrl+Z станет посимвольным.
    expect(bench.handle.document.getText()).toBe('n1 alpha');
  });

  it('явная граница не даёт схлопнуть правки с тем же ключом', async () => {
    const bench = makeBench('n1 alpha');
    const key = mergeKeyOf('text', 'n1');

    bench.handle.apply(setLineText('n1', 'a'), { mergeKey: key });
    bench.handle.breakUndoMerge();
    bench.handle.apply(setLineText('n1', 'ab'), { mergeKey: key });
    bench.handle.undo();
    await bench.handle.flush();

    expect(bench.handle.document.getText()).toBe('n1 a');
  });

  it('текстовая правка между структурными тоже граница', async () => {
    const bench = makeBench('n1 alpha');
    const key = mergeKeyOf('text', 'n1');

    bench.handle.apply(setLineText('n1', 'a'), { mergeKey: key });
    await bench.handle.flush();
    bench.type('n1 руками');
    bench.handle.apply(setLineText('n1', 'ab'), { mergeKey: key });
    bench.handle.undo();
    await bench.handle.flush();

    // Шаг отмены, перепрыгивающий через набранный руками текст, стёр бы чужую работу.
    expect(bench.handle.document.getText()).toBe('n1 руками');
  });

  it('шаг вперёд возвращает отменённое', async () => {
    const bench = makeBench('n1 alpha');
    bench.handle.apply(insertLine(1, 'beta'));
    await bench.handle.flush();
    bench.handle.undo();
    await bench.handle.flush();

    bench.handle.redo();
    await bench.handle.flush();

    expect(bench.handle.document.getText()).toBe('n1 alpha\nn2 beta');
  });

  it('отменять нечего — отмена честно отвечает «нет»', () => {
    const bench = makeBench('n1 alpha');

    expect(bench.handle.undo()).toBe(false);
    expect(bench.handle.redo()).toBe(false);
  });

  it('`canUndo` отвечает про ИСХОД отмены, а не про длину стека', async () => {
    const bench = makeBench('n1 alpha');
    expect(bench.handle.canUndo()).toBe(false);
    expect(bench.handle.canRedo()).toBe(false);

    bench.handle.apply(insertLine(1, 'beta'));
    await bench.handle.flush();
    expect(bench.handle.canUndo()).toBe(true);
    expect(bench.handle.canRedo()).toBe(false);

    bench.handle.undo();
    await bench.handle.flush();
    expect(bench.handle.canRedo()).toBe(true);
  });

  it('в расхождении обе отмены отвечают «нет» — как и сами `undo`/`redo`', async () => {
    const bench = makeBench('n1 alpha');
    bench.handle.apply(insertLine(1, 'beta'));
    await bench.handle.flush();

    bench.type('сломано');

    // Предикат обязан совпасть с исходом: пункт меню, обещающий то, чего не сделает,
    // хуже отсутствующего.
    expect(bench.handle.canUndo()).toBe(false);
    expect(bench.handle.undo()).toBe(false);
    expect(bench.handle.canRedo()).toBe(false);
    expect(bench.handle.redo()).toBe(false);
  });
});

describe('отказ провайдера', () => {
  it('битая операция не портит ни модель, ни буфер', async () => {
    const bench = makeBench('n1 alpha');
    const before = bench.handle.document.getModel();

    const outcome = bench.handle.apply({ type: 'set-text', target: 'нет-такого' });
    await bench.handle.flush();

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') throw new Error('ожидался отказ');
    expect(outcome.reason).toBe('provider-error');
    expect(bench.handle.document.getModel()).toBe(before);
    expect(bench.writes).toEqual([]);
  });
});

/*
 * ─────────────────  сохранение: документ поверх настоящего Workspace  ─────────────────
 */

interface WorkspaceBench {
  readonly ws: Workspace;
  readonly source: MemorySource;
  rid(path: string): ResourceId;
}

let seq = 0;

function makeWorkspace(initial: Readonly<Record<string, string>>): WorkspaceBench {
  seq += 1;
  const id = `model-ws${seq}`;
  const opfs = createMemoryOpfs();
  const memoryDb = createMemoryIndexedDb();
  const source = createMemorySource(initial, { id: SOURCE_ID });
  const ws = createWorkspace({
    id,
    source,
    files: createWorkspaceFileStore(id, { directory: opfs.directory }),
    meta: createWorkspaceMetaStore({
      factory: memoryDb.factory,
      databaseName: `model-ws-${seq}`,
      estimate: async () => ({ usage: 0, quota: 1_000_000 }),
    }),
  });
  return { ws, source, rid: (path) => makeResourceId(SOURCE_ID, path) };
}

/** Даёт отработать микрозадачам и коммитам подставной IndexedDB. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('сохранение', () => {
  it('в расхождении пишет БУФЕР, а не модель', async () => {
    const bench = makeWorkspace({ 'form.lines': 'n1 alpha' });
    const resource = bench.rid('form.lines');
    const registry = createExtensionRegistry();
    registry.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());
    const document: Document = await bench.ws.open(resource);
    const attached = attachDocumentModel({
      document,
      extensions: registry,
      writeText: (text) => bench.ws.writeText(resource, text),
    });
    if (!isModelDocument<LinesModel>(attached.document)) throw new Error('ожидался ModelDocument');

    // Человек печатает в Monaco незавершённый текст: правка идёт через рабочую копию.
    await bench.ws.writeText(resource, 'n1 alpha\nнедописанная строка');
    const result = await bench.ws.save(resource);
    await settle();

    expect(attached.document.getSyncState()).toBe('diverged');
    expect(result.ok).toBe(true);
    // Пользователь сохраняет то, что видит: незавершённый код — законное содержимое файла,
    // а тихая запись устаревшей модели означала бы потерю его работы.
    expect(bench.source.textOf('form.lines')).toBe('n1 alpha\nнедописанная строка');
    expect(printLines(attached.document.getModel())).toBe('n1 alpha');
  });

  it('структурная правка доезжает до источника через рабочую копию', async () => {
    const bench = makeWorkspace({ 'form.lines': 'n1 alpha' });
    const resource = bench.rid('form.lines');
    const registry = createExtensionRegistry();
    registry.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());
    const attached = attachDocumentModel({
      document: await bench.ws.open(resource),
      extensions: registry,
      writeText: (text) => bench.ws.writeText(resource, text),
    });

    attached.handle?.apply(insertLine(1, 'beta'));
    await attached.handle?.flush();
    // До сохранения источник не тронут: единственный путь наружу — `save`.
    expect(bench.source.textOf('form.lines')).toBe('n1 alpha');
    await bench.ws.save(resource);
    await settle();

    expect(bench.source.textOf('form.lines')).toBe('n1 alpha\nn2 beta');
  });
});
