/**
 * Слияние поверх настоящей рабочей области — против подставных OPFS, IndexedDB и источника.
 *
 * Отдельный файл, а не дописка к `workspace.test.ts`: здесь проверяется ШОВ между слиянием
 * и рабочей областью, и главный вопрос у него один — доходят ли до диалога данные, на которых
 * он держится. Колонка «версия источника» существует только потому, что отказ несёт ревизию,
 * а по ревизии можно прочитать содержимое; если хоть одно звено не доехало, диалог показывает
 * пустоту, и никакой тест чистых функций этого не поймает.
 *
 * @module shell/platform/workspace/merge/workspace-merge.test
 */

import { describe, expect, it } from 'vitest';

import { makeResourceId, type ResourceId } from '@/shell/platform/primitives/resource';
import { createWorkspaceMetaStore } from '../storage/idb';
import { createWorkspaceFileStore } from '../storage/opfs';
import { createMemoryIndexedDb, createMemoryOpfs, type MemoryOpfs } from '../storage/testing';
import { createMemorySource, type MemorySource } from '../testing';
import { createWorkspace, type Workspace } from '../workspace';
import { createDivergenceWatch } from './divergence';
import {
  applyMergeCommit,
  commitFor,
  loadMergeSides,
  planMerge,
  resolveDivergence,
} from './resolve';

interface Harness {
  readonly ws: Workspace;
  readonly source: MemorySource;
  readonly opfs: MemoryOpfs;
  rid(path: string): ResourceId;
  layer(which: 'files' | 'base', path: string): string | undefined;
}

let seq = 0;

function makeWorkspace(initial: Readonly<Record<string, string>> = {}): Harness {
  seq += 1;
  const id = `m${seq}`;
  const opfs = createMemoryOpfs();
  const memoryDb = createMemoryIndexedDb();
  const source = createMemorySource(initial);
  const files = createWorkspaceFileStore(id, { directory: opfs.directory });
  const meta = createWorkspaceMetaStore({
    factory: memoryDb.factory,
    databaseName: `ws-merge-${seq}`,
    estimate: async () => ({ usage: 0, quota: 1_000_000 }),
  });
  let clock = 0;
  const ws = createWorkspace({ id, source, files, meta, now: () => (clock += 1) });
  return {
    ws,
    source,
    opfs,
    rid: (path) => makeResourceId(source.id, path),
    layer: (which, path) => opfs.files()[`ws/${id}/${which}/${path}`],
  };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('BASE наружу', () => {
  it('отдаёт содержимое источника, а не рабочую копию', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'правленое');

    expect(await h.ws.readText(id)).toBe('правленое');
    expect(await h.ws.readBase(id)).toBe('исходное');
  });

  it('у локально созданного файла основания нет', async () => {
    const h = makeWorkspace();
    const id = h.rid('new.txt');
    await h.ws.writeText(id, 'создано локально');
    expect(await h.ws.readBase(id)).toBeNull();
  });

  it('у нематериализованного ресурса основания нет, и в источник за ним не ходим', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    h.source.forget();
    expect(await h.ws.readBase(h.rid('a.txt'))).toBeNull();
    expect(h.source.countOf('read')).toBe(0);
  });

  it('после сохранения основанием становится сохранённое', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'правленое');
    await h.ws.save(id);
    expect(await h.ws.readBase(id)).toBe('правленое');
  });
});

describe('версия источника наружу', () => {
  it('читается из источника, а не из рабочей копии', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'наше');
    h.source.put('a.txt', 'их');

    const theirs = await h.ws.readSourceText(id);
    expect(theirs?.text).toBe('их');
    expect(theirs?.revision).toBe(h.source.revisionOf('a.txt'));
    // Рабочая копия не тронута: чтение источника её не подменяет.
    expect(await h.ws.readText(id)).toBe('наше');
  });

  it('исчезнувший файл — `null`, а не отказ', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    h.source.remove('a.txt');
    expect(await h.ws.readSourceText(id)).toBeNull();
  });
});

describe('перепроверка ревизий', () => {
  it('без списка спрашивает только про ОТКРЫТЫЕ, а не про всё материализованное', async () => {
    const h = makeWorkspace({
      'src/schema.ts': "import './rules';\nexport const a = 1;",
      'src/rules.ts': 'export const rules = 1;',
    });
    await h.ws.open(h.rid('src/schema.ts'));
    h.source.forget();

    const checks = await h.ws.checkSource();
    expect(checks.map((check) => check.id)).toEqual([h.rid('src/schema.ts')]);
    // Догруженный сосед по импорту материализован, но `stat` про него не спрашивали.
    expect(h.source.countOf('stat', 'src/rules.ts')).toBe(0);
  });

  it('совпадение ревизий — «совпало», расхождение — «разошлось» с обеими ревизиями', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    const before = h.source.revisionOf('a.txt');

    expect(await h.ws.checkSource()).toEqual([
      { id, status: 'same', expected: before, actual: before },
    ]);

    h.source.put('a.txt', 'снаружи');
    const after = h.source.revisionOf('a.txt');
    expect(await h.ws.checkSource()).toEqual([
      { id, status: 'diverged', expected: before, actual: after },
    ]);
  });

  it('содержимое при перепроверке не тянется — только `stat`', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    await h.ws.open(h.rid('a.txt'));
    h.source.forget();
    h.source.put('a.txt', 'снаружи');
    await h.ws.checkSource();
    expect(h.source.countOf('read')).toBe(0);
    expect(h.source.countOf('stat')).toBe(1);
  });

  it('исчезнувший файл виден как исчезнувший', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    h.source.remove('a.txt');
    expect((await h.ws.checkSource())[0].status).toBe('gone');
  });

  it('можно спросить про закрытые ресурсы явным списком', async () => {
    const h = makeWorkspace({ 'a.txt': 'x', 'b.txt': 'y' });
    await h.ws.readText(h.rid('b.txt'));
    const checks = await h.ws.checkSource([h.rid('b.txt')]);
    expect(checks).toHaveLength(1);
    expect(checks[0].status).toBe('same');
  });

  it('про нематериализованный ресурс ответа нет: расходиться нечему', async () => {
    const h = makeWorkspace({ 'a.txt': 'x' });
    expect(await h.ws.checkSource([h.rid('a.txt')])).toEqual([]);
  });
});

describe('принятие версии источника', () => {
  it('рабочая копия, BASE и ревизия становятся версией источника, изменённость снимается', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    const document = await h.ws.open(id);
    await h.ws.writeText(id, 'наше');
    h.source.put('a.txt', 'их');
    const revision = h.source.revisionOf('a.txt');

    await h.ws.acceptExternal(id, 'их', revision);

    expect(await h.ws.readText(id)).toBe('их');
    expect(await h.ws.readBase(id)).toBe('их');
    expect(h.ws.isDirty(id)).toBe(false);
    // Буфер открытого документа догнал — на этом держится повторный разбор модели.
    expect(document.getText()).toBe('их');
    expect(document.isDirty()).toBe(false);
    await settle();
    expect((await h.ws.checkSource())[0].status).toBe('same');
  });

  it('в источник при этом не пишется ничего', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    h.source.forget();
    await h.ws.acceptExternal(id, 'их', h.source.revisionOf('a.txt'));
    expect(h.source.countOf('write')).toBe(0);
  });

  it('следующее сохранение писать нечего: расхождение закрыто', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.acceptExternal(id, 'их', h.source.revisionOf('a.txt'));
    h.source.forget();
    const result = await h.ws.save(id);
    expect(result.ok).toBe(true);
    expect(result.saved).toEqual([]);
    expect(h.source.countOf('write')).toBe(0);
  });
});

describe('сохранение поверх ревизии источника', () => {
  it('после конфликта сохранение с новой ревизией проходит', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'наше');
    h.source.put('a.txt', 'их');

    const conflicted = await h.ws.save(id);
    expect(conflicted.conflicts).toHaveLength(1);

    const actual = conflicted.conflicts[0].actual;
    const forced = await h.ws.save(id, { expected: actual });
    expect(forced.ok).toBe(true);
    expect(h.source.textOf('a.txt')).toBe('наше');
  });

  it('текст, равный основанию, всё равно записывается: «нечего» здесь неверно', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    h.source.put('a.txt', 'их');
    const actual = h.source.revisionOf('a.txt');

    // Рабочая копия равна BASE — обычный `save` счёл бы, что писать нечего.
    expect(h.ws.isDirty(id)).toBe(false);
    const result = await h.ws.save(id, { expected: actual });
    expect(result.saved).toEqual([id]);
    expect(h.source.textOf('a.txt')).toBe('исходное');
  });

  it('ожидаемая ревизия без ресурса — ошибка вызывающего', async () => {
    const h = makeWorkspace({ 'a.txt': 'x' });
    await expect(h.ws.save(undefined, { expected: 'r1' })).rejects.toThrow(/только вместе/);
  });

  it('чужая ревизия так же даёт конфликт: проверка не отключается, а переносится', async () => {
    const h = makeWorkspace({ 'a.txt': 'исходное' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'наше');
    h.source.put('a.txt', 'их');

    const result = await h.ws.save(id, { expected: 'ревизия-из-прошлой-жизни' });
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].expected).toBe('ревизия-из-прошлой-жизни');
    expect(result.conflicts[0].actual).toBe(h.source.revisionOf('a.txt'));
  });
});

describe('расхождение из конца в конец', () => {
  it('конфликт → три стороны → автослияние → запись, и всё сходится в источнике', async () => {
    const h = makeWorkspace({ 'form.json': '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}' });
    const id = h.rid('form.json');
    await h.ws.open(id);

    // Мы правим первое поле…
    await h.ws.writeText(id, '{\n  "a": 11,\n  "b": 2,\n  "c": 3\n}');
    // …а источник в это время — последнее.
    h.source.put('form.json', '{\n  "a": 1,\n  "b": 2,\n  "c": 33\n}');

    const conflicted = await h.ws.save(id);
    expect(conflicted.ok).toBe(false);
    expect(conflicted.conflicts[0].actual).toBeDefined();

    const watch = createDivergenceWatch({ workspace: h.ws });
    watch.noteConflicts(conflicted.conflicts);
    expect(watch.get().count).toBe(1);

    const sides = await loadMergeSides(h.ws, id);
    expect(sides.base).toBe('{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}');
    expect(sides.ours).toContain('"a": 11');
    expect(sides.theirs).toContain('"c": 33');
    expect(sides.theirsRevision).toBe(h.source.revisionOf('form.json'));

    const plan = planMerge(sides, (text) => {
      try {
        JSON.parse(text);
        return { ok: true };
      } catch (error) {
        return { ok: false, message: String(error) };
      }
    });
    expect(plan.kind).toBe('auto');
    if (plan.kind !== 'auto') throw new Error('ожидалось автослияние');

    const result = await applyMergeCommit(h.ws, id, commitFor('merged', sides, plan.text));
    expect(result).toEqual({ status: 'done' });
    watch.resolve(id);

    expect(JSON.parse(h.source.textOf('form.json') ?? '')).toEqual({ a: 11, b: 2, c: 33 });
    expect(h.ws.isDirty(id)).toBe(false);
    expect(watch.get().count).toBe(0);
    await settle();
    expect((await h.ws.checkSource())[0].status).toBe('same');
  });

  it('спорная правка доезжает до диалога тремя сторонами, а не двумя', async () => {
    const h = makeWorkspace({ 'a.txt': 'общее' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'наше');
    h.source.put('a.txt', 'их');
    await h.ws.save(id);

    const sides = await loadMergeSides(h.ws, id);
    const plan = planMerge(sides);
    expect(plan.kind).toBe('ask');
    if (plan.kind !== 'ask') throw new Error('ожидался вопрос');
    expect(plan.reason).toBe('conflict');
    // Все три колонки диалога есть чем заполнить — ради этого весь шов и существует.
    expect(sides.base).toBe('общее');
    expect(sides.ours).toBe('наше');
    expect(sides.theirs).toBe('их');
  });

  it('полный ход: непересекающиеся правки разрешаются одним вызовом и без вопросов', async () => {
    const h = makeWorkspace({ 'a.txt': 'шапка\nтело\nподвал' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'ШАПКА\nтело\nподвал');
    h.source.put('a.txt', 'шапка\nтело\nПОДВАЛ');
    await h.ws.save(id);

    expect(await resolveDivergence(h.ws, id)).toEqual({ kind: 'resolved', how: 'auto' });
    expect(h.source.textOf('a.txt')).toBe('ШАПКА\nтело\nПОДВАЛ');
  });

  it('полный ход: спорная правка возвращает стороны и план, а не решение', async () => {
    const h = makeWorkspace({ 'a.txt': 'общее' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'наше');
    h.source.put('a.txt', 'их');
    await h.ws.save(id);
    h.source.forget();

    const outcome = await resolveDivergence(h.ws, id);
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') throw new Error('ожидался вопрос');
    expect(outcome.sides.theirs).toBe('их');
    expect(outcome.plan.kind).toBe('ask');
    // Пока не ответили — в источнике ничего не изменилось.
    expect(h.source.countOf('write')).toBe(0);
    expect(h.source.textOf('a.txt')).toBe('их');
  });

  it('полный ход: совпавшие тексты принимают ревизию и не пишут в источник', async () => {
    const h = makeWorkspace({ 'a.txt': 'общее' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    // Оба пришли к одному тексту разными путями — спорить не о чем.
    await h.ws.writeText(id, 'одинаково');
    h.source.put('a.txt', 'одинаково');
    await h.ws.save(id);
    h.source.forget();

    expect(await resolveDivergence(h.ws, id)).toEqual({ kind: 'resolved', how: 'identical' });
    expect(h.source.countOf('write')).toBe(0);
    expect(h.ws.isDirty(id)).toBe(false);
    await settle();
    expect((await h.ws.checkSource())[0].status).toBe('same');
  });

  it('полный ход: слияние не разобралось — вопрос, а не запись', async () => {
    const h = makeWorkspace({ 'form.json': '{\n  "a": 1\n}' });
    const id = h.rid('form.json');
    await h.ws.open(id);
    await h.ws.writeText(id, '{\n  "a": 2\n}');
    h.source.put('form.json', '{\n  "a": 3\n}');
    await h.ws.save(id);
    h.source.forget();

    const outcome = await resolveDivergence(h.ws, id, () => ({
      ok: false,
      message: 'json.unexpected-token',
    }));
    expect(outcome.kind).toBe('ask');
    expect(h.source.countOf('write')).toBe(0);
  });

  it('исход «взять источник» не пишет в источник и закрывает расхождение', async () => {
    const h = makeWorkspace({ 'a.txt': 'общее' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'наше');
    h.source.put('a.txt', 'их');
    await h.ws.save(id);
    h.source.forget();

    const sides = await loadMergeSides(h.ws, id);
    const result = await applyMergeCommit(h.ws, id, commitFor('theirs', sides));

    expect(result).toEqual({ status: 'done' });
    expect(h.source.countOf('write')).toBe(0);
    expect(await h.ws.readText(id)).toBe('их');
    await settle();
    expect((await h.ws.checkSource())[0].status).toBe('same');
  });

  it('источник уехал ещё раз, пока висел диалог — снова конфликт, а не тихая перезапись', async () => {
    const h = makeWorkspace({ 'a.txt': 'общее' });
    const id = h.rid('a.txt');
    await h.ws.open(id);
    await h.ws.writeText(id, 'наше');
    h.source.put('a.txt', 'их');
    await h.ws.save(id);

    const sides = await loadMergeSides(h.ws, id);
    // Пока человек читал три колонки, файл поменялся ещё раз.
    h.source.put('a.txt', 'их, но уже другое');

    const result = await applyMergeCommit(h.ws, id, commitFor('ours', sides));
    expect(result.status).toBe('conflict');
    expect(h.source.textOf('a.txt')).toBe('их, но уже другое');
  });
});
