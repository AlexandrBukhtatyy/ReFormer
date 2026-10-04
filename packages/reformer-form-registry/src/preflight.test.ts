/**
 * Preflight: пять проверок до сборки формы.
 *
 * Смысл каждой — поймать отказ, который иначе МОЛЧАЛИВ либо всплывает далеко от причины.
 */
import { describe, it, expect } from 'vitest';
import {
  defineRegistry,
  type JsonFormSchema as JsonFormSchemaV2,
  type JsonFormSchemaV1 as JsonFormSchema,
} from '@reformer/renderer-json';
import { preflight, satisfiesRange, collectModelPaths, hasPath } from './preflight';
import type { FormEntry } from './types';

interface M {
  email: string;
  profile: { age: number };
}

const Stub = (): null => null;

const registry = defineRegistry((r) => {
  r.component('Box', Stub);
  r.component('Input', Stub);
  r.dataSource('COUNTRIES', [{ value: 'ru', label: 'Россия' }]);
  r.fn('formatMoney', (v: unknown) => String(v));
});

const schema = {
  id: 'a',
  version: '1.0.0',
  root: {
    component: '$component(Box)',
    children: [
      { selector: 'step1', value: '$model(email)', component: '$component(Input)' },
      { value: '$model(profile.age)', component: '$component(Input)' },
    ],
  },
} as unknown as JsonFormSchema<M>;

const entry = (over: Partial<FormEntry<M>> = {}): FormEntry<M> =>
  ({
    id: 'a',
    version: '1.0.0',
    owner: 'test',
    schema: { kind: 'inline', value: schema },
    ...over,
  }) as FormEntry<M>;

const initial: M = { email: '', profile: { age: 0 } };

describe('preflight — чистый случай', () => {
  it('всё сходится → ok, без замечаний', () => {
    const r = preflight({ entry: entry(), schema, registry, initial });
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });
});

describe('preflight — дрейф версии схемы', () => {
  it('версия вне объявленного диапазона → error', () => {
    const s = { ...schema, version: '2.0.0' } as unknown as JsonFormSchema<M>;
    const r = preflight({
      entry: entry({ compatibleSchema: '^1.0.0' }),
      schema: s,
      registry,
      initial,
    });
    expect(r.ok).toBe(false);
    expect(r.problems[0].code).toBe('schema-version-drift');
  });

  it('версия в диапазоне → без замечаний', () => {
    const s = { ...schema, version: '1.4.2' } as unknown as JsonFormSchema<M>;
    expect(
      preflight({ entry: entry({ compatibleSchema: '^1.0.0' }), schema: s, registry, initial }).ok
    ).toBe(true);
  });

  it('без compatibleSchema проверка не выполняется', () => {
    const s = { ...schema, version: '9.9.9' } as unknown as JsonFormSchema<M>;
    expect(preflight({ entry: entry(), schema: s, registry, initial }).ok).toBe(true);
  });
});

describe('preflight — подмена схемы', () => {
  it('чужой id → error (иначе форма молча писала бы не те поля)', () => {
    const s = { ...schema, id: 'другая-форма' } as unknown as JsonFormSchema<M>;
    const r = preflight({ entry: entry(), schema: s, registry, initial });
    expect(r.ok).toBe(false);
    expect(r.problems.map((p) => p.code)).toContain('schema-identity-mismatch');
  });
});

describe('preflight — промахи по реестру', () => {
  it('незарегистрированный компонент → error со списком', () => {
    const s = {
      ...schema,
      root: { component: '$component(НетТакого)', children: [] },
    } as unknown as JsonFormSchema<M>;
    const r = preflight({ entry: entry(), schema: s, registry, initial });
    expect(r.ok).toBe(false);
    const p = r.problems.find((x) => x.code === 'missing-components')!;
    expect(p.items).toEqual(['НетТакого']);
  });

  it('незарегистрированный источник данных → error', () => {
    const s = {
      ...schema,
      root: {
        component: '$component(Box)',
        children: [
          {
            value: '$model(email)',
            component: '$component(Input)',
            componentProps: { options: '$dataSource(ГОРОДА)' },
          },
        ],
      },
    } as unknown as JsonFormSchema<M>;
    const r = preflight({ entry: entry(), schema: s, registry, initial });
    expect(r.problems.find((x) => x.code === 'missing-data-sources')?.items).toEqual(['ГОРОДА']);
  });

  it('незарегистрированная функция → error', () => {
    const s = {
      ...schema,
      root: {
        component: '$component(Box)',
        children: [
          {
            value: '$model(email)',
            component: '$component(Input)',
            componentProps: { format: '$fn(неизвестная)' },
          },
        ],
      },
    } as unknown as JsonFormSchema<M>;
    const r = preflight({ entry: entry(), schema: s, registry, initial });
    expect(r.problems.find((x) => x.code === 'missing-fns')?.items).toEqual(['неизвестная']);
  });
});

describe('preflight — ключи пошаговой валидации', () => {
  it('переименованный шаг → error, а не тихое отсутствие валидации', () => {
    const r = preflight({
      entry: entry(),
      schema,
      registry,
      initial,
      validation: { steps: { шаг1: null } },
    });
    expect(r.ok).toBe(false);
    const p = r.problems.find((x) => x.code === 'unknown-step-selectors')!;
    expect(p.items).toEqual(['шаг1']);
    expect(p.message).toContain('step1'); // подсказали, какие селекторы есть
  });

  it('совпадающий ключ шага → без замечаний', () => {
    expect(
      preflight({
        entry: entry(),
        schema,
        registry,
        initial,
        validation: { steps: { step1: null } },
      }).ok
    ).toBe(true);
  });
});

describe('preflight — нематериализованные пути модели', () => {
  it('поля нет в начальных значениях → warn (ошибки валидации иначе исчезнут молча)', () => {
    const r = preflight({ entry: entry(), schema, registry, initial: { email: '' } });
    const p = r.problems.find((x) => x.code === 'unmaterialized-model-paths')!;
    expect(p.items).toEqual(['profile.age']);
    expect(p.level).toBe('warn');
    expect(r.ok).toBe(true); // warn не блокирует сборку
  });

  it('индексы массивов не считаются пропущенными — массив на старте пуст', () => {
    const s = {
      ...schema,
      root: {
        component: '$component(Box)',
        children: [{ value: '$model(items.0.name)', component: '$component(Input)' }],
      },
    } as unknown as JsonFormSchema<M>;
    const r = preflight({ entry: entry(), schema: s, registry, initial: { items: [] } });
    expect(r.problems.find((x) => x.code === 'unmaterialized-model-paths')).toBeUndefined();
  });

  it('без начальных значений проверка пропускается', () => {
    expect(preflight({ entry: entry(), schema, registry }).ok).toBe(true);
  });
});

describe('preflight — документ формата 2', () => {
  interface V2 {
    email: string;
    registration: { city: string; flat: { number: string } };
    residence: { city: string; flat: { number: string } };
    rows: { name: string }[];
  }

  const v2 = {
    format: 2,
    id: 'a',
    version: '1.0.0',
    parts: {
      address: {
        selector: 'address-box',
        component: '$component(Box)',
        children: [
          { model: '$model(city)', component: '$component(Input)' },
          { model: '$model(flat)', part: '$part(flat)' },
        ],
      },
      flat: { model: '$model(number)', component: '$component(Input)' },
      row: { model: '$model(name)', component: '$component(Input)' },
    },
    root: {
      component: '$component(Box)',
      children: [
        { selector: 'main', model: '$model(email)', component: '$component(Input)' },
        { model: '$model(registration)', part: '$part(address)' },
        { model: '$model(residence)', part: '$part(address)' },
        { model: '$model(rows)', item: '$part(row)' },
      ],
    },
  } as unknown as JsonFormSchemaV2<V2>;

  const v2Initial: V2 = {
    email: '',
    registration: { city: '', flat: { number: '' } },
    residence: { city: '', flat: { number: '' } },
    rows: [],
  };
  const v2Entry = entry() as unknown as FormEntry<V2>;
  const withParts = (parts: Record<string, unknown>): JsonFormSchemaV2<V2> =>
    ({ ...v2, parts: { ...v2.parts, ...parts } }) as unknown as JsonFormSchemaV2<V2>;

  it('всё сходится → ok, без замечаний', () => {
    const r = preflight({ entry: v2Entry, schema: v2, registry, initial: v2Initial });
    expect(r.problems).toEqual([]);
  });

  it('операторы внутри частей сверяются с реестром', () => {
    const r = preflight({
      entry: v2Entry,
      registry,
      initial: v2Initial,
      schema: withParts({
        row: {
          model: '$model(name)',
          component: '$component(Нет)',
          componentProps: { options: '$dataSource(НЕТ)', format: '$fn(нет)' },
        },
      }),
    });
    expect(r.problems.map((p) => p.code).sort()).toEqual([
      'missing-components',
      'missing-data-sources',
      'missing-fns',
    ]);
  });

  it('селекторы внутри частей известны — ключ шага на них не считается промахом', () => {
    const r = preflight({
      entry: v2Entry,
      schema: v2,
      registry,
      initial: v2Initial,
      validation: { steps: { 'address-box': null, main: null } },
    });
    expect(r.problems).toEqual([]);
  });

  it('необъявленная часть → error с перечнем объявленных', () => {
    const schema = {
      ...v2,
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(registration)', part: '$part(adress)' },
          { model: '$model(rows)', item: '$part(строка)' },
        ],
      },
    } as unknown as JsonFormSchemaV2<V2>;
    const r = preflight({ entry: v2Entry, schema, registry });
    const p = r.problems.find((x) => x.code === 'missing-parts')!;
    expect(r.ok).toBe(false);
    expect(p.items.sort()).toEqual(['adress', 'строка']);
    expect(p.message).toContain('address, flat, row');
  });

  it('пути части считаются от группы подключения, в том числе вложенной', () => {
    expect(collectModelPaths(v2).sort()).toEqual([
      'email',
      'registration',
      'registration.city',
      'registration.flat',
      'registration.flat.number',
      'residence',
      'residence.city',
      'residence.flat',
      'residence.flat.number',
      'rows',
    ]);
  });

  it('поля подформы нет в начальных значениях → warn с путём от корня', () => {
    const r = preflight({
      entry: v2Entry,
      schema: v2,
      registry,
      initial: { ...v2Initial, residence: { city: '' } },
    });
    const p = r.problems.find((x) => x.code === 'unmaterialized-model-paths')!;
    expect(p.items.sort()).toEqual(['residence.flat', 'residence.flat.number']);
    expect(r.ok).toBe(true);
  });

  it('шаблон строки массива не проверяется: его пути относительны элементу', () => {
    // `name` из части `row` в корне модели нет — и быть не должно.
    const r = preflight({ entry: v2Entry, schema: v2, registry, initial: v2Initial });
    expect(r.problems.find((x) => x.code === 'unmaterialized-model-paths')).toBeUndefined();
  });

  it('часть, подключающая саму себя, обход не зацикливает', () => {
    const schema = withParts({
      flat: {
        component: '$component(Box)',
        children: [
          { model: '$model(number)', component: '$component(Input)' },
          { model: '$model(inner)', part: '$part(flat)' },
        ],
      },
    });
    expect(collectModelPaths(schema)).toContain('registration.flat.inner');
    expect(collectModelPaths(schema)).not.toContain('registration.flat.inner.inner');
  });
});

describe('satisfiesRange', () => {
  it.each([
    ['1.0.0', '^1.0.0', true],
    ['1.9.9', '^1.0.0', true],
    ['2.0.0', '^1.0.0', false],
    ['0.9.0', '^1.0.0', false],
    ['1.2.5', '~1.2.0', true],
    ['1.3.0', '~1.2.0', false],
    ['1.5.0', '>=1.0.0', true],
    ['0.5.0', '>=1.0.0', false],
    ['1.4.0', '1.x', true],
    ['2.4.0', '1.x', false],
    ['3.0.0', '*', true],
    ['1.0.0', '1.0.0', true],
    ['1.0.1', '1.0.0', false],
    ['0.2.5', '^0.2.0', true],
    ['0.3.0', '^0.2.0', false],
  ])('%s против %s → %s', (v, r, expected) => {
    expect(satisfiesRange(v, r)).toBe(expected);
  });
});

describe('collectModelPaths и hasPath', () => {
  it('собирает пути из всего дерева', () => {
    expect(collectModelPaths(schema).sort()).toEqual(['email', 'profile.age']);
  });

  it('hasPath различает отсутствие и falsy-значение', () => {
    expect(hasPath({ a: 0 }, 'a')).toBe(true);
    expect(hasPath({ a: null }, 'a')).toBe(true);
    expect(hasPath({}, 'a')).toBe(false);
    expect(hasPath({ a: { b: undefined } }, 'a.b')).toBe(true);
    expect(hasPath({ a: {} }, 'a.b')).toBe(false);
  });
});
