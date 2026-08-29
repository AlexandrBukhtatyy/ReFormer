import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { ensureSchema, isFormSchema, migrateTextNodes } from './normalize';

describe('isFormSchema / ensureSchema', () => {
  it('узнаёт схему по узлу в root и отвергает произвольный JSON', () => {
    expect(isFormSchema({ root: { component: '$html(div)' } })).toBe(true);
    expect(isFormSchema({ $schema: 'http://json-schema.org/draft-07/schema#' })).toBe(false);
    expect(() => ensureSchema({ some: 'json' })).toThrow(/JsonFormSchema/);
  });
});

describe('migrateTextNodes', () => {
  it('переносит text в начало children — туда, где он и рендерился', () => {
    const schema = {
      version: '1.0',
      root: {
        component: '$html(p)',
        text: 'Внимание! ',
        children: [{ component: '$html(b)', text: 'важно' }],
      },
    } as unknown as JsonFormSchema;
    expect(migrateTextNodes(schema).root).toEqual({
      component: '$html(p)',
      children: ['Внимание! ', { component: '$html(b)', children: ['важно'] }],
    });
  });

  it('массив частей разворачивается в отдельные текстовые дети', () => {
    const schema = {
      root: { component: '$html(p)', text: ['Платёж: ', '$model(monthlyPayment)', ' ₽'] },
    } as unknown as JsonFormSchema;
    expect((migrateTextNodes(schema).root as { children: unknown[] }).children).toEqual([
      'Платёж: ',
      '$model(monthlyPayment)',
      ' ₽',
    ]);
  });

  it('доходит до узлов, вложенных в componentProps (шаги мастера)', () => {
    const schema = {
      root: {
        component: '$component(Wizard)',
        componentProps: {
          steps: [{ component: '$component(Step)', text: 'Шаг 1' }],
        },
      },
    } as unknown as JsonFormSchema;
    const steps = (
      migrateTextNodes(schema).root as unknown as {
        componentProps: { steps: Array<{ children: unknown[] }> };
      }
    ).componentProps.steps;
    expect(steps[0].children).toEqual(['Шаг 1']);
  });

  it('не трогает componentProps.text компонента — это его проп, а не содержимое узла', () => {
    const schema = {
      root: { component: '$component(Input)', componentProps: { text: 'подпись' } },
    } as unknown as JsonFormSchema;
    expect(migrateTextNodes(schema)).toEqual(schema);
  });

  it('схему без text возвращает той же ссылкой — round-trip не страдает', () => {
    const schema = {
      version: '1.0',
      root: { component: '$html(div)', children: [{ component: '$html(p)', children: ['x'] }] },
    } as unknown as JsonFormSchema;
    expect(migrateTextNodes(schema)).toBe(schema);
  });
});
