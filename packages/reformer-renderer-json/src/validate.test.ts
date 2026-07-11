import { describe, it, expect } from 'vitest';
import { validateFormSchema } from './validate';

const opts = {
  componentNames: ['Input', 'Select', 'Box', 'Section'],
  dataSourceNames: ['LOAN_TYPES'],
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

  it('flags an array node that omits initialValue (silently-broken elements)', () => {
    const schema = {
      root: {
        array: '$model(coBorrowers)',
        item: { $template: { value: '$model(name)', component: '$component(Input)' } },
      },
    };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/initialValue/i);
  });

  it('accepts an array node that provides initialValue', () => {
    const schema = {
      root: {
        array: '$model(coBorrowers)',
        initialValue: { name: '' },
        item: { $template: { value: '$model(name)', component: '$component(Input)' } },
      },
    };
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('rejects an unknown $fn name nested in componentProps', () => {
    const schema = {
      root: {
        array: '$model(properties)',
        initialValue: { type: '' },
        componentProps: { itemLabel: '$fn(MISSING)' },
        item: { $template: { value: '$model(type)', component: '$component(Input)' } },
      },
    };
    const { valid, errors } = validateFormSchema(schema, { ...opts, fnNames: ['itemLabel'] });
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/fn.*MISSING/i);
  });

  it('rejects a dataSource name used as $fn (cross-type)', () => {
    const schema = {
      root: {
        value: '$model(x)',
        component: '$component(Input)',
        componentProps: { format: '$fn(LOAN_TYPES)' },
      },
    };
    // LOAN_TYPES известен как dataSource, но НЕ как fn → ошибка ещё на validate.
    const { valid, errors } = validateFormSchema(schema, { ...opts, fnNames: ['itemLabel'] });
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/fn.*LOAN_TYPES/i);
  });

  it('skips $fn name checks when fnNames is not provided', () => {
    const schema = {
      root: {
        value: '$model(x)',
        component: '$component(Input)',
        componentProps: { format: '$fn(whatever)' },
      },
    };
    // Без fnNames проверка имён $fn мягко пропускается (синтаксис валиден).
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('rejects an unknown $locale key when a catalog (localeKeys) is provided', () => {
    const schema = {
      root: {
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: '$locale(fields.typo)' },
      },
    };
    const { valid, errors } = validateFormSchema(schema, {
      ...opts,
      localeKeys: ['fields.email.label'],
    });
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/locale key.*fields\.typo/i);
  });

  it('skips $locale key checks when localeKeys is not provided (open-ended keys)', () => {
    const schema = {
      root: {
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: '$locale(any.key)' },
      },
    };
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('rejects an unknown key in the structured { $locale, params } form', () => {
    const schema = {
      root: {
        value: '$model(x)',
        component: '$component(Input)',
        componentProps: { label: { $locale: 'fields.typo', params: { count: 3 } } },
      },
    };
    const { valid, errors } = validateFormSchema(schema, { ...opts, localeKeys: ['fields.min'] });
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/locale key.*fields\.typo/i);
  });

  it('accepts a known key in the structured { $locale, params } form', () => {
    const schema = {
      root: {
        value: '$model(x)',
        component: '$component(Input)',
        componentProps: { label: { $locale: 'fields.min', params: { count: 3 } } },
      },
    };
    expect(validateFormSchema(schema, { ...opts, localeKeys: ['fields.min'] }).valid).toBe(true);
  });

  it('reports only the relevant branch, not a cross-branch wall, for a bad node', () => {
    // Узел явно field (несёт `value`), но `value` — не $model-оператор.
    const schema = { root: { value: 'email', component: '$component(Input)' } };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    // Настоящая причина всплывает (pattern у value)…
    expect(errors.join('\n')).toMatch(/value.*pattern/i);
    // …и НЕ погребена под ошибками чужих ветвей (array/item), oneOf- или then/else-шумом.
    expect(errors.join('\n')).not.toMatch(/oneOf/i);
    expect(errors.join('\n')).not.toMatch(/'array'|'item'/i);
    expect(errors.join('\n')).not.toMatch(/then|else/i);
    // Ровно одна структурная ошибка — по value, без кросс-ветвевой стены.
    expect(errors.filter((e) => e.includes('/root')).length).toBe(1);
  });
});
