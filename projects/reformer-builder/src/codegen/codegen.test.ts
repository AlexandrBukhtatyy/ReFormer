import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { synthMock } from '../preview-runtime/mock-synth';
import { buildExampleFiles, makeNames, appSnippet, validateExportable } from './index';

/** Представительная форма билдера: Div → Section (поля) + FormArray. */
const rawSchema = {
  version: '1.0',
  root: {
    component: '$html(div)',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: '$component(Section)',
        componentProps: { title: 'Заявка' },
        children: [
          {
            value: '$model(loanType)',
            component: '$component(Select)',
            componentProps: { label: 'Тип', options: '$dataSource(LOAN_TYPES)', required: true },
          },
          {
            value: '$model(amount)',
            component: '$component(Input)',
            componentProps: { label: 'Сумма', type: 'number' },
          },
          {
            value: '$model(agree)',
            component: '$component(Checkbox)',
            componentProps: { label: 'Согласен', required: true },
          },
        ],
      },
      {
        array: '$model(items)',
        initialValue: { name: '' },
        componentProps: { title: 'Позиции', itemLabel: '$dataSource(ITEM_LABEL)' },
        item: {
          $template: {
            component: '$html(div)',
            children: [
              {
                value: '$model(name)',
                component: '$component(Input)',
                componentProps: { label: 'Название' },
              },
            ],
          },
        },
      },
    ],
  },
} as unknown as JsonFormSchema;

const mock = synthMock(rawSchema, { now: new Date('2026-01-01T00:00:00Z') });
const files = buildExampleFiles(rawSchema, mock, 'loan');
const byPath = (p: string) => files.find((f) => f.path === p)!;

describe('buildExampleFiles — набор файлов', () => {
  it('11 файлов, ожидаемые пути, нет JSON-схемы', () => {
    expect(files.map((f) => f.path).sort()).toEqual(
      [
        'api.ts',
        'data-sources.ts',
        'form.behavior.ts',
        'index.tsx',
        'model.ts',
        'README.md',
        'registry.ts',
        'renderer.behavior.ts',
        'schema.ts',
        'types.ts',
        'validation.ts',
      ].sort()
    );
    expect(files.some((f) => f.path.endsWith('.json'))).toBe(false);
  });

  it('класс derived/user проставлен верно', () => {
    const derived = files
      .filter((f) => f.cls === 'derived')
      .map((f) => f.path)
      .sort();
    const user = files
      .filter((f) => f.cls === 'user')
      .map((f) => f.path)
      .sort();
    expect(derived).toEqual(
      ['README.md', 'index.tsx', 'model.ts', 'registry.ts', 'schema.ts', 'types.ts'].sort()
    );
    expect(user).toEqual(
      [
        'api.ts',
        'data-sources.ts',
        'form.behavior.ts',
        'renderer.behavior.ts',
        'validation.ts',
      ].sort()
    );
  });
});

describe('schema.ts — селекторы + submit впечены', () => {
  const src = byPath('schema.ts').content;
  it('типизированный литерал JsonFormSchema', () => {
    expect(src).toContain('export const schema: JsonFormSchema =');
  });
  it('вставлен submit-Button и selector-ы секции/массива', () => {
    expect(src).toContain('"selector": "submit"');
    expect(src).toContain('$component(Button)');
    expect(src).toContain('"zayavka-section"');
    expect(src).toContain('"items"');
  });
});

describe('registry.ts — привязки', () => {
  const src = byPath('registry.ts').content;
  it('FIELD_WRAPPER + field→Field + Button + импорт data-sources', () => {
    expect(src).toContain('reg.component(FIELD_WRAPPER, FormField)');
    expect(src).toContain('SelectField');
    expect(src).toContain('InputField');
    expect(src).toContain('CheckboxField');
    expect(src).toContain("reg.component('Button', Button)");
    expect(src).toContain("reg.dataSource('LOAN_TYPES', LOAN_TYPES)");
    expect(src).toContain("reg.dataSource('ITEM_LABEL', ITEM_LABEL)");
    expect(src).toContain("from './data-sources'");
  });
});

describe('types.ts — типы', () => {
  const src = byPath('types.ts').content;
  it('union для select, скалярные типы, массив', () => {
    expect(src).toContain('export type LoanForm =');
    expect(src).toContain("'option1'"); // union из синтетических опций
    expect(src).toContain('amount: number');
    expect(src).toContain('agree: boolean');
    expect(src).toContain('items: Array<{');
  });
});

describe('model.ts / data-sources.ts / behavior / validation / api', () => {
  it('model.ts — фабрика + initialValues', () => {
    const src = byPath('model.ts').content;
    expect(src).toContain('export function createLoanFormModel');
    expect(src).toContain('createInitialValues');
    expect(src).toContain('"loanType"');
  });
  it('data-sources.ts — опции из мока + itemLabel-стаб', () => {
    const src = byPath('data-sources.ts').content;
    expect(src).toContain('export const LOAN_TYPES: SelectOption[]');
    expect(src).toContain('export const ITEM_LABEL =');
    expect(src).toContain("import type { SelectOption } from './types'");
  });
  it('renderer.behavior.ts — submit + hideWhen scaffold', () => {
    const src = byPath('renderer.behavior.ts').content;
    expect(src).toContain('submitForm');
    expect(src).toContain("schema.node('submit')");
    expect(src).toContain("hideWhen(schema.node('zayavka-section')");
  });
  it('validation.ts — required из схемы', () => {
    const src = byPath('validation.ts').content;
    expect(src).toContain('model.$.loanType');
    expect(src).toContain('model.$.agree');
    expect(src).toContain('required(');
  });
  it('api.ts — submitForm стаб', () => {
    const src = byPath('api.ts').content;
    expect(src).toContain('export async function submitForm');
    expect(src).toContain('ApiResult');
  });
  it('form.behavior.ts — defineFormBehavior', () => {
    expect(byPath('form.behavior.ts').content).toContain('defineFormBehavior<LoanForm>');
  });
  it('README.md — сниппет + чеклист', () => {
    const src = byPath('README.md').content;
    expect(src).toContain('LoanPage');
    expect(src).toContain("import LoanPage from './pages/examples/loan'");
    expect(src).toContain('zayavka-section');
  });
});

describe('детерминизм', () => {
  it('два прогона с тем же моком байт-идентичны', () => {
    const a = buildExampleFiles(rawSchema, mock, 'loan');
    const b = buildExampleFiles(rawSchema, mock, 'loan');
    expect(a).toEqual(b);
  });
});

describe('naming / snippet / validateExportable', () => {
  it('makeNames', () => {
    const n = makeNames('loan-application');
    expect(n.dir).toBe('loan-application');
    expect(n.TypeName).toBe('LoanApplicationForm');
    expect(n.pageComponent).toBe('LoanApplicationPage');
    expect(n.routePath).toBe('/examples/loan-application');
  });
  it('appSnippet — 3 части', () => {
    const s = appSnippet(makeNames('loan'));
    expect(s).toContain("import LoanPage from './pages/examples/loan'");
    expect(s).toContain('<Route path="/examples/loan"');
  });
  it('validateExportable — пропуск $model в моке даёт warning', () => {
    const bare = {
      version: '1.0',
      root: {
        component: '$html(div)',
        children: [{ value: '$model(missing)', component: '$component(Input)' }],
      },
    } as unknown as JsonFormSchema;
    const rep = validateExportable(bare, { model: {}, dataSources: {} });
    expect(rep.warnings.some((w) => w.includes('missing'))).toBe(true);
  });
});
