import { describe, expect, it, vi } from 'vitest';

import { makeResourceId, type ResourceId } from '../../primitives/resource';
import type { SaveResult } from '../workspace';
import {
  ALWAYS_PARSES,
  applyMergeCommit,
  commitFor,
  loadMergeSides,
  MergeChoiceError,
  planMerge,
  type MergeReader,
  type MergeSides,
  type MergeWriter,
  type VerifyText,
} from './resolve';

const id = makeResourceId('mem', 'src/form/schema.json');

const sidesOf = (partial: Partial<MergeSides>): MergeSides => ({
  base: 'a\nb\nc',
  ours: 'a\nb\nc',
  theirs: 'a\nb\nc',
  theirsRevision: 'r9',
  ...partial,
});

/** Разбор, который отказывает на всём: так проверяется обязательность повторного разбора. */
const NEVER_PARSES: VerifyText = () => ({ ok: false, message: 'json.unexpected-token' });

const okSave: SaveResult = { ok: true, saved: [id], conflicts: [], failures: [] };

describe('план слияния', () => {
  it('стороны совпали посимвольно — вопроса нет, принимаем ревизию', () => {
    const plan = planMerge(sidesOf({ ours: 'одно и то же', theirs: 'одно и то же' }));
    expect(plan).toEqual({ kind: 'identical', text: 'одно и то же', revision: 'r9' });
  });

  it('непересекающиеся правки сливаются сами', () => {
    const plan = planMerge(
      sidesOf({ base: 'a\nb\nc', ours: 'A\nb\nc', theirs: 'a\nb\nC' }),
      ALWAYS_PARSES
    );
    expect(plan.kind).toBe('auto');
    if (plan.kind !== 'auto') throw new Error('ожидалось автослияние');
    expect(plan.text).toBe('A\nb\nC');
  });

  it('пересекающиеся правки — вопрос, а не выбор стороны', () => {
    const plan = planMerge(sidesOf({ base: 'b', ours: 'наше', theirs: 'их' }));
    expect(plan.kind).toBe('ask');
    if (plan.kind !== 'ask') throw new Error('ожидался вопрос');
    expect(plan.reason).toBe('conflict');
    expect(plan.merged?.conflicts).toBe(1);
  });

  it('слилось, но не разобралось — тоже вопрос, и с причиной разбора', () => {
    const plan = planMerge(
      sidesOf({ base: 'a\nb\nc', ours: 'A\nb\nc', theirs: 'a\nb\nC' }),
      NEVER_PARSES
    );
    expect(plan.kind).toBe('ask');
    if (plan.kind !== 'ask') throw new Error('ожидался вопрос');
    expect(plan.reason).toBe('unparsable');
    expect(plan.failure).toBe('json.unexpected-token');
    // Слитый текст остаётся при вопросе: с него начнётся ручное слияние.
    expect(plan.merged?.text).toBe('A\nb\nC');
  });

  it('разбор зовётся ровно на слитом тексте, а не на сторонах', () => {
    const verify = vi.fn(() => ({ ok: true }) as const);
    planMerge(sidesOf({ base: 'a\nb\nc', ours: 'A\nb\nc', theirs: 'a\nb\nC' }), verify);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('A\nb\nC');
  });

  it('разбор не зовётся, когда слияние и так упёрлось в конфликт', () => {
    const verify = vi.fn(() => ({ ok: true }) as const);
    planMerge(sidesOf({ base: 'b', ours: 'наше', theirs: 'их' }), verify);
    expect(verify).not.toHaveBeenCalled();
  });

  it('без провайдера модели разбор считается успешным, а не пропускается молча', () => {
    const plan = planMerge(sidesOf({ base: 'a\nb', ours: 'A\nb', theirs: 'a\nB' }));
    expect(plan.kind).toBe('auto');
  });

  it('основания нет — вопрос, даже если тексты похожи', () => {
    const plan = planMerge(sidesOf({ base: null, ours: 'a\nb', theirs: 'a\nc' }));
    expect(plan.kind).toBe('ask');
    if (plan.kind !== 'ask') throw new Error('ожидался вопрос');
    expect(plan.reason).toBe('no-base');
    expect(plan.merged).toBeDefined();
  });

  it('основания нет, но стороны совпали — спрашивать всё равно не о чем', () => {
    const plan = planMerge(sidesOf({ base: null, ours: 'ровно то же', theirs: 'ровно то же' }));
    expect(plan.kind).toBe('identical');
  });

  it('файл исчез из источника — вопрос без слияния: сливать не с чем', () => {
    const plan = planMerge(sidesOf({ theirs: null, ours: 'наше' }));
    expect(plan.kind).toBe('ask');
    if (plan.kind !== 'ask') throw new Error('ожидался вопрос');
    expect(plan.reason).toBe('gone');
    expect(plan.merged).toBeUndefined();
  });

  it('правка против удаления строки — вопрос', () => {
    const plan = planMerge(sidesOf({ base: 'a\nb\nc', ours: 'a\nПРАВКА\nc', theirs: 'a\nc' }));
    expect(plan.kind).toBe('ask');
    if (plan.kind !== 'ask') throw new Error('ожидался вопрос');
    expect(plan.reason).toBe('conflict');
  });
});

describe('сбор сторон', () => {
  function reader(over: Partial<MergeReader> = {}): MergeReader & { readonly order: string[] } {
    const order: string[] = [];
    return {
      order,
      readBase: vi.fn(() => {
        order.push('base');
        return Promise.resolve<string | null>('основание');
      }),
      readText: vi.fn(() => {
        order.push('ours');
        return Promise.resolve('наше');
      }),
      readSourceText: vi.fn(() => {
        order.push('theirs');
        return Promise.resolve<{ text: string; revision?: string } | null>({
          text: 'их',
          revision: 'r42',
        });
      }),
      ...over,
    };
  }

  it('собирает три стороны и подпись версии источника', async () => {
    const sides = await loadMergeSides(reader(), id);
    expect(sides).toEqual({
      base: 'основание',
      ours: 'наше',
      theirs: 'их',
      theirsRevision: 'r42',
    });
  });

  it('ревизия берётся из ЧТЕНИЯ источника, а не из отказа-конфликта', async () => {
    // Источник уехал ещё раз после отказа: r9 из отказа устарел, актуален r42.
    const sides = await loadMergeSides(reader(), id);
    expect(sides.theirsRevision).toBe('r42');
  });

  it('источник спрашивается последним: он единственный дорогой', async () => {
    const source = reader();
    await loadMergeSides(source, id);
    expect(source.order).toEqual(['base', 'ours', 'theirs']);
  });

  it('нет основания — `null`, а не пустая строка', async () => {
    const sides = await loadMergeSides(reader({ readBase: () => Promise.resolve(null) }), id);
    expect(sides.base).toBeNull();
  });

  it('файла в источнике нет — `null` и без ревизии', async () => {
    const sides = await loadMergeSides(reader({ readSourceText: () => Promise.resolve(null) }), id);
    expect(sides.theirs).toBeNull();
    expect(sides.theirsRevision).toBeUndefined();
  });
});

describe('исход выбора', () => {
  it('взять источник — принятие без записи в него', () => {
    expect(commitFor('theirs', sidesOf({ theirs: 'их' }))).toEqual({
      kind: 'adopt',
      text: 'их',
      expected: 'r9',
    });
  });

  it('оставить свою — запись поверх ревизии источника', () => {
    expect(commitFor('ours', sidesOf({ ours: 'наше' }))).toEqual({
      kind: 'push',
      text: 'наше',
      expected: 'r9',
    });
  });

  it('ручное слияние — запись переданного текста', () => {
    expect(commitFor('merged', sidesOf({}), 'слитое')).toEqual({
      kind: 'push',
      text: 'слитое',
      expected: 'r9',
    });
  });

  it('взять источник, которого нет, нельзя', () => {
    expect(() => commitFor('theirs', sidesOf({ theirs: null }))).toThrow(MergeChoiceError);
  });

  it('ручное слияние без текста — ошибка вызывающего, а не пустая запись', () => {
    expect(() => commitFor('merged', sidesOf({}))).toThrow(MergeChoiceError);
  });
});

describe('запись исхода', () => {
  function writer(save: SaveResult = okSave): MergeWriter & { readonly calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      writeText: vi.fn((_id: ResourceId, text: string) => {
        calls.push(`write:${text}`);
        return Promise.resolve();
      }),
      save: vi.fn((_id?: ResourceId, options?: { expected?: string }) => {
        calls.push(`save:${options?.expected ?? '-'}`);
        return Promise.resolve(save);
      }),
      acceptExternal: vi.fn((_id: ResourceId, text: string, revision?: string) => {
        calls.push(`accept:${text}:${revision ?? '-'}`);
        return Promise.resolve();
      }),
    };
  }

  it('принятие источника не пишет в источник вовсе', async () => {
    const w = writer();
    const result = await applyMergeCommit(w, id, {
      kind: 'adopt',
      text: 'их',
      expected: 'r42',
    });
    expect(result).toEqual({ status: 'done' });
    expect(w.calls).toEqual(['accept:их:r42']);
  });

  it('запись идёт через рабочую копию и общий save — второго канала наружу нет', async () => {
    const w = writer();
    await applyMergeCommit(w, id, { kind: 'push', text: 'слитое', expected: 'r42' });
    expect(w.calls).toEqual(['write:слитое', 'save:r42']);
  });

  it('источник уехал ещё раз, пока человек думал — это конфликт, а не успех', async () => {
    const w = writer({
      ok: false,
      saved: [],
      conflicts: [{ id, expected: 'r42', actual: 'r43' }],
      failures: [],
    });
    const result = await applyMergeCommit(w, id, {
      kind: 'push',
      text: 'слитое',
      expected: 'r42',
    });
    expect(result).toEqual({
      status: 'conflict',
      conflict: { id, expected: 'r42', actual: 'r43' },
    });
  });

  it('отказ записи не выдаётся за успех', async () => {
    const w = writer({
      ok: false,
      saved: [],
      conflicts: [],
      failures: [{ id, kind: 'network', message: 'нет сети' }],
    });
    const result = await applyMergeCommit(w, id, { kind: 'push', text: 'x', expected: 'r1' });
    expect(result).toEqual({ status: 'failed', message: 'нет сети' });
  });
});
