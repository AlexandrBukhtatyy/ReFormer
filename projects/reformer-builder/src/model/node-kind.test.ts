import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import {
  kindOf,
  childSlots,
  isNodeLike,
  isLeafComponent,
  canAcceptChildren,
  orientationOf,
} from './node-kind';
import { getAt } from './paths';
import { sampleSchema, P } from './__fixtures__/sample-schema';

describe('kindOf', () => {
  it('различает field / array / container', () => {
    const s = sampleSchema();
    expect(kindOf(getAt(s, P.step0field0) as JsonNode)).toBe('field');
    expect(kindOf(getAt(s, P.array) as JsonNode)).toBe('array');
    expect(kindOf(getAt(s, P.step0) as JsonNode)).toBe('container');
    expect(kindOf(s.root)).toBe('container');
  });
});

describe('childSlots', () => {
  it('контейнер с componentProps.steps → слот steps', () => {
    const s = sampleSchema();
    const slots = childSlots(s.root, P.root);
    const steps = slots.find((x) => x.kind === 'steps');
    expect(steps).toBeDefined();
    expect(steps!.path).toEqual([...P.steps]);
    expect(steps!.nodes).toHaveLength(2);
    expect(steps!.single).toBe(false);
  });

  it('шаг → слот children с полями', () => {
    const s = sampleSchema();
    const slots = childSlots(getAt(s, P.step0) as JsonNode, P.step0);
    expect(slots).toHaveLength(1);
    expect(slots[0].kind).toBe('children');
    expect(slots[0].nodes).toHaveLength(2);
  });

  it('array → одиночный слот template', () => {
    const s = sampleSchema();
    const slots = childSlots(getAt(s, P.array) as JsonNode, P.array);
    expect(slots).toHaveLength(1);
    expect(slots[0].kind).toBe('template');
    expect(slots[0].single).toBe(true);
    expect(slots[0].path).toEqual([...P.arrayTemplate]);
    expect(slots[0].nodes).toHaveLength(1);
  });

  it('поле без wrapper → нет слотов; с wrapper → слот wrapper', () => {
    const s = sampleSchema();
    expect(childSlots(getAt(s, P.step0field0) as JsonNode, P.step0field0)).toHaveLength(0);
    const withWrapper: JsonNode = {
      value: '$model(x)',
      wrapper: { component: '$component(Box)', children: [] },
    };
    const slots = childSlots(withWrapper, ['root']);
    expect(slots[0].kind).toBe('wrapper');
    expect(slots[0].single).toBe(true);
  });
});

describe('isNodeLike / canAcceptChildren', () => {
  it('isNodeLike', () => {
    expect(isNodeLike({ value: '$model(x)' })).toBe(true);
    expect(isNodeLike({ component: '$component(Box)' })).toBe(true);
    expect(isNodeLike({ label: 'x' })).toBe(false);
    expect(isNodeLike([])).toBe(false);
    expect(isNodeLike(null)).toBe(false);
  });

  it('canAcceptChildren: контейнер/массив да, поле нет', () => {
    const s = sampleSchema();
    expect(canAcceptChildren(getAt(s, P.step0) as JsonNode)).toBe(true);
    expect(canAcceptChildren(getAt(s, P.array) as JsonNode)).toBe(true);
    expect(canAcceptChildren(getAt(s, P.step0field0) as JsonNode)).toBe(false);
  });
});

describe('листовые компоненты (не принимают вложенные)', () => {
  const icon: JsonNode = { component: '$component(Icon)', componentProps: { iconName: 'Star' } };
  const separator: JsonNode = { component: '$component(Separator)' };
  const br: JsonNode = { component: '$html(br)' };
  const box: JsonNode = { component: '$component(Box)', children: [] };
  const div: JsonNode = { component: '$html(div)', children: [] };

  it('isLeafComponent: Icon/Separator/$html(br) — да; Box/$html(div) — нет', () => {
    expect(isLeafComponent(icon)).toBe(true);
    expect(isLeafComponent(separator)).toBe(true);
    expect(isLeafComponent(br)).toBe(true);
    expect(isLeafComponent(box)).toBe(false);
    expect(isLeafComponent(div)).toBe(false);
  });

  it('canAcceptChildren: листовые — false (даже если это контейнер-узел)', () => {
    expect(canAcceptChildren(icon)).toBe(false);
    expect(canAcceptChildren(separator)).toBe(false);
    expect(canAcceptChildren(br)).toBe(false);
    expect(canAcceptChildren(box)).toBe(true);
  });

  it('childSlots: у листового — пусто, даже при наличии children', () => {
    const iconWithChildren: JsonNode = { component: '$component(Icon)', children: [] } as JsonNode;
    expect(childSlots(icon, ['root'])).toHaveLength(0);
    expect(childSlots(iconWithChildren, ['root'])).toHaveLength(0);
    expect(childSlots(box, ['root'])).toHaveLength(1);
  });
});

describe('orientationOf', () => {
  const div = (className?: string): JsonNode =>
    ({
      component: '$html(div)',
      ...(className !== undefined ? { componentProps: { className } } : {}),
      children: [],
    }) as JsonNode;

  it('flex без flex-col → horizontal', () => {
    expect(orientationOf(div('flex gap-4'))).toBe('horizontal');
  });
  it('flex flex-col → vertical', () => {
    expect(orientationOf(div('flex flex-col gap-2'))).toBe('vertical');
  });
  it('grid grid-cols-N (N≥2) → horizontal, grid-cols-1 → vertical', () => {
    expect(orientationOf(div('grid grid-cols-2 gap-4'))).toBe('horizontal');
    expect(orientationOf(div('grid grid-cols-1'))).toBe('vertical');
  });
  it('space-y / нет className → vertical', () => {
    expect(orientationOf(div('space-y-6'))).toBe('vertical');
    expect(orientationOf(div())).toBe('vertical');
  });
  it('не-контейнер (поле) → vertical', () => {
    const s = sampleSchema();
    expect(orientationOf(getAt(s, P.step0field0) as JsonNode)).toBe('vertical');
  });
});
