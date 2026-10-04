import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  boundPathsIn,
  collectModelReads,
  collectModelScopes,
  isPathBound,
  scopeOfPath,
} from './model-scopes';
import { P, sampleSchema } from './__fixtures__/sample-schema';

const ARRAY_AT = [...P.array];

describe('scopeOfPath', () => {
  it('вне шаблонов — корень', () => {
    expect(scopeOfPath(P.step0field0)).toEqual([]);
  });

  it('внутри шаблона — путь массива', () => {
    expect(scopeOfPath([...ARRAY_AT, 'item', '$template', 'children', 0])).toEqual(ARRAY_AT);
  });

  it('сам массив принадлежит внешней области', () => {
    expect(scopeOfPath(ARRAY_AT)).toEqual([]);
  });

  it('вложенный шаблон — ближайший массив', () => {
    const inner = [...ARRAY_AT, 'item', '$template', 'children', 2];
    expect(scopeOfPath([...inner, 'item', '$template', 'value'])).toEqual(inner);
  });
});

describe('collectModelScopes', () => {
  it('корень: поля и массив, шаблон — отдельной областью', () => {
    const scopes = collectModelScopes(sampleSchema());
    expect(boundPathsIn(scopes, [])).toEqual(['loanType', 'loanAmount', 'properties']);
    expect(boundPathsIn(scopes, ARRAY_AT)).toEqual(['type']);
  });

  it('корень есть и у формы без привязок', () => {
    const scopes = collectModelScopes({ root: { component: '$html(div)' } } as JsonFormSchema);
    expect(scopes).toEqual([{ at: [], bound: [] }]);
  });

  it('повтор пути — одно объявление', () => {
    const schema = {
      root: {
        component: '$html(div)',
        children: [
          { value: '$model(a)', component: '$component(Input)' },
          { value: '$model(a)', component: '$component(Input)' },
        ],
      },
    } as JsonFormSchema;
    expect(boundPathsIn(collectModelScopes(schema), [])).toEqual(['a']);
  });

  it('текстовое $model — не объявление', () => {
    const schema = {
      root: { component: '$html(p)', children: ['Итого: ', '$model(total)'] },
    } as JsonFormSchema;
    expect(boundPathsIn(collectModelScopes(schema), [])).toEqual([]);
  });
});

describe('collectModelReads', () => {
  it('текстовая часть и значение пропа, с областью', () => {
    const schema = {
      root: {
        component: '$html(div)',
        children: [
          'Сумма: ',
          '$model(amount)',
          {
            array: '$model(items)',
            item: {
              $template: {
                component: '$component(Box)',
                componentProps: { title: '$model(name)', meta: { hint: ['$model(price)'] } },
              },
            },
          },
        ],
      },
    } as JsonFormSchema;

    const reads = collectModelReads(schema).map(({ within, path, scope }) => ({
      within,
      path,
      scope,
    }));
    expect(reads).toEqual([
      { within: ['children', 1], path: 'amount', scope: [] },
      {
        within: ['componentProps', 'title'],
        path: 'name',
        scope: ['root', 'children', 2],
      },
      {
        within: ['componentProps', 'meta', 'hint', 0],
        path: 'price',
        scope: ['root', 'children', 2],
      },
    ]);
  });

  it('шаги мастера не читаются дважды, объявления — не чтения', () => {
    expect(collectModelReads(sampleSchema())).toEqual([]);
  });
});

describe('isPathBound', () => {
  it('точное совпадение, группа и её лист', () => {
    expect(isPathBound('a', ['a'])).toBe(true);
    expect(isPathBound('address.city', ['address'])).toBe(true);
    expect(isPathBound('address', ['address.city'])).toBe(true);
  });

  it('общий префикс без точки — не совпадение', () => {
    expect(isPathBound('ab', ['a'])).toBe(false);
    expect(isPathBound('fulName', ['fullName'])).toBe(false);
  });
});
