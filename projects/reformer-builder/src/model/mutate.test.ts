import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import {
  setComponentProp,
  setNodeKey,
  insertNode,
  appendNode,
  removeNode,
  moveNode,
  duplicateNode,
  wrapInHtmlDiv,
} from './mutate';
import { getAt } from './paths';
import { sampleSchema, P } from './__fixtures__/sample-schema';

const field = (model: string): JsonNode => ({
  value: `$model(${model})` as `$model(${string})`,
  component: '$component(Input)',
  componentProps: { label: model },
});

describe('setComponentProp', () => {
  it('правит проп, newPath = путь узла, оригинал цел', () => {
    const s = sampleSchema();
    const { schema, newPath } = setComponentProp(s, P.step0field0, 'label', 'Тип');
    expect(getAt(schema, [...P.step0field0, 'componentProps', 'label'])).toBe('Тип');
    expect(newPath).toEqual([...P.step0field0]);
    expect(getAt(s, [...P.step0field0, 'componentProps', 'label'])).toBe('Тип кредита');
  });

  it('undefined удаляет проп', () => {
    const s = sampleSchema();
    const { schema } = setComponentProp(s, P.step0field1, 'type', undefined);
    expect(getAt(schema, [...P.step0field1, 'componentProps', 'type'])).toBeUndefined();
  });
});

describe('setNodeKey', () => {
  it('ставит selector', () => {
    const s = sampleSchema();
    const { schema } = setNodeKey(s, P.step0field0, 'selector', 'loan-type');
    expect(getAt(schema, [...P.step0field0, 'selector'])).toBe('loan-type');
  });
});

describe('insertNode / appendNode', () => {
  it('вставка в children на индекс', () => {
    const s = sampleSchema();
    const { schema, newPath } = insertNode(s, P.step0children, 1, field('mid'));
    const children = getAt(schema, P.step0children) as JsonNode[];
    expect(children).toHaveLength(3);
    expect((children[1] as { value?: string }).value).toBe('$model(mid)');
    expect(newPath).toEqual([...P.step0children, 1]);
  });

  it('индекс за пределами → в конец', () => {
    const s = sampleSchema();
    const { newPath } = insertNode(s, P.step0children, 99, field('last'));
    expect(newPath).toEqual([...P.step0children, 2]);
  });

  it('appendNode добавляет в конец', () => {
    const s = sampleSchema();
    const { schema, newPath } = appendNode(s, P.step0children, field('tail'));
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(3);
    expect(newPath).toEqual([...P.step0children, 2]);
  });

  it('создаёт слот children, если его не было', () => {
    const s = sampleSchema();
    // у array-узла нет children — вставка создаст массив
    const slot = [...P.array, 'children'];
    const { schema } = insertNode(s, slot, 0, field('x'));
    expect(getAt(schema, slot) as JsonNode[]).toHaveLength(1);
  });
});

describe('removeNode', () => {
  it('удаляет узел, выделение → родитель', () => {
    const s = sampleSchema();
    const { schema, newPath } = removeNode(s, P.step0field0);
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(1);
    expect(newPath).toEqual([...P.step0]);
  });
});

describe('moveNode', () => {
  it('перемещение внутри одного слота в конец (компенсация индекса)', () => {
    const s = sampleSchema();
    // переместить field0 на позицию 2 (в конец из двух) → должен встать последним
    const { schema, newPath } = moveNode(s, P.step0field0, P.step0children, 2);
    const children = getAt(schema, P.step0children) as JsonNode[];
    expect(children).toHaveLength(2);
    expect((children[0] as { value?: string }).value).toBe('$model(loanAmount)');
    expect((children[1] as { value?: string }).value).toBe('$model(loanType)');
    expect(newPath).toEqual([...P.step0children, 1]);
  });

  it('перемещение между слотами разных шагов', () => {
    const s = sampleSchema();
    const { schema, newPath } = moveNode(s, P.step0field1, P.step1children, 0);
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(1);
    const step1 = getAt(schema, P.step1children) as JsonNode[];
    expect(step1).toHaveLength(2);
    expect((step1[0] as { value?: string }).value).toBe('$model(loanAmount)');
    expect(newPath).toEqual([...P.step1children, 0]);
  });
});

describe('duplicateNode', () => {
  it('вставляет глубокую копию сразу после оригинала', () => {
    const s = sampleSchema();
    const { schema, newPath } = duplicateNode(s, P.step0field0);
    const children = getAt(schema, P.step0children) as JsonNode[];
    expect(children).toHaveLength(3);
    expect((children[1] as { value?: string }).value).toBe('$model(loanType)');
    expect(children[1]).not.toBe(children[0]); // именно копия
    expect(newPath).toEqual([...P.step0children, 1]);
  });
});

describe('wrapInHtmlDiv', () => {
  it('оборачивает узел в $html(div) flex-группу, newPath ведёт внутрь', () => {
    const s = sampleSchema();
    const { schema, newPath } = wrapInHtmlDiv(s, P.step0field0);
    const group = getAt(schema, P.step0field0) as {
      component: string;
      componentProps: { className: string };
      children: Array<{ value?: string }>;
    };
    expect(group.component).toBe('$html(div)');
    expect(group.componentProps.className).toBe('flex gap-4');
    expect(group.children).toHaveLength(1);
    expect(group.children[0].value).toBe('$model(loanType)');
    expect(newPath).toEqual([...P.step0field0, 'children', 0]);
  });
});
