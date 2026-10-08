/**
 * Вопрос о расхождении — на настоящей рабочей области, против подставных хранилищ и источника.
 *
 * Чистые части (слияние, план, запись исхода) проверены рядом с собой. Здесь — то, ради чего
 * модуль написан: сохранение, упёршееся в конфликт, обязано кончиться вопросом, а ответ —
 * записью. До него конфликт был тупиком: файл «изменён снаружи», и сделать с этим нечего.
 *
 * @module shell/boot/project/merge-flow.test
 */

import { describe, expect, it, vi } from 'vitest';

import { makeResourceId, type ResourceId } from '@reformer/builder-plugin-api/internal';
import {
  createDivergenceWatch,
  type DivergenceWatch,
} from '@/shell/platform/workspace/merge/divergence';
import { ALWAYS_PARSES, type VerifyText } from '@/shell/platform/workspace/merge/resolve';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createWorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import {
  createMemoryIndexedDb,
  createMemoryOpfs,
} from '@/shell/platform/workspace/storage/testing';
import { createMemorySource, type MemorySource } from '@/shell/platform/workspace/testing';
import { createWorkspace, type Workspace } from '@/shell/platform/workspace/workspace';
import { createMergeFlow, type MergeFlow } from './merge-flow';

interface Harness {
  readonly ws: Workspace;
  readonly source: MemorySource;
  readonly divergence: DivergenceWatch;
  readonly flow: MergeFlow;
  rid(path: string): ResourceId;
  /** Сохранение так, как его зовёт сессия: конфликт уходит в наблюдение и в очередь вопросов. */
  save(id?: ResourceId): Promise<void>;
}

let seq = 0;

function harness(
  initial: Readonly<Record<string, string>>,
  verify: VerifyText = ALWAYS_PARSES
): Harness {
  seq += 1;
  const id = `flow${seq}`;
  const source = createMemorySource(initial);
  const files = createWorkspaceFileStore(id, { directory: createMemoryOpfs().directory });
  const meta = createWorkspaceMetaStore({
    factory: createMemoryIndexedDb().factory,
    databaseName: `ws-flow-${seq}`,
    estimate: async () => ({ usage: 0, quota: 1_000_000 }),
  });
  let clock = 0;
  const ws = createWorkspace({ id, source, files, meta, now: () => (clock += 1) });
  const divergence = createDivergenceWatch({ workspace: ws });
  const flow = createMergeFlow({
    workspace: ws,
    divergence,
    isDirty: (resource) => ws.isDirty(resource),
    verifyOf: () => verify,
  });
  return {
    ws,
    source,
    divergence,
    flow,
    rid: (path) => makeResourceId(source.id, path),
    async save(resource) {
      const result = await ws.save(resource);
      if (result.conflicts.length === 0) return;
      divergence.noteConflicts(result.conflicts);
      await flow.ask(result.conflicts.map((conflict) => conflict.id));
    },
  };
}

/** Три строки: правка первой и правка третьей не пересекаются. */
const BASE = 'первая\nвторая\nтретья\n';

async function edited(h: Harness, path: string, ours: string, theirs: string): Promise<ResourceId> {
  const id = h.rid(path);
  await h.ws.open(id);
  await h.ws.writeText(id, ours);
  h.source.put(path, theirs);
  return id;
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('сохранение наткнулось на файл, изменённый в источнике', () => {
  it('кончается вопросом с тремя сторонами, а не тупиком', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');

    await h.save(id);

    const question = h.flow.get();
    expect(question).toMatchObject({ id, name: 'a.txt', path: 'a.txt' });
    expect(question?.sides).toMatchObject({
      base: BASE,
      ours: 'НАША\nвторая\nтретья\n',
      theirs: 'ИХ\nвторая\nтретья\n',
    });
    expect(question?.plan).toMatchObject({ kind: 'ask', reason: 'conflict' });
    // Источник при этом не тронут: вопрос — не запись.
    expect(h.source.textOf('a.txt')).toBe('ИХ\nвторая\nтретья\n');
  });

  it('спрашивает и тогда, когда правки не пересеклись: слияние приходит готовым исходом', async () => {
    // Молча объединить нельзя: человек правил файл руками в другом редакторе и вправе
    // знать, что с этой правкой стало, — и вправе от неё отказаться.
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'первая\nвторая\nИХ\n');

    await h.save(id);

    expect(h.flow.get()?.plan).toMatchObject({ kind: 'auto', text: 'НАША\nвторая\nИХ\n' });
    expect(h.source.textOf('a.txt')).toBe('первая\nвторая\nИХ\n');
  });

  it('«переписать своей версией» пишет нашу поверх версии источника', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    await h.save(id);

    await h.flow.answer('ours');

    expect(h.source.textOf('a.txt')).toBe('НАША\nвторая\nтретья\n');
    expect(h.flow.get()).toBeNull();
    expect(h.ws.isDirty(id)).toBe(false);
    expect(h.divergence.get().count).toBe(0);
  });

  it('«взять версию источника» меняет рабочую копию и в источник не пишет', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    await h.save(id);
    h.source.forget();

    await h.flow.answer('theirs');

    expect(await h.ws.readText(id)).toBe('ИХ\nвторая\nтретья\n');
    expect(h.source.countOf('write')).toBe(0);
    expect(h.ws.isDirty(id)).toBe(false);
    expect(h.divergence.get().count).toBe(0);
  });

  it('слияние уходит в источник текстом, который выбрал человек', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'первая\nвторая\nИХ\n');
    await h.save(id);

    await h.flow.answer('merged', 'НАША\nвторая\nИХ\n');

    expect(h.source.textOf('a.txt')).toBe('НАША\nвторая\nИХ\n');
    expect(await h.ws.readText(id)).toBe('НАША\nвторая\nИХ\n');
    expect(h.divergence.get().count).toBe(0);
  });

  it('отмена ничего не пишет: расхождение остаётся и спросится при следующем сохранении', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    await h.save(id);

    h.flow.cancel();

    expect(h.flow.get()).toBeNull();
    expect(h.source.textOf('a.txt')).toBe('ИХ\nвторая\nтретья\n');
    expect(await h.ws.readText(id)).toBe('НАША\nвторая\nтретья\n');
    expect(h.divergence.get().count).toBe(1);

    await h.save(id);
    expect(h.flow.get()?.id).toBe(id);
  });

  it('источник переписали тем же содержимым — вопроса нет, наша версия записана', async () => {
    // Ревизия у файловой системы — время изменения: сохранение без правок в другом редакторе
    // её меняет, а текст нет. Спрашивать «переписать ли чужую правку», которой нет, незачем.
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', BASE);

    await h.save(id);

    expect(h.flow.get()).toBeNull();
    expect(h.source.textOf('a.txt')).toBe('НАША\nвторая\nтретья\n');
    expect(h.ws.isDirty(id)).toBe(false);
    expect(h.divergence.get().count).toBe(0);
  });

  it('версии совпали посимвольно — вопроса нет, принимается ревизия источника', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'ОДНО\nвторая\nтретья\n', 'ОДНО\nвторая\nтретья\n');
    const revision = h.source.revisionOf('a.txt');

    await h.save(id);

    expect(h.flow.get()).toBeNull();
    // В источник не записано ничего: там и так лежит то же самое, и его ревизия прежняя.
    expect(h.source.revisionOf('a.txt')).toBe(revision);
    expect(h.ws.isDirty(id)).toBe(false);
    expect(h.divergence.get().count).toBe(0);
  });
});

describe('ответ, который принять нельзя', () => {
  it('ручное слияние, которое не разбирается, в источник не уходит', async () => {
    const verify: VerifyText = (text) =>
      text.includes('{') ? { ok: false, message: 'скобка не закрыта' } : { ok: true };
    const h = harness({ 'a.txt': BASE }, verify);
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    await h.save(id);

    await h.flow.answer('merged', 'слитое {\n');

    // Вопрос остался открытым и говорит почему: набранное человеком не потеряно.
    expect(h.flow.get()?.problem).toEqual({ kind: 'unparsable', message: 'скобка не закрыта' });
    expect(h.source.textOf('a.txt')).toBe('ИХ\nвторая\nтретья\n');
  });

  it('отказ записи оставляет вопрос открытым и называет причину', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    await h.save(id);
    h.source.failNext('write', 'a.txt', 'forbidden');

    await h.flow.answer('ours');

    expect(h.flow.get()?.id).toBe(id);
    expect(h.flow.get()?.problem?.kind).toBe('failed');
    expect(h.source.textOf('a.txt')).toBe('ИХ\nвторая\nтретья\n');
  });

  it('источник уехал ещё раз, пока человек думал, — вопрос задаётся заново, о новой версии', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    await h.save(id);
    h.source.put('a.txt', 'ИХ СНОВА\nвторая\nтретья\n');

    await h.flow.answer('ours');

    expect(h.flow.get()?.sides.theirs).toBe('ИХ СНОВА\nвторая\nтретья\n');
    expect(h.source.textOf('a.txt')).toBe('ИХ СНОВА\nвторая\nтретья\n');

    await h.flow.answer('ours');
    expect(h.source.textOf('a.txt')).toBe('НАША\nвторая\nтретья\n');
    expect(h.flow.get()).toBeNull();
  });
});

describe('несколько файлов', () => {
  it('спрашивает по одному, следующий вопрос — после ответа на текущий', async () => {
    const h = harness({ 'a.txt': BASE, 'b.txt': BASE });
    const a = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    const b = await edited(h, 'b.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');

    await h.save();
    const first = h.flow.get()?.id;
    expect([a, b]).toContain(first);

    await h.flow.answer('ours');
    const second = h.flow.get()?.id;
    expect([a, b]).toContain(second);
    expect(second).not.toBe(first);

    await h.flow.answer('theirs');
    expect(h.flow.get()).toBeNull();
  });

  it('отмена снимает всю очередь: закрывать вопросы по одному незачем', async () => {
    const h = harness({ 'a.txt': BASE, 'b.txt': BASE });
    await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    await edited(h, 'b.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');
    await h.save();

    h.flow.cancel();
    await settle();

    expect(h.flow.get()).toBeNull();
    expect(h.divergence.get().count).toBe(2);
  });
});

describe('файл изменился в источнике, а здесь его не правили', () => {
  it('берётся версия источника — без вопроса и без записи', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = h.rid('a.txt');
    const document = await h.ws.open(id);
    h.source.put('a.txt', 'снаружи\n');
    h.source.forget();

    await h.divergence.check('focus');

    // Принятие идёт следом за проверкой, своим ходом: чтение источника и запись двух слоёв.
    await vi.waitFor(() => {
      expect(h.divergence.get().count).toBe(0);
    });
    expect(document.getText()).toBe('снаружи\n');
    expect(h.flow.get()).toBeNull();
    expect(h.source.countOf('write')).toBe(0);
    expect(h.ws.isDirty(id)).toBe(false);
  });

  it('правленый здесь файл молча не подменяется: расхождение ждёт сохранения', async () => {
    const h = harness({ 'a.txt': BASE });
    const id = await edited(h, 'a.txt', 'НАША\nвторая\nтретья\n', 'ИХ\nвторая\nтретья\n');

    await h.divergence.check('focus');
    await settle();

    expect(await h.ws.readText(id)).toBe('НАША\nвторая\nтретья\n');
    expect(h.divergence.get().count).toBe(1);
    expect(h.flow.get()).toBeNull();
  });
});
