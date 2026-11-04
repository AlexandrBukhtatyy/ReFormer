/**
 * Свойства генератора на случайных, но допустимых intent: то, что должно выполняться для любой формы,
 * а не только для тех, что пришли в голову автору тестов.
 *
 * - собранный бандл проходит собственную кросс-проверку;
 * - intent переживает круг через JSON и `readIntent` без потерь;
 * - вывод детерминирован: одинаковый вход — одинаковые файлы.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { typecheckFiles } from '../eval/lib/typecheck.mjs';
import { buildBundle } from '../src/core/generate/builders';
import { crossCheckBundle } from '../src/core/generate/cross-check';
import { normalizeIntent, readIntent, type FormIntent } from '../src/core/generate/form-intent';

const RUNS = 200;

/** Заведомо разные имена: `field0`, `field1`, … Именование — не предмет этих свойств. */
const names = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

const FIELD_KINDS = [
  {
    type: 'string',
    component: 'Input',
    initialValue: '',
    rules: ['required()', 'minLength(2)', 'email()'],
  },
  {
    type: 'string',
    component: 'Textarea',
    initialValue: '',
    rules: ['required()', 'maxLength(500)'],
  },
  {
    type: 'number',
    component: 'InputNumber',
    initialValue: 0,
    rules: ['required()', 'min(1)', 'max(100)'],
  },
  { type: 'boolean', component: 'Checkbox', initialValue: false, rules: ['required()'] },
] as const;

const fieldKind = fc.constantFrom(...FIELD_KINDS);
const target = fc.constantFrom('core', 'renderer-react', 'renderer-json');

const intentArbitrary: fc.Arbitrary<Partial<FormIntent>> = fc
  .record({
    target,
    kinds: fc.array(fieldKind, { minLength: 2, maxLength: 8 }),
    ruleFlags: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
    arrayKinds: fc.array(fieldKind, { minLength: 0, maxLength: 3 }),
    hasCompute: fc.boolean(),
    hasEnableWhen: fc.boolean(),
    wizardSteps: fc.constantFrom(0, 0, 2, 3),
  })
  .map(
    ({ target: stack, kinds, ruleFlags, arrayKinds, hasCompute, hasEnableWhen, wizardSteps }) => {
      const fieldNames = names('field', kinds.length);
      const fields = kinds.map((kind, index) => ({
        name: fieldNames[index],
        type: kind.type,
        component: kind.component,
        label: `Поле ${index}`,
        initialValue: kind.initialValue,
      }));
      const validation = kinds.flatMap((kind, index) =>
        ruleFlags[index] ? [{ target: fieldNames[index], rules: [kind.rules[0]] }] : []
      );
      const arrays =
        arrayKinds.length > 0
          ? [
              {
                name: 'rows',
                itemInterfaceName: 'RowItem',
                initialValue: [],
                itemFields: arrayKinds.map((kind, index) => ({
                  name: `cell${index}`,
                  type: kind.type,
                  component: kind.component,
                  label: `Ячейка ${index}`,
                  initialValue: kind.initialValue,
                })),
              },
            ]
          : [];
      const behavior = [
        ...(hasCompute
          ? [{ kind: 'compute' as const, target: 'computedTotal', sources: [], expr: '1 + 1' }]
          : []),
        ...(hasEnableWhen
          ? [
              {
                kind: 'enableWhen' as const,
                target: fieldNames[0],
                sources: [fieldNames[1]],
                expr: `Boolean(model.${fieldNames[1]})`,
              },
            ]
          : []),
      ];
      const allFields = hasCompute
        ? [
            ...fields,
            {
              name: 'computedTotal',
              type: 'number' as const,
              component: 'InputNumber',
              label: 'Итог',
              initialValue: 0,
            },
          ]
        : fields;
      const layoutRoot =
        wizardSteps > 0
          ? {
              kind: 'container' as const,
              component: 'FormWizard',
              children: Array.from({ length: wizardSteps }, (_, step) => ({
                kind: 'step' as const,
                title: `Шаг ${step + 1}`,
                children: allFields
                  .filter((_, index) => index % wizardSteps === step)
                  .map((field) => ({ kind: 'field' as const, ref: field.name })),
              })),
            }
          : undefined;
      return {
        formName: 'GeneratedForm',
        target: stack,
        fields: allFields,
        arrays,
        validation,
        behavior,
        ...(layoutRoot && arrays.length === 0 ? { layoutRoot } : {}),
      } as Partial<FormIntent>;
    }
  );

// Компилятор на десяти случайных формах идёт десятки секунд: только в ночном прогоне стенда.
if (process.env.REFORMER_TEST_SLOW === '1') {
  describe('случайный бандл компилируется', () => {
    it('десять форм проходят tsc с настоящими типами', () => {
      mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
      const directory = mkdtempSync(join(process.cwd(), '.tmp', 'generate-form-property-'));
      try {
        const samples = fc.sample(intentArbitrary, { seed: 20261102, numRuns: 10 });
        samples.forEach((partial, index) => {
          const moduleDirectory = join(directory, `form-${index}`);
          mkdirSync(moduleDirectory);
          const intent = normalizeIntent(partial);
          const files = buildBundle(intent, CATALOGS).files;
          for (const file of files) writeFileSync(join(moduleDirectory, file.path), file.content);
          const diagnostics = typecheckFiles(
            moduleDirectory,
            files
              .filter((file) => /\.tsx?$/.test(file.path))
              .map((file) => join(moduleDirectory, file.path))
          );
          expect(diagnostics, JSON.stringify(partial)).toEqual([]);
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }, 300_000);
  });
}

describe('свойства generate_form на случайных intent', () => {
  it('бандл проходит собственную кросс-проверку', () => {
    fc.assert(
      fc.property(intentArbitrary, (partial) => {
        const intent = normalizeIntent(partial);
        const { layoutJson } = buildBundle(intent, CATALOGS);
        const report = crossCheckBundle(intent, JSON.parse(layoutJson));
        expect(report.errors).toEqual([]);
      }),
      { numRuns: RUNS }
    );
  });

  it('intent переживает круг через JSON и readIntent без потерь', () => {
    fc.assert(
      fc.property(intentArbitrary, (partial) => {
        const intent = normalizeIntent(partial);
        const { intent: again, problems } = readIntent(JSON.parse(JSON.stringify(intent)));
        expect(problems).toEqual([]);
        expect(buildBundle(again, CATALOGS).files).toEqual(buildBundle(intent, CATALOGS).files);
      }),
      { numRuns: RUNS }
    );
  });

  it('вывод детерминирован', () => {
    fc.assert(
      fc.property(intentArbitrary, (partial) => {
        expect(buildBundle(normalizeIntent(partial), CATALOGS).files).toEqual(
          buildBundle(normalizeIntent(partial), CATALOGS).files
        );
      }),
      { numRuns: RUNS }
    );
  });
});
