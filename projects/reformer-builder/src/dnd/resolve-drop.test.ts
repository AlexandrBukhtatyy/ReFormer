import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { resolveDrop, performDrop } from './resolve-drop';
import { getAt, kindOf, wrapPairInRow } from '../model';
import { sampleSchema, P } from '../model/__fixtures__/sample-schema';

describe('resolveDrop', () => {
  it('into контейнера → слот children, индекс в конец', () => {
    const s = sampleSchema();
    expect(resolveDrop(s, P.step0, 'into')).toEqual({ slotPath: [...P.step0children], index: 2 });
  });

  it('before/after поля → соседний индекс в родительском слоте', () => {
    const s = sampleSchema();
    expect(resolveDrop(s, P.step0field1, 'before')).toEqual({
      slotPath: [...P.step0children],
      index: 1,
    });
    expect(resolveDrop(s, P.step0field0, 'after')).toEqual({
      slotPath: [...P.step0children],
      index: 1,
    });
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
    expect(
      performDrop(s, P.arrayTemplate, 'into', { kind: 'move', path: [...P.array] })
    ).toBeNull();
  });
});

describe('performDrop beside (создание горизонтального ряда)', () => {
  it('beside-after new из палитры → wrapInRow, цель первой колонкой', () => {
    const s = sampleSchema();
    const res = performDrop(s, P.step0field0, 'beside-after', { kind: 'new', entryName: 'Input' });
    expect(res).not.toBeNull();
    const row = getAt(res!.schema, P.step0field0) as { component: string; children: JsonNode[] };
    expect(row.component).toBe('$html(div)');
    expect(row.children).toHaveLength(2);
    expect(kindOf(row.children[0])).toBe('field');
    expect(res!.newPath).toEqual([...P.step0field0, 'children', 1]);
  });

  it('beside-before move соседа → ряд [перемещённый, цель], источник вырезан', () => {
    const s = sampleSchema();
    const res = performDrop(s, P.step0field0, 'beside-before', {
      kind: 'move',
      path: [...P.step0field1],
    });
    expect(res).not.toBeNull();
    expect(getAt(res!.schema, P.step0children) as JsonNode[]).toHaveLength(1);
    const row = getAt(res!.schema, P.step0field0) as { children: Array<{ value?: string }> };
    expect(row.children.map((c) => c.value)).toEqual(['$model(loanAmount)', '$model(loanType)']);
  });

  it('beside в самого себя/предка → null', () => {
    const s = sampleSchema();
    expect(
      performDrop(s, P.step0field0, 'beside-after', { kind: 'move', path: [...P.step0field0] })
    ).toBeNull();
    expect(
      performDrop(s, P.step0, 'beside-after', { kind: 'move', path: [...P.step0field0] })
    ).toBeNull();
  });
});

describe('performDrop stack (создание вертикального столбца)', () => {
  it('stack-after new из палитры → $html(div) flex-col, цель первой колонкой', () => {
    const s = sampleSchema();
    const res = performDrop(s, P.step0field0, 'stack-after', { kind: 'new', entryName: 'Input' });
    expect(res).not.toBeNull();
    const col = getAt(res!.schema, P.step0field0) as {
      component: string;
      componentProps: { className: string };
      children: JsonNode[];
    };
    expect(col.component).toBe('$html(div)');
    expect(col.componentProps.className).toBe('flex flex-col gap-4');
    expect(col.children).toHaveLength(2);
    expect(kindOf(col.children[0])).toBe('field');
    expect(res!.newPath).toEqual([...P.step0field0, 'children', 1]);
  });

  it('stack-before move соседа → столбец [перемещённый, цель], источник вырезан', () => {
    const s = sampleSchema();
    const res = performDrop(s, P.step0field0, 'stack-before', {
      kind: 'move',
      path: [...P.step0field1],
    });
    expect(res).not.toBeNull();
    expect(getAt(res!.schema, P.step0children) as JsonNode[]).toHaveLength(1);
    const col = getAt(res!.schema, P.step0field0) as {
      componentProps: { className: string };
      children: Array<{ value?: string }>;
    };
    expect(col.componentProps.className).toBe('flex flex-col gap-4');
    expect(col.children.map((c) => c.value)).toEqual(['$model(loanAmount)', '$model(loanType)']);
  });

  it('stack пары в ряду из 2 полей → переворот родителя на месте, БЕЗ нового div', () => {
    // ряд [loanType, loanAmount] на месте step0field0 (обёртка целиком из 2 колонок)
    const row = wrapPairInRow(sampleSchema(), P.step0field0, P.step0field1, 'after').schema;
    const colA = [...P.step0field0, 'children', 0];
    const colB = [...P.step0field0, 'children', 1];
    // перетащить colB на верх colA → stack-before
    const res = performDrop(row, colA, 'stack-before', { kind: 'move', path: colB });
    expect(res).not.toBeNull();
    const div = getAt(res!.schema, P.step0field0) as {
      component: string;
      componentProps: { className: string };
      children: unknown[];
    };
    // тот же div, направление перевёрнуто, детей по-прежнему 2 (нет вложенного div)
    expect(div.component).toBe('$html(div)');
    expect(div.componentProps.className).toBe('flex flex-col gap-4');
    expect(div.children).toHaveLength(2);
    expect(getAt(res!.schema, [...P.step0field0, 'children', 0, 'children'])).toBeUndefined();
  });
});
