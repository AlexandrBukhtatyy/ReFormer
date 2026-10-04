/**
 * Документ формата 2 в проверке (`validateFormSchema`), в сборке по файлам шагов
 * (`composeJsonFormSchema`) и в обходчиках (`collectSchemaSelectors`, `collectOperatorNames`).
 */
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { validateFormSchema } from './validate';
import { composeJsonFormSchema } from './compose';
import { collectSchemaSelectors } from './collect-schema-selectors';
import { collectOperatorNames } from './collect-operator-names';
import { buildFormSchemaMetaSchema, buildFormStepMetaSchema } from './schema';
import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  isPartNode,
  schemaFormatOf,
  type JsonFormSchema,
  type JsonNode,
} from './types/json-schema';

const opts = {
  componentNames: ['Input', 'Box', 'Section', 'FormArray', 'FormWizard', 'Step'],
  dataSourceNames: ['LOAN_TYPES'],
};

const document: JsonFormSchema = {
  format: 2,
  version: '1.0',
  parts: {
    address: {
      selector: 'address-box',
      component: '$component(Box)',
      children: [
        { model: '$model(city)', component: '$component(Input)' },
        {
          model: '$model(street)',
          component: '$component(Input)',
          componentProps: { options: '$dataSource(LOAN_TYPES)' },
        },
      ],
    },
    coBorrower: { selector: 'co-name', model: '$model(name)', component: '$component(Input)' },
  },
  root: {
    selector: 'wizard',
    component: '$component(FormWizard)',
    children: [
      {
        selector: 'loan',
        component: '$component(Step)',
        componentProps: { title: 'Кредит' },
        children: [
          { selector: 'loanType', model: '$model(loanType)', component: '$component(Input)' },
          { model: '$model(registrationAddress)', part: '$part(address)' },
          {
            selector: 'co-borrowers',
            model: '$model(coBorrowers)',
            component: '$component(FormArray)',
            item: '$part(coBorrower)',
          },
        ],
      },
    ],
  },
};

const withRoot = (root: unknown, parts?: Record<string, unknown>): unknown => ({
  format: 2,
  ...(parts ? { parts } : {}),
  root,
});

describe('validateFormSchema: формат 2', () => {
  it('принимает документ с частями, подформой и шаблоном строки из части', () => {
    const { valid, errors } = validateFormSchema(document, opts);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('массив без `initialValue` — норма: шаблон нового элемента живёт в модели', () => {
    const schema = withRoot({
      model: '$model(coBorrowers)',
      item: { $template: { model: '$model(name)', component: '$component(Input)' } },
    });
    expect(validateFormSchema(schema, opts).errors).toEqual([]);
  });

  it('заданный `initialValue` обязан нести все ключи строки — и для вписанного шаблона', () => {
    const schema = withRoot({
      model: '$model(coBorrowers)',
      initialValue: { name: '' },
      item: {
        $template: {
          component: '$component(Box)',
          children: [
            { model: '$model(name)', component: '$component(Input)' },
            { model: '$model(phone)', component: '$component(Input)' },
          ],
        },
      },
    });
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/missing element keys \[phone\]/);
  });

  it('…и для шаблона из именованной части', () => {
    const schema = withRoot(
      { model: '$model(coBorrowers)', initialValue: { title: '' }, item: '$part(coBorrower)' },
      { coBorrower: { model: '$model(name)', component: '$component(Input)' } }
    );
    expect(validateFormSchema(schema, opts).errors.join('\n')).toMatch(
      /missing element keys \[name\]/
    );
  });

  it('неизвестная часть в подформе и в шаблоне строки', () => {
    const schema = withRoot(
      {
        component: '$component(Box)',
        children: [
          { model: '$model(registrationAddress)', part: '$part(adress)' },
          { model: '$model(coBorrowers)', item: '$part(row)' },
        ],
      },
      { address: { component: '$component(Box)' } }
    );
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/unknown part "adress"/);
    expect(errors.join('\n')).toMatch(/unknown part "row"/);
  });

  it('имена компонентов и источников проверяются и внутри частей', () => {
    const schema = withRoot(
      { model: '$model(registrationAddress)', part: '$part(address)' },
      {
        address: {
          model: '$model(city)',
          component: '$component(Unknown)',
          componentProps: { options: '$dataSource(NOPE)' },
        },
      }
    );
    const text = validateFormSchema(schema, opts).errors.join('\n');
    expect(text).toMatch(/parts\.address\.component: unknown component "Unknown"/);
    expect(text).toMatch(/unknown dataSource "NOPE"/);
  });

  it('ключи прежнего формата в документе формата 2 отвергаются', () => {
    const field = validateFormSchema(
      withRoot({ value: '$model(email)', component: '$component(Input)' }),
      opts
    );
    expect(field.valid).toBe(false);
    expect(field.errors.join('\n')).toMatch(/unknown property "value"/);

    const array = validateFormSchema(
      withRoot({
        array: '$model(rows)',
        item: { $template: { model: '$model(name)', component: '$component(Input)' } },
      }),
      opts
    );
    expect(array.valid).toBe(false);
  });

  it('подформе не положены компонент и пропсы', () => {
    const schema = withRoot(
      {
        model: '$model(registrationAddress)',
        part: '$part(address)',
        component: '$component(Box)',
      },
      { address: { component: '$component(Box)' } }
    );
    expect(validateFormSchema(schema, opts).errors.join('\n')).toMatch(
      /unknown property "component"/
    );
  });

  it('`part` принимает только оператор `$part(...)`', () => {
    const schema = withRoot(
      { model: '$model(registrationAddress)', part: 'address' },
      { address: { component: '$component(Box)' } }
    );
    expect(validateFormSchema(schema, opts).valid).toBe(false);
  });

  it('документ без `format` проверяется как прежний формат', () => {
    const v1 = { root: { value: '$model(email)', component: '$component(Input)' } };
    expect(schemaFormatOf(v1)).toBe(1);
    expect(validateFormSchema(v1, opts).errors).toEqual([]);
    // Тот же узел с ключом формата 2 в документе без `format` — ошибка.
    const mixed = { root: { model: '$model(email)', component: '$component(Input)' } };
    expect(validateFormSchema(mixed, opts).valid).toBe(false);
  });

  it('несобранная ссылка на шаг в `children` визарда — ошибка с отсылкой к сборке', () => {
    const schema = withRoot({
      component: '$component(FormWizard)',
      children: [{ $ref: './steps/loan/form.schema.json' }],
    });
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/children\[0\].*not resolved.*composeJsonFormSchema/);
  });
});

describe('мета-схема формата 2', () => {
  const ajv = new Ajv({ allErrors: true });

  it('сужает имена компонентов и в частях документа', () => {
    const validate = ajv.compile(buildFormSchemaMetaSchema({ componentNames: ['Box', 'Input'] }));
    expect(
      validate(
        withRoot(
          { model: '$model(a)', part: '$part(p)' },
          { p: { model: '$model(x)', component: '$component(Input)' } }
        )
      )
    ).toBe(true);
    expect(
      validate(
        withRoot(
          { model: '$model(a)', part: '$part(p)' },
          { p: { model: '$model(x)', component: '$component(Unknown)' } }
        )
      )
    ).toBe(false);
  });

  it('файл шага — узел формата 2 под ключом `node`', () => {
    const validate = ajv.compile(buildFormStepMetaSchema({ componentNames: ['Step', 'Input'] }));
    const step = {
      component: '$component(Step)',
      children: [{ model: '$model(a)', component: '$component(Input)' }],
    };
    expect(validate({ node: step })).toBe(true);
    expect(
      validate({
        node: { ...step, children: [{ value: '$model(a)', component: '$component(Input)' }] },
      })
    ).toBe(false);
  });
});

describe('composeJsonFormSchema: шаги в `children`', () => {
  const loanStep: JsonNode = {
    selector: 'loan',
    component: '$component(Step)',
    children: [{ model: '$model(loanType)', component: '$component(Input)' }],
  };
  const skeleton = {
    format: 2,
    root: {
      component: '$component(FormWizard)',
      children: [{ $ref: './steps/loan/form.schema.json' }, loanStep],
    },
  };

  it('ссылка в `children` заменяется узлом шага; документ после сборки валиден', () => {
    const composed = composeJsonFormSchema(skeleton, {
      'steps/loan/form.schema.json': { node: loanStep },
    });
    const children = (composed.root as { children: unknown[] }).children;

    expect(children[0]).toBe(loanStep);
    expect(children[1]).toBe(loanStep);
    expect(validateFormSchema(skeleton, opts).valid).toBe(false);
    expect(validateFormSchema(composed, opts).errors).toEqual([]);
  });

  it('неизвестная ссылка — ошибка с путём в `children`', () => {
    expect(() => composeJsonFormSchema(skeleton, {})).toThrow(
      /root\.children\[0\].*steps\/loan\/form\.schema\.json/
    );
  });
});

describe('обходчики документа формата 2', () => {
  it('collectSchemaSelectors берёт селекторы корня и частей', () => {
    expect([...collectSchemaSelectors(document)].sort()).toEqual([
      'address-box',
      'co-borrowers',
      'co-name',
      'loan',
      'loanType',
      'wizard',
    ]);
  });

  it('collectOperatorNames берёт имена корня и частей', () => {
    const names = collectOperatorNames(document);
    expect([...names.components].sort()).toEqual([
      'Box',
      'FormArray',
      'FormWizard',
      'Input',
      'Step',
    ]);
    expect(names.dataSources).toEqual(['LOAN_TYPES']);
  });
});

describe('гарды узлов формата 2', () => {
  const array: JsonNode = { model: '$model(rows)', item: '$part(row)' };
  const part: JsonNode = { model: '$model(address)', part: '$part(address)' };
  const field: JsonNode = { model: '$model(email)', component: '$component(Input)' };
  const container: JsonNode = { component: '$component(Box)', children: [] };
  const kindOf = (node: JsonNode): string[] =>
    [
      isArrayNode(node) && 'array',
      isPartNode(node) && 'part',
      isFieldNode(node) && 'field',
      isContainerNode(node) && 'container',
    ].filter((kind): kind is string => typeof kind === 'string');

  it('узел попадает ровно под один гард', () => {
    expect(kindOf(array)).toEqual(['array']);
    expect(kindOf(part)).toEqual(['part']);
    expect(kindOf(field)).toEqual(['field']);
    expect(kindOf(container)).toEqual(['container']);
  });

  it('массив с вписанным шаблоном — тоже массив; поле-массив без `item` — поле', () => {
    expect(kindOf({ model: '$model(rows)', item: { $template: field } })).toEqual(['array']);
    expect(kindOf({ model: '$model(tags)', component: '$component(SelectMulti)' })).toEqual([
      'field',
    ]);
  });
});
