/**
 * Wizard как палитровый compound: шаги — `children` узла-визарда, и для `childSlots` это слот
 * ШАГОВ, а не обычных детей.
 *
 * Слот `steps` существует и у визарда БЕЗ шагов — по имени компонента: шаги лежат в том же
 * `children`, что и дети любого контейнера, и визард, из которого удалили последний шаг, иначе
 * стал бы неотличим от пустого контейнера. React-free (node).
 *
 * @module plugins/reformer/core/catalog/wizard-node.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { makeNodeFor } from './make-node';
import { childSlots, kindOf } from '../form-model/node-kind';

/** Прочитать узел как открытую запись (у makeNodeFor тип JsonNode с template-literal `component`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rec = (n: unknown) => n as Record<string, any>;

describe('wizard-узел (Wizard / Step)', () => {
  it('makeNodeFor(Wizard) сеет один шаг в children и не заводит componentProps.steps', () => {
    const node = makeNodeFor('Wizard', 'container');
    expect(rec(node).component).toBe('$component(Wizard)');
    expect(Array.isArray(rec(node).children)).toBe(true);
    expect(rec(node).children).toHaveLength(1);
    expect(rec(node).componentProps?.steps).toBeUndefined();
    expect(kindOf(node)).toBe('container');
  });

  it('единственный дочерний слот визарда — steps, и лежит он в children', () => {
    const node = makeNodeFor('Wizard', 'container');
    const slots = childSlots(node, ['root']);
    expect(slots).toHaveLength(1);
    expect(slots[0].kind).toBe('steps');
    expect(slots[0].path).toEqual(['root', 'children']);
    expect(slots[0].entries).toHaveLength(1);
  });

  it('визард с пустым children сохраняет слот шагов', () => {
    const node = { component: '$component(Wizard)', children: [] } as JsonNode;
    const slots = childSlots(node, ['root']);
    expect(slots).toHaveLength(1);
    expect(slots[0].kind).toBe('steps');
    expect(slots[0].entries).toEqual([]);
    expect(slots[0].length).toBe(0);
  });

  it('визард без ключа children всё равно даёт слот шагов', () => {
    const node = { component: '$component(Wizard)' } as JsonNode;
    const slots = childSlots(node, ['root']);
    expect(slots.map((s) => s.kind)).toEqual(['steps']);
    expect(slots[0].path).toEqual(['root', 'children']);
  });

  it('RendererFormWizard из реальных схем — тоже держатель шагов', () => {
    const node = { component: '$component(RendererFormWizard)' } as JsonNode;
    expect(childSlots(node, ['root']).map((s) => s.kind)).toEqual(['steps']);
  });

  it('чужой компонент с пропом steps слота шагов не получает', () => {
    // StepIndicator и подобные держат в steps плоские данные: это обычный проп, а не слот.
    const node = {
      component: '$component(StepIndicator)',
      componentProps: { steps: ['Личные', 'Кредит'] },
    } as JsonNode;
    expect(childSlots(node, ['root']).some((s) => s.kind === 'steps')).toBe(false);
  });

  it('ссылки на файлы шагов в слот не попадают, но в длине учтены', () => {
    // `{ "$ref" }` — не узел: позиции узлов рядом с ним съезжать не должны.
    const node = {
      component: '$component(Wizard)',
      children: [{ $ref: './steps/a/form.schema.json' }, makeNodeFor('Step', 'container')],
    } as unknown as JsonNode;
    const [slot] = childSlots(node, ['root']);
    expect(slot.entries.map((entry) => entry.index)).toEqual([1]);
    expect(slot.length).toBe(2);
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
