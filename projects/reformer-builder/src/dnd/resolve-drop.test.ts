import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { resolveDrop, performDrop } from './resolve-drop';
import { getAt, kindOf } from '../model';
import { sampleSchema, P } from '../model/__fixtures__/sample-schema';

describe('resolveDrop', () => {
  it('into контейнера → слот children, индекс в конец', () => {
    const s = sampleSchema();
    expect(resolveDrop(s, P.step0, 'into')).toEqual({ slotPath: [...P.step0children], index: 2 });
  });

  it('before/after поля → соседний индекс в родительском слоте', () => {
    const s = sampleSchema();
    expect(resolveDrop(s, P.step0field1, 'before')).toEqual({ slotPath: [...P.step0children], index: 1 });
    expect(resolveDrop(s, P.step0field0, 'after')).toEqual({ slotPath: [...P.step0children], index: 1 });
  });

  it('into корня-wizard → слот steps', () => {
    const s = sampleSchema();
    expect(resolveDrop(s, P.root, 'into')).toEqual({ slotPath: [...P.steps], index: 2 });
  });

  it('before/after корня невозможно', () => {
    expect(resolveDrop(sampleSchema(), P.root, 'before')).toBeNull();
  });
});

describe('performDrop', () => {
  it('new из палитры → insertNode с узлом нужного вида', () => {
    const s = sampleSchema();
    const res = performDrop(s, P.step0, 'into', { kind: 'new', entryName: 'Input' });
    expect(res).not.toBeNull();
    const node = getAt(res!.schema, res!.newPath) as JsonNode;
    expect(kindOf(node)).toBe('field');
    expect(res!.newPath).toEqual([...P.step0children, 2]);
  });

  it('move → moveNode (перестановка соседей)', () => {
    const s = sampleSchema();
    // переместить field1 (loanAmount) ПЕРЕД field0 (loanType) — реальная перестановка
    const res = performDrop(s, P.step0field0, 'before', { kind: 'move', path: [...P.step0field1] });
    expect(res).not.toBeNull();
    const children = getAt(res!.schema, P.step0children) as JsonNode[];
    expect((children[0] as { value?: string }).value).toBe('$model(loanAmount)');
    expect((children[1] as { value?: string }).value).toBe('$model(loanType)');
  });

  it('move в самого себя/потомка → null', () => {
    const s = sampleSchema();
    // шаг в самого себя
    expect(performDrop(s, P.step0, 'into', { kind: 'move', path: [...P.step0] })).toBeNull();
    // массив в свой же шаблон
    expect(performDrop(s, P.arrayTemplate, 'into', { kind: 'move', path: [...P.array] })).toBeNull();
  });
});
