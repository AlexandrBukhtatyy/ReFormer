import { describe, it, expect } from 'vitest';
import { collectOperatorNames } from './collect-operator-names';
import type { JsonFormSchema } from './types/json-schema';

const asSchema = (root: unknown): JsonFormSchema =>
  ({ format: 2, root }) as unknown as JsonFormSchema;

describe('collectOperatorNames', () => {
  it('собирает четыре вида имён и не путает их между собой', () => {
    const schema = asSchema({
      component: '$component(Box)',
      children: [
        {
          model: '$model(email)',
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
      children: [{ model: '$model(deep.path.here)', component: '$component(Input)' }],
    });
    const names = collectOperatorNames(schema);
    expect(names.components).toEqual(['Input']);
    expect([...names.dataSources, ...names.fns, ...names.locales]).toEqual([]);
  });

  it('находит операторы в ГЛУБИНЕ componentProps — там, где JSON Schema видит opaque object', () => {
    // Компонент несёт дерево узлов внутри пропсов.
    const schema = asSchema({
      component: '$component(Wizard)',
      componentProps: {
        sections: [
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
      model: '$model(alerts)',
      component: '$component(List)',
      item: { $template: { component: '$component(Alert)' } },
    });
    expect(collectOperatorNames(schema).components).toEqual(['List', 'Alert']);
  });

  it('берёт имена и из именованных частей документа', () => {
    const schema = {
      format: 2,
      parts: { row: { component: '$component(Row)', componentProps: { fmt: '$fn(money)' } } },
      root: { model: '$model(rows)', component: '$component(List)', item: '$part(row)' },
    } as JsonFormSchema;
    const names = collectOperatorNames(schema);
    expect(names.components).toEqual(['List', 'Row']);
    expect(names.fns).toEqual(['money']);
  });

  it('дедуплицирует повторы', () => {
    const schema = asSchema({
      component: '$component(Box)',
      children: [
        { model: '$model(a)', component: '$component(Input)' },
        { model: '$model(b)', component: '$component(Input)' },
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
