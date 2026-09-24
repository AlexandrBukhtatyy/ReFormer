/**
 * Документ из нескольких файлов: корень ссылается на части, редакторы видят одну модель.
 *
 * Провайдер — тот же подставной «список строк» (`testing.ts`) с включениями: строка корня
 * `<id> @<файл>` заменяется строками файла. Формат нарочно чужой — схема формы проверяла бы
 * машинерию документа вместе с предметным разбором (он покрыт тестами стека).
 *
 * Проверяются свойства контракта:
 *
 * - правка узла части пишет ТОЛЬКО файл части, корень не трогается;
 * - отмена возвращает и модель, и файлы;
 * - перестройка раскладки («разбить» / «собрать») — одна запись истории, модель прежняя;
 * - выпавшая часть ждёт сохранения, а не удаляется сразу, и отмена её возвращает;
 * - правка части со стороны пересобирает модель, своя запись — нет (эхо);
 * - битая часть — расхождение документа.
 *
 * @module shell/platform/workspace/model/composite-document.test
 */

import { describe, expect, it } from 'vitest';
import {
  makeResourceId,
  mediaTypeFor,
  toDisposable,
  type ResourceId,
  type ResourceRef,
} from '@reformer/builder-plugin-api/internal';
import type {
  DocumentComposition,
  DocumentModelProvider,
} from '@reformer/builder-plugin-api/internal';
import { createDocument } from '../document';
import { createModelDocument, type ModelDocumentHandle } from './model-document';
import {
  createLinesProvider,
  printLines,
  setLineText,
  type LinesModel,
  type LineNode,
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

/** Раскладка: какая строка из какого файла и какой строкой корня на него ссылались. */
interface LinesLayout {
  readonly origin: ReadonlyMap<string, string>;
  readonly refIds: ReadonlyMap<string, string>;
}

const REF = /^@(.+)$/;

/** Включения поверх провайдера строк: `<id> @<файл>` в корне. */
function linesComposition(
  base: DocumentModelProvider<LinesModel>
): DocumentComposition<LinesModel> {
  const refsOf = (root: LinesModel): { id: string; spec: string }[] =>
    root.lines.flatMap((line) => {
      const matched = REF.exec(line.text);
      return matched === null ? [] : [{ id: line.id, spec: matched[1] }];
    });

  return {
    references: (root) => refsOf(root).map((ref) => ref.spec),

    compose(root, parts) {
      const origin = new Map<string, string>();
      const refIds = new Map<string, string>();
      const lines: LineNode[] = [];
      for (const line of root.lines) {
        const matched = REF.exec(line.text);
        if (matched === null) {
          lines.push(line);
          continue;
        }
        const text = parts.get(matched[1]);
        if (text === undefined) throw new Error(`нет части ${matched[1]}`);
        refIds.set(matched[1], line.id);
        for (const inner of base.parse(text).lines) {
          origin.set(inner.id, matched[1]);
          lines.push(inner);
        }
      }
      return { model: { lines }, layout: { origin, refIds } satisfies LinesLayout };
    },

    decompose(model, layout, restructure) {
      const current = (layout as LinesLayout | undefined) ?? {
        origin: new Map(),
        refIds: new Map(),
      };
      const origin = new Map<string, string>(restructure === 'join' ? [] : current.origin);
      // «Разбить» выносит всё безфайловое в новый файл.
      if (restructure === 'split') {
        for (const line of model.lines) if (!origin.has(line.id)) origin.set(line.id, 'new.lines');
      }
      const root: LineNode[] = [];
      const groups = new Map<string, LineNode[]>();
      const refIds = new Map<string, string>();
      for (const line of model.lines) {
        const spec = origin.get(line.id);
        if (spec === undefined) {
          root.push(line);
          continue;
        }
        if (!groups.has(spec)) {
          groups.set(spec, []);
          const id = current.refIds.get(spec) ?? `r${refIds.size + 1}`;
          refIds.set(spec, id);
          root.push({ id, text: `@${spec}` });
        }
        groups.get(spec)?.push(line);
      }
      const parts = new Map([...groups].map(([spec, lines]) => [spec, printLines({ lines })]));
      const kept = new Map([...origin].filter(([id]) => model.lines.some((l) => l.id === id)));
      return { root: { lines: root }, parts, layout: { origin: kept, refIds } };
    },
  };
}

interface Bench {
  readonly handle: ModelDocumentHandle<LinesModel>;
  /** Рабочая копия частей: путь → текст. */
  readonly files: Map<string, string>;
  /** Записи частей в порядке. */
  readonly partWrites: string[];
  readonly rootWrites: string[];
  /** Правка части «со стороны»: рабочая копия меняется, документ узнаёт событием. */
  touch(path: string, text: string): Promise<void>;
  settle(): Promise<void>;
}

function makeBench(root: string, parts: Record<string, string>): Bench {
  const base = createLinesProvider();
  const provider: DocumentModelProvider<LinesModel> = {
    ...base,
    composition: linesComposition(base),
  };
  const buffer = createDocument(refOf('form.lines'), root, false);
  const files = new Map(Object.entries(parts));
  const partWrites: string[] = [];
  const rootWrites: string[] = [];
  const listeners = new Set<(ids: readonly ResourceId[]) => void>();
  const idOf = (path: string): ResourceId => makeResourceId(SOURCE_ID, path);
  const pathOf = (id: ResourceId): string => id.slice(SOURCE_ID.length + 1);
  const emit = (path: string): void => {
    for (const cb of [...listeners]) cb([idOf(path)]);
  };

  const handle = createModelDocument<LinesModel>({
    document: buffer.document,
    provider,
    writeText: (text) => {
      rootWrites.push(text);
      buffer.setText(text);
    },
    parts: {
      initial: new Map(files),
      resolve: idOf,
      write: async (id, text) => {
        partWrites.push(pathOf(id));
        files.set(pathOf(id), text);
        emit(pathOf(id));
      },
      read: async (id) => files.get(pathOf(id)) ?? null,
      onDidChange: (cb) => {
        listeners.add(cb);
        return toDisposable(() => listeners.delete(cb));
      },
    },
  });

  const settle = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    await handle.flush();
  };

  return {
    handle,
    files,
    partWrites,
    rootWrites,
    settle,
    async touch(path, text) {
      files.set(path, text);
      emit(path);
      await settle();
    },
  };
}

const ROOT = 'n1 intro\nr1 @a.lines\nn9 outro';
const PART_A = 'n2 alpha\nn3 beta';

function texts(handle: ModelDocumentHandle<LinesModel>): string[] {
  return handle.document.getModel().lines.map((line) => line.text);
}

describe('составной документ', () => {
  it('модель собрана из корня и части; открытие ничего не пишет', async () => {
    const bench = makeBench(ROOT, { 'a.lines': PART_A });
    await bench.settle();

    expect(texts(bench.handle)).toEqual(['intro', 'alpha', 'beta', 'outro']);
    expect(bench.handle.document.getComposition?.()?.parts).toEqual([idOfPath('a.lines')]);
    expect(bench.partWrites).toEqual([]);
    expect(bench.rootWrites).toEqual([]);
  });

  it('правка узла части пишет только файл части; отмена возвращает его', async () => {
    const bench = makeBench(ROOT, { 'a.lines': PART_A });
    bench.handle.apply(setLineText('n2', 'ALPHA'));
    await bench.settle();

    expect(bench.files.get('a.lines')).toBe('n2 ALPHA\nn3 beta');
    expect(bench.rootWrites).toEqual([]);

    bench.handle.undo();
    await bench.settle();
    expect(bench.files.get('a.lines')).toBe(PART_A);
    expect(texts(bench.handle)).toEqual(['intro', 'alpha', 'beta', 'outro']);
  });

  it('«собрать» — одна запись истории: часть ждёт удаления, отмена её возвращает', async () => {
    const bench = makeBench(ROOT, { 'a.lines': PART_A });
    expect(bench.handle.restructure?.('join')).toBe(true);
    await bench.settle();

    expect(bench.handle.document.getModel().lines.map((l) => l.text)).toEqual([
      'intro',
      'alpha',
      'beta',
      'outro',
    ]);
    expect(bench.rootWrites.at(-1)).toBe('n1 intro\nn2 alpha\nn3 beta\nn9 outro');
    expect(bench.handle.parts()).toEqual([]);
    expect(bench.handle.removedParts()).toEqual([idOfPath('a.lines')]);
    // Повторно собирать нечего.
    expect(bench.handle.restructure?.('join')).toBe(false);

    bench.handle.undo();
    await bench.settle();
    expect(bench.rootWrites.at(-1)).toBe(ROOT);
    expect(bench.handle.removedParts()).toEqual([]);
    expect(bench.handle.parts()).toEqual([idOfPath('a.lines')]);
  });

  it('подписчик видит части ТОЙ модели, о которой уведомили', () => {
    const bench = makeBench(ROOT, { 'a.lines': PART_A });
    const seen: number[] = [];
    bench.handle.document.onDidChangeModel(() => {
      seen.push(bench.handle.document.getComposition?.()?.parts.length ?? -1);
    });
    bench.handle.restructure?.('join');
    bench.handle.undo();
    // Команды редактора решают «доступна ли» по числу частей из снимка, взятого в уведомлении.
    expect(seen).toEqual([0, 1]);
  });

  it('«разбить» создаёт файл для безфайловых узлов', async () => {
    const bench = makeBench('n1 intro', {});
    expect(bench.handle.restructure?.('split')).toBe(true);
    await bench.settle();

    expect(bench.files.get('new.lines')).toBe('n1 intro');
    expect(bench.rootWrites.at(-1)).toBe('r1 @new.lines');
  });

  it('forgetRemoved снимает удалённое сохранением', async () => {
    const bench = makeBench(ROOT, { 'a.lines': PART_A });
    bench.handle.restructure?.('join');
    bench.handle.forgetRemoved([idOfPath('a.lines')]);
    expect(bench.handle.removedParts()).toEqual([]);
  });

  it('правка части со стороны пересобирает модель; своя запись — нет', async () => {
    const bench = makeBench(ROOT, { 'a.lines': PART_A });
    const before = bench.handle.document.getModel();

    // Своя запись вернулась событием — модель та же по ссылке.
    bench.handle.apply(setLineText('n3', 'BETA'));
    await bench.settle();
    const own = bench.handle.document.getModel();
    await bench.touch('a.lines', bench.files.get('a.lines') as string);
    expect(bench.handle.document.getModel()).toBe(own);
    expect(own).not.toBe(before);

    await bench.touch('a.lines', 'n2 alpha\nn3 gamma');
    expect(texts(bench.handle)).toEqual(['intro', 'alpha', 'gamma', 'outro']);
  });

  it('битая часть — расхождение; починка его снимает', async () => {
    const bench = makeBench(ROOT, { 'a.lines': PART_A });
    await bench.touch('a.lines', 'не строка формата');
    expect(bench.handle.document.getSyncState()).toBe('diverged');
    expect(bench.handle.apply(setLineText('n1', 'x')).status).toBe('rejected');

    await bench.touch('a.lines', PART_A);
    expect(bench.handle.document.getSyncState()).toBe('synced');
  });
});

function idOfPath(path: string): ResourceId {
  return makeResourceId(SOURCE_ID, path);
}
