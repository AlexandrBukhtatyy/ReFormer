import { describe, it, expect } from 'vitest';
import { validateFormSchema } from './validate';

const opts = {
  componentNames: ['Input', 'Select', 'Box', 'Section'],
  sourceNames: ['LOAN_TYPES'],
};

const validSchema = {
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Section)',
        children: [
          {
            selector: 'email',
            value: '$model(email)',
            component: '$component(Input)',
            componentProps: { label: 'Email' },
          },
          {
            selector: 'loanType',
            value: '$model(loanType)',
            component: '$component(Select)',
            componentProps: { label: 'Тип', options: '$dataSource(LOAN_TYPES)' },
          },
        ],
      },
      {
        array: '$model(coBorrowers)',
        initialValue: { name: '' },
        item: {
          $template: {
            value: '$model(name)',
            component: '$component(Input)',
          },
        },
      },
    ],
  },
};

describe('validateFormSchema', () => {
  it('accepts a well-formed schema (structure + operators + registry names)', () => {
    const { valid, errors } = validateFormSchema(validSchema, opts);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('accepts any $model path (paths are dynamic, only syntax is checked)', () => {
    const schema = {
      root: { value: '$model(deeply.nested.0.path)', component: '$component(Input)' },
    };
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('rejects an unknown $component name', () => {
    const schema = {
      root: { value: '$model(x)', component: '$component(Nope)' },
    };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a value that is not a $model operator (bad syntax)', () => {
    const schema = {
      root: { value: 'email', component: '$component(Input)' },
    };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/value|pattern/i);
  });

  it('rejects an unknown $dataSource name nested in componentProps', () => {
    const schema = {
      root: {
        value: '$model(loanType)',
        component: '$component(Select)',
        componentProps: { options: '$dataSource(MISSING)' },
      },
    };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/dataSource.*MISSING/i);
  });

  it('rejects a node missing its required discriminator (no value/array/component)', () => {
    const schema = { root: { selector: 'orphan', componentProps: {} } };
    expect(validateFormSchema(schema, opts).valid).toBe(false);
  });
});
