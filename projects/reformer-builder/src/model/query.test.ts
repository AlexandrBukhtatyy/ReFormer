import { describe, expect, it } from 'vitest';
import {
  findByPath,
  parentNodePath,
  collectModelPaths,
  collectOperatorNames,
  walkNodes,
} from './query';
import { sampleSchema, P } from './__fixtures__/sample-schema';

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
