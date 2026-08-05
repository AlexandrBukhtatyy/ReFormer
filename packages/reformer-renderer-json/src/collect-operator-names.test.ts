import { describe, it, expect } from 'vitest';
import { collectOperatorNames } from './collect-operator-names';
import type { JsonFormSchema } from './types/json-schema';

const asSchema = (root: unknown): JsonFormSchema => ({ root }) as unknown as JsonFormSchema;

describe('collectOperatorNames', () => {
  it('собирает четыре вида имён и не путает их между собой', () => {
    const schema = asSchema({
      component: '$component(Box)',
      children: [
        {
          value: '$model(email)',
          component: '$component(Input)',
          componentProps: {
            options: '$dataSource(GENDERS)',
            itemLabel: '$fn(propertyLabel)',
            label: '$locale(fields.email.label)',
          },
        },
      ],
    });

    expect(collectOperatorNames(schema)).toEqual({
      components: ['Box', 'Input'],
      dataSources: ['GENDERS'],
      fns: ['propertyLabel'],
      locales: ['fields.email.label'],
    });
  });

  it('$model и $html не попадают ни в один список', () => {
    const schema = asSchema({
      component: '$html(section)',
      children: [{ value: '$model(deep.path.here)', component: '$component(Input)' }],
    });
    const names = collectOperatorNames(schema);
    expect(names.components).toEqual(['Input']);
    expect([...names.dataSources, ...names.fns, ...names.locales]).toEqual([]);
  });

  it('находит операторы в ГЛУБИНЕ componentProps — там, где JSON Schema видит opaque object', () => {
    // Реальный случай: RendererFormWizard.steps несёт дерево узлов внутри пропсов.
    const schema = asSchema({
      component: '$component(Wizard)',
      componentProps: {
        steps: [
          { body: { component: '$component(StepOne)' } },
          {
            body: {
              component: '$component(StepTwo)',
              componentProps: { src: '$dataSource(REGIONS)' },
            },
          },
        ],
      },
    });
    const names = collectOperatorNames(schema);
    expect(names.components).toEqual(['Wizard', 'StepOne', 'StepTwo']);
    expect(names.dataSources).toEqual(['REGIONS']);
  });

  it('спускается в item.$template массива', () => {
    const schema = asSchema({
      array: '$model(alerts)',
      component: '$component(List)',
      item: { $template: { component: '$component(Alert)' } },
    });
    expect(collectOperatorNames(schema).components).toEqual(['List', 'Alert']);
  });

  it('дедуплицирует повторы', () => {
    const schema = asSchema({
      component: '$component(Box)',
      children: [
        { value: '$model(a)', component: '$component(Input)' },
        { value: '$model(b)', component: '$component(Input)' },
      ],
    });
    expect(collectOperatorNames(schema).components).toEqual(['Box', 'Input']);
  });

  it('пустая схема даёт четыре пустых списка', () => {
    expect(collectOperatorNames(asSchema({ component: '$html(div)' }))).toEqual({
      components: [],
      dataSources: [],
      fns: [],
      locales: [],
    });
  });
});
