import { describe, expect, it } from 'vitest';
import { makeNodeFor, leafComponentNode } from './make-node';

describe('makeNodeFor — листовые компоненты', () => {
  it('Icon — без children и без space-y-4 (лист)', () => {
    const node = makeNodeFor('Icon', 'container') as Record<string, unknown>;
    expect(node.component).toBe('$component(Icon)');
    expect('children' in node).toBe(false);
    expect(node.componentProps).toEqual({});
  });

  it('прочие leaf-компоненты — тоже без children', () => {
    for (const name of ['Separator', 'Spinner', 'Skeleton', 'Progress']) {
      const node = makeNodeFor(name, 'container') as Record<string, unknown>;
      expect('children' in node).toBe(false);
    }
  });

  it('обычный контейнер (Box) — с пустым children', () => {
    const node = makeNodeFor('Box', 'container') as Record<string, unknown>;
    expect(node.children).toEqual([]);
  });

  it('$html(br) — void-тег без children; $html(div) — контейнер с children', () => {
    const br = makeNodeFor('$html(br)', 'container') as Record<string, unknown>;
    expect('children' in br).toBe(false);
    const div = makeNodeFor('$html(div)', 'container') as Record<string, unknown>;
    expect(div.children).toEqual([]);
  });

  it('leafComponentNode', () => {
    expect(leafComponentNode('Icon')).toEqual({
      component: '$component(Icon)',
      componentProps: {},
    });
  });
});
