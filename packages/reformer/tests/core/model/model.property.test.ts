/**
 * Инварианты API модели на случайных значениях (fast-check).
 *
 * Модель фиксированной формы (листья, `null`, вложенная группа, массив примитивов, массив групп)
 * получает случайные начальные значения и случайные последовательности правок. Проверяется
 * контракт `ModelApi`:
 * - `set(v)` → `get()` отдаёт `v`;
 * - `patch(p)` — глубокое слияние: группы сливаются, массивы и листья заменяются;
 * - `isDirty()` истинно ровно тогда, когда значение отличается от снимка `initial`;
 * - `reset()` возвращает снимок; `captureInitial()` делает текущее значение снимком;
 * - производные листья (цели `markDerived` и `compute`) не меняются от `set`/`patch`.
 *
 * Значения — маленькие алфавиты, чтобы правки часто совпадали со снимком. Воспроизведение:
 * `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run <файл>`.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isDeepStrictEqual } from 'node:util';
import { createModel, markDerived } from '../../../src/model/index';
import type { DeepPartial, FormModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { compute, defineFormBehavior } from '../../../src/form/behaviors';
import { disposeForm } from '../../test-utils/dispose-form';
import { propertyParams } from '../../test-utils/property';

interface Row {
  label: string;
  qty: number;
}
interface Profile {
  name: string;
  age: number | null;
  address: { city: string; zip: string };
  tags: string[];
  rows: Row[];
  total: number;
}

const plain = { noNullPrototype: true } as const;
const text = fc.constantFrom('', 'a', 'b', 'ab');
// `-0` нормализуется: сигнал не отличает его от `0`, а `isDeepStrictEqual` — отличает.
const small = fc.integer({ min: -2, max: 2 }).map((n) => (n === 0 ? 0 : n));
const rowArb: fc.Arbitrary<Row> = fc.record({ label: text, qty: small }, plain);

const profileArb: fc.Arbitrary<Profile> = fc.record(
  {
    name: text,
    age: fc.option(small, { nil: null }),
    address: fc.record({ city: text, zip: text }, plain),
    tags: fc.array(text, { maxLength: 3 }),
    rows: fc.array(rowArb, { maxLength: 2 }),
    total: small,
  },
  plain
);

const patchArb: fc.Arbitrary<DeepPartial<Profile>> = fc.record(
  {
    name: text,
    age: fc.option(small, { nil: null }),
    address: fc.record({ city: text, zip: text }, { ...plain, requiredKeys: [] }),
    tags: fc.array(text, { maxLength: 3 }),
    rows: fc.array(rowArb, { maxLength: 2 }),
    total: small,
  },
  { ...plain, requiredKeys: [] }
);

/** Правка модели: полная и частичная установка, запись полей, мутации массивов. */
type Edit =
  | { kind: 'set'; value: Profile }
  | { kind: 'patch'; value: DeepPartial<Profile> }
  | { kind: 'name'; value: string }
  | { kind: 'city'; value: string }
  | { kind: 'push-tag'; value: string }
  | { kind: 'clear-rows' }
  | { kind: 'first-row-qty'; value: number };

const editArb: fc.Arbitrary<Edit> = fc.oneof(
  profileArb.map((value): Edit => ({ kind: 'set', value })),
  patchArb.map((value): Edit => ({ kind: 'patch', value })),
  text.map((value): Edit => ({ kind: 'name', value })),
  text.map((value): Edit => ({ kind: 'city', value })),
  text.map((value): Edit => ({ kind: 'push-tag', value })),
  fc.constant<Edit>({ kind: 'clear-rows' }),
  small.map((value): Edit => ({ kind: 'first-row-qty', value }))
);

/** Только массовые записи — то, что обязано пропускать производные поля. */
type BulkEdit = Extract<Edit, { kind: 'set' | 'patch' }>;

const bulkArb: fc.Arbitrary<BulkEdit> = fc.oneof(
  profileArb.map((value): BulkEdit => ({ kind: 'set', value })),
  patchArb.map((value): BulkEdit => ({ kind: 'patch', value }))
);

function applyEdit(model: FormModel<Profile>, edit: Edit): void {
  switch (edit.kind) {
    case 'set':
      model.set(edit.value);
      break;
    case 'patch':
      model.patch(edit.value);
      break;
    case 'name':
      model.name = edit.value;
      break;
    case 'city':
      model.address.city = edit.value;
      break;
    case 'push-tag':
      model.tags.push(edit.value);
      break;
    case 'clear-rows':
      model.rows.clear();
      break;
    case 'first-row-qty':
      if (model.rows.length > 0) model.rows.at(0).qty = edit.value;
      break;
  }
}

const isGroup = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Эталонное глубокое слияние: группы сливаются, массивы и листья заменяются. */
function merge<T>(base: T, patch: unknown): T {
  if (!isGroup(base) || !isGroup(patch)) return patch as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, part] of Object.entries(patch)) {
    out[key] = isGroup(base[key]) ? merge(base[key], part) : part;
  }
  return out as T;
}

describe('model — свойства API на случайных значениях', () => {
  it('set(v) → get() отдаёт v', () => {
    fc.assert(
      fc.property(profileArb, profileArb, (initial, next) => {
        const model = createModel(initial);

        model.set(next);

        expect(model.get()).toEqual(next);
        expect(model.$.peek()).toEqual(next);
      }),
      propertyParams()
    );
  });

  it('patch — глубокое слияние: группы сливаются, массивы и листья заменяются', () => {
    fc.assert(
      fc.property(profileArb, fc.array(patchArb, { maxLength: 3 }), (initial, patches) => {
        const model = createModel(initial);
        let expected: Profile = initial;

        for (const patch of patches) {
          model.patch(patch);
          expected = merge(expected, patch);
          expect(model.get()).toEqual(expected);
        }
      }),
      propertyParams()
    );
  });

  it('isDirty() истинно ровно тогда, когда значение отличается от снимка', () => {
    fc.assert(
      fc.property(profileArb, fc.array(editArb, { maxLength: 6 }), (initial, edits) => {
        const model = createModel(initial);
        expect(model.isDirty()).toBe(false);

        for (const edit of edits) {
          applyEdit(model, edit);
          expect(model.isDirty()).toBe(!isDeepStrictEqual(model.get(), initial));
        }
      }),
      propertyParams()
    );
  });

  it('reset() возвращает снимок, после него модель чистая', () => {
    fc.assert(
      fc.property(profileArb, fc.array(editArb, { maxLength: 6 }), (initial, edits) => {
        const model = createModel(initial);
        edits.forEach((edit) => applyEdit(model, edit));

        model.reset();

        expect(model.get()).toEqual(initial);
        expect(model.isDirty()).toBe(false);
      }),
      propertyParams()
    );
  });

  it('captureInitial() делает текущее значение снимком: модель чистая, reset() вернёт его', () => {
    fc.assert(
      fc.property(
        profileArb,
        fc.array(editArb, { maxLength: 4 }),
        fc.array(editArb, { maxLength: 4 }),
        (initial, before, after) => {
          const model = createModel(initial);
          before.forEach((edit) => applyEdit(model, edit));

          model.captureInitial();
          const captured = model.get();
          expect(model.isDirty()).toBe(false);

          after.forEach((edit) => applyEdit(model, edit));
          expect(model.isDirty()).toBe(!isDeepStrictEqual(model.get(), captured));
          model.reset();
          expect(model.get()).toEqual(captured);
        }
      ),
      propertyParams()
    );
  });

  it('листья, помеченные markDerived, не меняются от set/patch; остальные поля пишутся', () => {
    fc.assert(
      fc.property(profileArb, fc.array(bulkArb, { maxLength: 4 }), (initial, edits) => {
        const model = createModel(initial);
        markDerived(model.$.total);
        markDerived(model.$.address.zip);

        for (const edit of edits) {
          const before = model.get();
          applyEdit(model, edit);
          const written = edit.kind === 'set' ? edit.value : merge(before, edit.value);

          expect(model.total).toBe(initial.total);
          expect(model.address.zip).toBe(initial.address.zip);
          expect(model.get()).toEqual({
            ...written,
            total: initial.total,
            address: { ...written.address, zip: initial.address.zip },
          });
        }
      }),
      propertyParams()
    );
  });

  it('цель compute после set/patch равна вычисленному значению, а не значению из payload', () => {
    fc.assert(
      fc.property(profileArb, fc.array(bulkArb, { maxLength: 4 }), (initial, edits) => {
        const model = createModel(initial);
        const behavior = defineFormBehavior<Profile>(({ model: m }) => {
          compute(m.$.total, () => m.tags.length + m.rows.length);
        });
        const form = createFormFromModel<Profile>({ model, behavior });
        try {
          for (const edit of edits) {
            applyEdit(model, edit);
            expect(model.total).toBe(model.tags.length + model.rows.length);
          }
        } finally {
          disposeForm(form);
        }
      }),
      propertyParams()
    );
  });
});
