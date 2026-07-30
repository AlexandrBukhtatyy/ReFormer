import { describe, expect, it } from 'vitest';
import {
  findByPath,
  parentNodePath,
  collectModelPaths,
  collectOperatorNames,
  walkNodes,
  siblingInfo,
  firstChildPath,
  navTarget,
} from './query';
import { sampleSchema, P } from './__fixtures__/sample-schema';

describe('навигация (siblingInfo / firstChildPath / navTarget)', () => {
  it('siblingInfo: позиция среди соседей', () => {
    const s = sampleSchema();
    expect(siblingInfo(s, P.step0field0)).toEqual({
      slotPath: [...P.step0children],
      index: 0,
      count: 2,
    });
    expect(siblingInfo(s, P.step0field1)?.index).toBe(1);
    // шаги wizard — соседи в слоте steps
    expect(siblingInfo(s, P.step0)).toEqual({ slotPath: [...P.steps], index: 0, count: 2 });
    // корень не в массив-слоте
    expect(siblingInfo(s, P.root)).toBeNull();
  });

  it('firstChildPath: первый ребёнок', () => {
    const s = sampleSchema();
    expect(firstChildPath(s, P.root)).toEqual([...P.step0]); // steps[0]
    expect(firstChildPath(s, P.step0)).toEqual([...P.step0field0]);
    expect(firstChildPath(s, P.step0field0)).toBeNull(); // лист без детей
  });

  it('navTarget: up/down соседи, left родитель, right ребёнок', () => {
    const s = sampleSchema();
    expect(navTarget(s, P.step0field0, 'down')).toEqual([...P.step0field1]);
    expect(navTarget(s, P.step0field1, 'up')).toEqual([...P.step0field0]);
    expect(navTarget(s, P.step0field0, 'up')).toBeNull(); // первый
    expect(navTarget(s, P.step0field0, 'left')).toEqual([...P.step0]);
    expect(navTarget(s, P.step0, 'right')).toEqual([...P.step0field0]);
    expect(navTarget(s, P.step0, 'down')).toEqual([...P.step1]);
    expect(navTarget(s, P.root, 'left')).toBeNull(); // у корня нет родителя
  });
});

describe('findByPath', () => {
  it('возвращает узел', () => {
    const s = sampleSchema();
    expect(findByPath(s, P.array)?.selector).toBe('properties-array');
  });
  it('undefined для не-узла (componentProps)', () => {
    const s = sampleSchema();
    expect(findByPath(s, ['root', 'componentProps'])).toBeUndefined();
  });
});

describe('parentNodePath', () => {
  it('поле → шаг', () => {
    expect(parentNodePath(P.step0field0)).toEqual([...P.step0]);
  });
  it('шаг (в componentProps.steps) → корень', () => {
    expect(parentNodePath(P.step0)).toEqual([...P.root]);
  });
  it('шаблон массива → узел-массив', () => {
    expect(parentNodePath(P.arrayTemplate)).toEqual([...P.array]);
  });
  it('корень → null', () => {
    expect(parentNodePath(P.root)).toBeNull();
  });
  it('wrapper → поле', () => {
    expect(parentNodePath(['root', 'children', 0, 'wrapper'])).toEqual(['root', 'children', 0]);
  });
});

describe('collectModelPaths', () => {
  it('верхнеуровневые $model, без относительных путей из шаблона массива', () => {
    const s = sampleSchema();
    const paths = collectModelPaths(s);
    expect(paths).toEqual(['loanType', 'loanAmount', 'properties']);
    // 'type' из item.$template НЕ попадает
    expect(paths).not.toContain('type');
  });
});

describe('collectOperatorNames', () => {
  it('собирает имена $component/$dataSource из всего дерева (включая шаблон)', () => {
    const s = sampleSchema();
    const n = collectOperatorNames(s);
    expect(n.components).toEqual(
      expect.arrayContaining(['RendererFormWizard', 'Step', 'Select', 'Input', 'Box'])
    );
    expect(n.dataSources).toEqual(expect.arrayContaining(['LOAN_TYPES', 'PROP_LABEL']));
    expect(n.fns).toEqual([]);
    expect(n.locales).toEqual([]);
  });
});

describe('walkNodes', () => {
  it('обходит все узлы дерева', () => {
    const s = sampleSchema();
    const visited: string[] = [];
    walkNodes(s, (_node, path) => visited.push(path.join('.')));
    // root + 2 шага + 2 поля шага0 + 1 массив + 1 шаблон-Box + 1 поле шаблона = 8
    expect(visited).toHaveLength(8);
    expect(visited[0]).toBe('root');
  });
});
