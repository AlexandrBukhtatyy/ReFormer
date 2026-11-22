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
    const scopes = collectModelScopes({
      format: 2,
      root: { component: '$html(div)' },
    } as JsonFormSchema);
    expect(scopes).toEqual([{ at: [], bound: [] }]);
  });

  it('повтор пути — одно объявление', () => {
    const schema = {
      format: 2,
      root: {
        component: '$html(div)',
        children: [
          { model: '$model(a)', component: '$component(Input)' },
          { model: '$model(a)', component: '$component(Input)' },
        ],
      },
    } as JsonFormSchema;
    expect(boundPathsIn(collectModelScopes(schema), [])).toEqual(['a']);
  });

  it('текстовое $model — не объявление', () => {
    const schema = {
      format: 2,
      root: { component: '$html(p)', children: ['Итого: ', '$model(total)'] },
    } as JsonFormSchema;
    expect(boundPathsIn(collectModelScopes(schema), [])).toEqual([]);
  });
});

describe('collectModelReads', () => {
  it('текстовая часть и значение пропа, с областью', () => {
    const schema = {
      format: 2,
      root: {
        component: '$html(div)',
        children: [
          'Сумма: ',
          '$model(amount)',
          {
            model: '$model(items)',
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

describe('области именованных частей документа', () => {
  const schema = {
    format: 2,
    parts: {
      address: {
        component: '$html(div)',
        children: [
          { model: '$model(city)', component: '$component(Input)' },
          '$model(city)',
          {
            model: '$model(phones)',
            item: {
              $template: {
                component: '$html(div)',
                children: [
                  { model: '$model(number)', component: '$component(Input)' },
                  '$model(city)',
                ],
              },
            },
          },
        ],
      },
      empty: { component: '$html(div)' },
    },
    root: {
      component: '$html(div)',
      children: [
        { model: '$model(home)', part: '$part(address)' },
        { model: '$model(work)', part: '$part(address)' },
        { model: '$model(guests)', item: '$part(address)' },
        '$model(home.city)',
      ],
    },
  } as unknown as JsonFormSchema;
  const PART = ['parts', 'address'];
  const PHONES = [...PART, 'children', 2];

  it('место в разметке части принадлежит области части, а не корню', () => {
    expect(scopeOfPath([...PART, 'children', 0])).toEqual(PART);
    expect(scopeOfPath(PART)).toEqual(PART);
    // Шаблон массива внутри части — своя область, как и в дереве корня.
    expect(scopeOfPath([...PHONES, 'item', '$template', 'children', 0])).toEqual(PHONES);
    expect(scopeOfPath(PHONES)).toEqual(PART);
  });

  it('привязка подформы объявлена там, где стоит узел; поля части — в области части', () => {
    const scopes = collectModelScopes(schema);
    expect(boundPathsIn(scopes, [])).toEqual(['home', 'work', 'guests']);
    // Область у части одна, сколько бы раз её ни подключали.
    expect(boundPathsIn(scopes, PART)).toEqual(['city', 'phones']);
    expect(boundPathsIn(scopes, PHONES)).toEqual(['number']);
  });

  it('область есть и у части без единой привязки', () => {
    expect(collectModelScopes(schema).map((scope) => scope.at)).toContainEqual(['parts', 'empty']);
  });

  it('чтения в разметке части собираются с областью части', () => {
    expect(
      collectModelReads(schema).map((read) => ({ path: read.path, scope: read.scope }))
    ).toEqual([
      { path: 'home.city', scope: [] },
      { path: 'city', scope: PART },
      { path: 'city', scope: PHONES },
    ]);
  });
});
