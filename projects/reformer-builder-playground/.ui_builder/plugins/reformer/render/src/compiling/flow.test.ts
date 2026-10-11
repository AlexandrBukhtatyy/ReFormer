/**
 * Поток шагов модуля против живой схемы: шаги — из схемы, правила — из потока.
 *
 * @module plugins/reformer/render/compiling/flow.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { alignFlow } from './flow';

/** Правила шага: потоку важна ссылка, а не содержимое. */
const rules = (name: string): never => ({ rules: name }) as never;

const DANNYE = rules('данные');
const KONTAKTY = rules('контакты');

/** Поток, как его печатает кодоген: шаг — `selector` узла шага. */
const FLOW = {
  steps: [
    { id: 'dannye-section', rules: DANNYE },
    { id: 'kontakty-section', rules: KONTAKTY },
  ],
};

/** Шаг визарда; без селектора — шаг, добавленный в редакторе после генерации кода. */
function step(selector?: string): JsonNode {
  return {
    component: '$component(Step)',
    ...(selector === undefined ? {} : { selector }),
    children: [],
  } as unknown as JsonNode;
}

/** Схема с визардом из таких шагов. */
function wizard(...steps: readonly JsonNode[]): JsonFormSchema {
  return {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [{ component: '$component(Wizard)', selector: 'wizard', children: steps }],
    },
  } as unknown as JsonFormSchema;
}

describe('alignFlow', () => {
  it('поток, совпадающий со схемой, отдаётся как есть — той же ссылкой', () => {
    expect(alignFlow(FLOW, wizard(step('dannye-section'), step('kontakty-section')))).toBe(FLOW);
  });

  it('потока у модуля нет — нечего и приводить', () => {
    expect(alignFlow(undefined, wizard(step('dannye-section')))).toBeUndefined();
  });

  it('шаг, добавленный в редакторе, появляется в потоке — без правил, пока код не перегенерирован', () => {
    const aligned = alignFlow(
      FLOW,
      wizard(step('dannye-section'), step('kontakty-section'), step('itog-section'))
    );
    expect(aligned?.steps).toEqual([
      { id: 'dannye-section', rules: DANNYE },
      { id: 'kontakty-section', rules: KONTAKTY },
      { id: 'itog-section' },
    ]);
  });

  it('шаг, удалённый из схемы, из потока уходит вместе со своими правилами', () => {
    expect(alignFlow(FLOW, wizard(step('kontakty-section')))?.steps).toEqual([
      { id: 'kontakty-section', rules: KONTAKTY },
    ]);
  });

  it('порядок шагов — схемы, а не потока: шаги переставили в редакторе', () => {
    const aligned = alignFlow(FLOW, wizard(step('kontakty-section'), step('dannye-section')));
    expect(aligned?.steps.map((item) => item.id)).toEqual(['kontakty-section', 'dannye-section']);
    expect(aligned?.steps[0]?.rules).toBe(KONTAKTY);
  });

  it('шаг без селектора получает идентификатор по месту и не сдвигает правила соседей', () => {
    const aligned = alignFlow(
      FLOW,
      wizard(step('dannye-section'), step(), step('kontakty-section'))
    );
    expect(aligned?.steps).toEqual([
      { id: 'dannye-section', rules: DANNYE },
      { id: 'step:2' },
      { id: 'kontakty-section', rules: KONTAKTY },
    ]);
  });

  it('идентификатор по месту не сталкивается с настоящим селектором', () => {
    const aligned = alignFlow(FLOW, wizard(step('dannye-section'), step(), step('step:2')));
    const ids = aligned?.steps.map((item) => item.id) ?? [];
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain('step:2');
  });

  it('в схеме нет визарда — поток не трогается: связать его не с чем', () => {
    const plain = {
      format: 2,
      version: '1.0',
      root: { component: '$component(Box)', children: [] },
    } as unknown as JsonFormSchema;
    expect(alignFlow(FLOW, plain)).toBe(FLOW);
  });

  it('ни один шаг не совпал по селектору — поток как есть: шаги описаны не деревом', () => {
    expect(alignFlow(FLOW, wizard(step('a'), step('b')))).toBe(FLOW);
    expect(alignFlow(FLOW, wizard(step(), step()))).toBe(FLOW);
  });

  it('повтор селектора в схеме потоком не чинится: об этом скажет сборка', () => {
    expect(alignFlow(FLOW, wizard(step('dannye-section'), step('dannye-section')))).toBe(FLOW);
  });

  it('исходный поток не мутируется', () => {
    const before = JSON.stringify(FLOW);
    alignFlow(FLOW, wizard(step('kontakty-section'), step('novyy-section')));
    expect(JSON.stringify(FLOW)).toBe(before);
  });
});
