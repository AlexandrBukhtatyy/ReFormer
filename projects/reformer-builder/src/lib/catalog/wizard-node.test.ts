/**
 * Wizard как палитровый compound: узел-по-умолчанию должен держать шаги в `componentProps.steps`
 * (а НЕ в `children`), иначе drop/insert уходили бы в `children`, которых рантайм не рендерит.
 *
 * Слот `steps` существует и у визарда БЕЗ шагов — по имени компонента. Раньше он определялся
 * только значением (`steps.some(isNodeLike)`), и визард, из которого удалили последний шаг,
 * становился необратимо сломанным: слот исчезал, вставка уходила в `children`, и вернуть шаги
 * было уже нечем — ни агенту, ни человеку. React-free (node).
 *
 * @module lib/catalog/wizard-node.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { makeNodeFor } from './make-node';
import { childSlots, kindOf } from '../form-model/node-kind';

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

  it('визард с пустым steps сохраняет слот шагов', () => {
    const node = { component: '$component(Wizard)', componentProps: { steps: [] } } as JsonNode;
    const slots = childSlots(node, ['root']);
    expect(slots).toHaveLength(1);
    expect(slots[0].kind).toBe('steps');
    expect(slots[0].entries).toEqual([]);
    expect(slots[0].length).toBe(0);
  });

  it('визард без ключа steps всё равно даёт слот шагов', () => {
    const node = { component: '$component(Wizard)' } as JsonNode;
    expect(childSlots(node, ['root']).map((s) => s.kind)).toEqual(['steps']);
  });

  it('RendererFormWizard из реальных схем — тоже держатель шагов', () => {
    const node = { component: '$component(RendererFormWizard)' } as JsonNode;
    expect(childSlots(node, ['root']).map((s) => s.kind)).toEqual(['steps']);
  });

  it('чужой компонент со steps из НЕ-узлов слота шагов не получает', () => {
    // StepIndicator и подобные держат в steps плоские данные: слот шагов там означал бы
    // drop-зону, кладущую узлы в чужой проп.
    const node = {
      component: '$component(StepIndicator)',
      componentProps: { steps: ['Личные', 'Кредит'] },
    } as JsonNode;
    expect(childSlots(node, ['root']).some((s) => s.kind === 'steps')).toBe(false);
  });

  it('у визарда с обоими слотами steps идёт первым', () => {
    // Порядок — это и есть правило выбора: insertSlotOf берёт первый не-одиночный слот.
    const node = {
      component: '$component(Wizard)',
      componentProps: { steps: [] },
      children: [],
    } as JsonNode;
    expect(childSlots(node, ['root']).map((s) => s.kind)).toEqual(['steps', 'children']);
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
