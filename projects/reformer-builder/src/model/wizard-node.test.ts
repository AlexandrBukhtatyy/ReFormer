/**
 * Wizard как палитровый compound: узел-по-умолчанию должен держать шаги в `componentProps.steps`
 * (а НЕ в `children`), иначе drop/insert уходили бы в `children`, а слот `steps` не появлялся бы
 * (`childSlots` показывает его только при непустом `steps`). React-free (node).
 *
 * @module reformer-builder/model/wizard-node.test
 */

import { describe, expect, it } from 'vitest';
import { makeNodeFor } from '../catalog';
import { childSlots, kindOf } from './node-kind';

/** Прочитать узел как открытую запись (у makeNodeFor тип JsonNode с template-literal `component`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rec = (n: unknown) => n as Record<string, any>;

describe('wizard-узел (Wizard / Step)', () => {
  it('makeNodeFor(Wizard) сеет один шаг в componentProps.steps и не заводит children', () => {
    const node = makeNodeFor('Wizard', 'container');
    expect(rec(node).component).toBe('$component(Wizard)');
    expect(Array.isArray(rec(node).componentProps.steps)).toBe(true);
    expect(rec(node).componentProps.steps).toHaveLength(1);
    expect('children' in rec(node)).toBe(false);
    expect(kindOf(node)).toBe('container');
  });

  it('единственный дочерний слот визарда — steps (не children)', () => {
    const node = makeNodeFor('Wizard', 'container');
    const slots = childSlots(node, ['root']);
    expect(slots).toHaveLength(1);
    expect(slots[0].kind).toBe('steps');
    expect(slots[0].path).toEqual(['root', 'componentProps', 'steps']);
    expect(slots[0].entries).toHaveLength(1);
  });

  it('makeNodeFor(Step) — контейнер с пустым телом и подписью', () => {
    const step = makeNodeFor('Step', 'container');
    expect(rec(step).component).toBe('$component(Step)');
    expect(rec(step).componentProps.title).toBeTruthy();
    expect(rec(step).children).toEqual([]);
    expect(kindOf(step)).toBe('container');
    // тело шага — слот children (сюда падают поля)
    const slots = childSlots(step, ['root']);
    expect(slots.map((s) => s.kind)).toEqual(['children']);
  });
});
