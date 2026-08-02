import { describe, it, expect } from 'vitest';
import { createRenderSchema } from './render-schema-proxy';
import { analyzeSelectors } from './render-node';
import type { RenderNode } from './types';

const C = (): null => null;

// Дерево: root(container) → [email(field), section(container) → [city(field)]].
const tree = {
  selector: 'root',
  component: C,
  children: [
    { selector: 'email', value: { __path: 'email' }, component: C },
    {
      selector: 'section',
      component: C,
      children: [{ selector: 'city', value: { __path: 'city' }, component: C }],
    },
  ],
} as unknown as RenderNode<unknown>;

describe('analyzeSelectors', () => {
  it('собирает известные селекторы по СТРУКТУРЕ (рекурсия children)', () => {
    const proxy = createRenderSchema(() => tree);
    const { known } = analyzeSelectors(tree, proxy.__overrideMaps);
    expect(known).toEqual(['city', 'email', 'root', 'section']);
  });

  it('missing — адресованные (node(...)) селекторы, которых нет в дереве', () => {
    const proxy = createRenderSchema(() => tree);
    proxy.node('section').setHidden(true); // известный
    proxy.node('typo-xyz').patchProps({ x: 1 }); // промах
    const { missing } = analyzeSelectors(tree, proxy.__overrideMaps);
    expect(missing).toEqual(['typo-xyz']);
  });

  it('нет промахов, если все адресованные селекторы есть в дереве', () => {
    const proxy = createRenderSchema(() => tree);
    proxy.node('email').setHidden(true);
    proxy.node('city').patchProps({ label: 'X' });
    const { missing } = analyzeSelectors(tree, proxy.__overrideMaps);
    expect(missing).toEqual([]);
  });
});
