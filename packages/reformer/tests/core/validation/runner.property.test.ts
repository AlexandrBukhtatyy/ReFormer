/**
 * Раннер валидации на случайных значениях и наборах правил (fast-check).
 *
 * Свойства проверки уровня формы (`bundle.validate()`):
 * - статус прогона совпадает с агрегатом формы: `valid` ⇔ `form.valid` — при любых значениях,
 *   правилах (синхронных, async, отклонённых, `warning`) и выключенных полях и строках;
 * - повторный прогон на тех же значениях идемпотентен: тот же статус и те же замечания на нодах;
 * - правила `severity: 'warning'` статус не меняют: форма с ними и без них даёт один статус.
 *
 * Каждый прогон собирает свою форму. Воспроизведение: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest
 * run runner.property`.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { disposeForm } from '../../test-utils/dispose-form';
import { propertyParams } from '../../test-utils/property';
import { InputStub } from '../../test-utils/stubs';
import { createForm, type FormBundle } from '../../../src/form/form-bundle';
import type { FormModel, PathAwareSignal } from '../../../src/model/types';
import {
  applyEach,
  defineValidation,
  validate,
  validateAsync,
  type AsyncRule,
  type Rule,
} from '../../../src/form/validation';
import { minLength, required } from '../../../src/form/validators';
import type { ValidationIssue } from '../../../src/form/types/contracts';

interface Row {
  label: string;
}
interface Shape {
  name: string;
  email: string;
  rows: Row[];
}

/** Когда своё правило выдаёт замечание. */
type When = 'always' | 'never' | 'empty' | 'filled';

/** Описание правила, из которого строится настоящее правило поля. */
type RuleSpec =
  | { readonly kind: 'required' }
  | { readonly kind: 'minLength'; readonly n: number }
  | {
      readonly kind: 'custom';
      readonly when: When;
      readonly severity: 'error' | 'warning';
      readonly mode: 'sync' | 'async' | 'reject';
    };

interface Specs {
  readonly name: readonly RuleSpec[];
  readonly email: readonly RuleSpec[];
  readonly label: readonly RuleSpec[];
}

interface Disabled {
  readonly fields: readonly ('name' | 'email')[];
  readonly rows: readonly number[];
}

const fires = (when: When, value: string): boolean =>
  when === 'always' || (when === 'empty' && value === '') || (when === 'filled' && value !== '');

/** Правила поля по описаниям: синхронные — в `validate`, async и отклонённые — в `validateAsync`. */
function bind(handle: PathAwareSignal<string>, specs: readonly RuleSpec[]): void {
  const sync: Rule<string>[] = [];
  const async: AsyncRule<string>[] = [];
  for (const spec of specs) {
    if (spec.kind === 'required') sync.push(required());
    else if (spec.kind === 'minLength') sync.push(minLength(spec.n));
    else {
      const issue: ValidationIssue = { code: `custom.${spec.when}`, severity: spec.severity };
      if (spec.mode === 'sync') sync.push((value) => (fires(spec.when, value) ? issue : null));
      else if (spec.mode === 'async') {
        async.push(async (value) => (fires(spec.when, value) ? issue : null));
      } else {
        async.push(async (value) => {
          if (fires(spec.when, value)) throw new Error('сеть');
          return null;
        });
      }
    }
  }
  validate(handle, sync);
  if (async.length > 0) validateAsync(handle, async);
}

const rowItem = (row: FormModel<Row>) => ({
  children: [{ model: row.$.label, component: InputStub }],
});

function build(values: Shape, specs: Specs): FormBundle<Shape> {
  const rowRules = defineValidation<Row>(({ model }) => bind(model.$.label, specs.label));
  return createForm<Shape>({
    initial: { ...values, rows: values.rows.map((row) => ({ ...row })) },
    schema: (model) => ({ children: [{ model: model.$.rows, item: rowItem }] }),
    validation: defineValidation<Shape>(({ model }) => {
      bind(model.$.name, specs.name);
      bind(model.$.email, specs.email);
      applyEach(model.$.rows, rowRules);
    }),
  });
}

function disable(bundle: FormBundle<Shape>, disabled: Disabled): void {
  for (const field of disabled.fields) bundle.form[field].disable();
  for (const index of disabled.rows) bundle.form.rows.at(index)?.disable();
}

/** Коды замечаний всех полей формы — снимок для сравнения прогонов. */
const codesOf = (bundle: FormBundle<Shape>): string[][] => [
  bundle.form.name.issues.value.map((issue) => issue.code),
  bundle.form.email.issues.value.map((issue) => issue.code),
  ...bundle.form.rows.map((row) => row.label.issues.value.map((issue) => issue.code)),
];

const textArb = fc.constantFrom('', 'a', 'ab', 'abcd');
const valuesArb: fc.Arbitrary<Shape> = fc.record({
  name: textArb,
  email: textArb,
  rows: fc.array(fc.record({ label: textArb }), { maxLength: 3 }),
});
const ruleArb: fc.Arbitrary<RuleSpec> = fc.oneof(
  fc.constant({ kind: 'required' as const }),
  fc.record({ kind: fc.constant('minLength' as const), n: fc.integer({ min: 1, max: 3 }) }),
  fc.record({
    kind: fc.constant('custom' as const),
    when: fc.constantFrom<When>('always', 'never', 'empty', 'filled'),
    severity: fc.constantFrom<'error' | 'warning'>('error', 'warning'),
    mode: fc.constantFrom<'sync' | 'async' | 'reject'>('sync', 'async', 'reject'),
  })
);
const rulesArb = fc.array(ruleArb, { maxLength: 3 });
const specsArb: fc.Arbitrary<Specs> = fc.record({
  name: rulesArb,
  email: rulesArb,
  label: rulesArb,
});
const disabledArb: fc.Arbitrary<Disabled> = fc.record({
  fields: fc.subarray(['name', 'email'] as const),
  rows: fc.subarray([0, 1, 2]),
});
/** Только предупреждения: синхронные и async. */
const warningsArb: fc.Arbitrary<RuleSpec[]> = fc.array(
  fc.record({
    kind: fc.constant('custom' as const),
    when: fc.constantFrom<When>('always', 'empty', 'filled'),
    severity: fc.constant('warning' as const),
    mode: fc.constantFrom<'sync' | 'async'>('sync', 'async'),
  }),
  { minLength: 1, maxLength: 3 }
);

describe('validation/run — свойства проверки уровня формы', () => {
  it('статус прогона valid ⇔ form.valid после прогона', async () => {
    await fc.assert(
      fc.asyncProperty(valuesArb, specsArb, disabledArb, async (values, specs, disabled) => {
        const bundle = build(values, specs);
        try {
          disable(bundle, disabled);

          const result = await bundle.validate();

          expect(['valid', 'invalid', 'error']).toContain(result.status);
          expect(result.status === 'valid').toBe(bundle.form.valid.value);
          expect(bundle.form.pending.value).toBe(false);
        } finally {
          disposeForm(bundle.form);
        }
      }),
      propertyParams()
    );
  });

  it('повторный прогон на тех же значениях идемпотентен: статус и замечания те же', async () => {
    await fc.assert(
      fc.asyncProperty(valuesArb, specsArb, disabledArb, async (values, specs, disabled) => {
        const bundle = build(values, specs);
        try {
          disable(bundle, disabled);

          const first = await bundle.validate();
          const codes = codesOf(bundle);
          const second = await bundle.validate();

          expect(second.status).toBe(first.status);
          expect(codesOf(bundle)).toEqual(codes);
          expect(bundle.form.valid.value).toBe(second.status === 'valid');
        } finally {
          disposeForm(bundle.form);
        }
      }),
      propertyParams()
    );
  });

  it('warning-правила статус не меняют', async () => {
    await fc.assert(
      fc.asyncProperty(
        valuesArb,
        specsArb,
        warningsArb,
        fc.constantFrom<keyof Specs>('name', 'email', 'label'),
        async (values, specs, warnings, field) => {
          const plain = build(values, specs);
          const warned = build(values, { ...specs, [field]: [...specs[field], ...warnings] });
          try {
            const expected = (await plain.validate()).status;

            expect((await warned.validate()).status).toBe(expected);
            expect(warned.form.valid.value).toBe(plain.form.valid.value);
          } finally {
            disposeForm(plain.form);
            disposeForm(warned.form);
          }
        }
      ),
      propertyParams()
    );
  });
});
