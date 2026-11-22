/**
 * `validateFormSchema` на документе формата 2: структура и синтаксис операторов, имена реестра,
 * ключи локали, шаблон нового элемента массива, HTML-узлы. Части документа, подформы и документ
 * прежнего формата — в `validate.v2.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { validateFormSchema } from './validate';

const opts = {
  componentNames: ['Input', 'Select', 'Box', 'Section'],
  dataSourceNames: ['LOAN_TYPES'],
};

const validSchema = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Section)',
        children: [
          {
            selector: 'email',
            model: '$model(email)',
            component: '$component(Input)',
            componentProps: { label: 'Email' },
          },
          {
            selector: 'loanType',
            model: '$model(loanType)',
            component: '$component(Select)',
            componentProps: { label: 'Тип', options: '$dataSource(LOAN_TYPES)' },
          },
        ],
      },
      {
        model: '$model(coBorrowers)',
        initialValue: { name: '' },
        item: {
          $template: {
            model: '$model(name)',
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
      format: 2,
      root: { model: '$model(deeply.nested.0.path)', component: '$component(Input)' },
    };
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('rejects an unknown $component name', () => {
    const schema = {
      format: 2,
      root: { model: '$model(x)', component: '$component(Nope)' },
    };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a binding that is not a $model operator (bad syntax)', () => {
    const schema = {
      format: 2,
      root: { model: 'email', component: '$component(Input)' },
    };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/model.*pattern/i);
  });

  it('rejects an unknown $dataSource name nested in componentProps', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(loanType)',
        component: '$component(Select)',
        componentProps: { options: '$dataSource(MISSING)' },
      },
    };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/dataSource.*MISSING/i);
  });

  it('rejects a node missing its required discriminator (no model/component)', () => {
    const schema = { format: 2, root: { selector: 'orphan', componentProps: {} } };
    expect(validateFormSchema(schema, opts).valid).toBe(false);
  });

  it('accepts an array node that provides a complete initialValue', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(coBorrowers)',
        initialValue: { name: '' },
        item: { $template: { model: '$model(name)', component: '$component(Input)' } },
      },
    };
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('flags an array node whose initialValue is missing a template element key (§8)', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(properties)',
        initialValue: { type: '' }, // не хватает estimatedValue
        item: {
          $template: {
            component: '$component(Box)',
            children: [
              { model: '$model(type)', component: '$component(Input)' },
              { model: '$model(estimatedValue)', component: '$component(Input)' },
            ],
          },
        },
      },
    };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/estimatedValue/);
  });

  it('accepts a complete initialValue; nested-array key counts, its inner leaves do not (§8)', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(properties)',
        // ключи элемента: type (лист) + docs (вложенный массив). Внутренний лист вложенного
        // массива (fileName) — ключ ВЛОЖЕННОГО элемента, в этот initialValue входить не должен.
        initialValue: { type: '', docs: [] },
        item: {
          $template: {
            component: '$component(Box)',
            children: [
              { model: '$model(type)', component: '$component(Input)' },
              {
                model: '$model(docs)',
                initialValue: { fileName: '' },
                item: { $template: { model: '$model(fileName)', component: '$component(Input)' } },
              },
            ],
          },
        },
      },
    };
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('accepts an array node with a $component and NO initialValue (display-list path)', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(alerts)',
        component: '$component(List)',
        item: {
          $template: {
            component: '$component(Section)',
            componentProps: { message: '$model(message)' },
          },
        },
      },
    };
    const componentNames = ['Input', 'Select', 'Box', 'Section', 'List'];
    expect(validateFormSchema(schema, { ...opts, componentNames }).valid).toBe(true);
  });

  it('rejects an unknown $fn name nested in componentProps', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(properties)',
        initialValue: { type: '' },
        componentProps: { itemLabel: '$fn(MISSING)' },
        item: { $template: { model: '$model(type)', component: '$component(Input)' } },
      },
    };
    const { valid, errors } = validateFormSchema(schema, { ...opts, fnNames: ['itemLabel'] });
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/fn.*MISSING/i);
  });

  it('rejects a dataSource name used as $fn (cross-type)', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(x)',
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
      format: 2,
      root: {
        model: '$model(x)',
        component: '$component(Input)',
        componentProps: { format: '$fn(whatever)' },
      },
    };
    // Без fnNames проверка имён $fn мягко пропускается (синтаксис валиден).
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('rejects an unknown $locale key when a catalog (localeKeys) is provided', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(email)',
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
      format: 2,
      root: {
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: '$locale(any.key)' },
      },
    };
    expect(validateFormSchema(schema, opts).valid).toBe(true);
  });

  it('rejects an unknown key in the structured { $locale, params } form', () => {
    const schema = {
      format: 2,
      root: {
        model: '$model(x)',
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
      format: 2,
      root: {
        model: '$model(x)',
        component: '$component(Input)',
        componentProps: { label: { $locale: 'fields.min', params: { count: 3 } } },
      },
    };
    expect(validateFormSchema(schema, { ...opts, localeKeys: ['fields.min'] }).valid).toBe(true);
  });

  it('reports only the relevant branch, not a cross-branch wall, for a bad node', () => {
    // Узел явно поле (несёт `model` без `item` / `part`), но `model` — не $model-оператор.
    const schema = { format: 2, root: { model: 'email', component: '$component(Input)' } };
    const { valid, errors } = validateFormSchema(schema, opts);
    expect(valid).toBe(false);
    // Настоящая причина всплывает (pattern у model)…
    expect(errors.join('\n')).toMatch(/model.*pattern/i);
    // …и НЕ погребена под ошибками чужих ветвей (массив/подформа), oneOf- или then/else-шумом.
    expect(errors.join('\n')).not.toMatch(/oneOf/i);
    expect(errors.join('\n')).not.toMatch(/'item'|'part'/i);
    expect(errors.join('\n')).not.toMatch(/then|else/i);
    // Ровно одна структурная ошибка — по model, без кросс-ветвевой стены.
    expect(errors.filter((e) => e.includes('/root')).length).toBe(1);
  });

  describe('HTML-узлы ($html(tag) + текстовые children)', () => {
    it('принимает html-узел с текстом и вложенными узлами', () => {
      const schema = {
        format: 2,
        root: {
          component: '$html(div)',
          componentProps: { className: 'p-4' },
          children: [
            { component: '$html(h3)', children: ['Итого'] },
            { component: '$html(p)', children: ['Платёж: ', '$model(monthlyPayment)', ' ₽'] },
            { component: '$html(hr)' },
            { model: '$model(email)', component: '$component(Input)' },
          ],
        },
      };
      expect(validateFormSchema(schema, opts)).toEqual({ valid: true, errors: [] });
    });

    it('принимает текст после вложенного узла', () => {
      const schema = {
        format: 2,
        root: {
          component: '$html(p)',
          children: [{ component: '$html(b)', children: ['Важно:'] }, ' и далее текст'],
        },
      };
      expect(validateFormSchema(schema, opts)).toEqual({ valid: true, errors: [] });
    });

    it('отвергает тег вне whitelist', () => {
      const schema = { format: 2, root: { component: '$html(script)' } };
      const { valid, errors } = validateFormSchema(schema, opts);
      expect(valid).toBe(false);
      expect(errors.join('\n')).toMatch(/not allowed in \$html/i);
    });

    it('проверяет теги даже без реестра — whitelist статичен', () => {
      const schema = { format: 2, root: { component: '$html(iframe)' } };
      expect(validateFormSchema(schema).valid).toBe(false);
    });

    it('находит запрещённый тег во вложенном узле', () => {
      const schema = {
        format: 2,
        root: {
          component: '$component(Box)',
          children: [{ component: '$html(div)', children: [{ component: '$html(object)' }] }],
        },
      };
      const { valid, errors } = validateFormSchema(schema, opts);
      expect(valid).toBe(false);
      expect(errors.join('\n')).toMatch(/"object"/);
    });

    it('отвергает снятое поле text — содержимое живёт в children', () => {
      const schema = { format: 2, root: { component: '$html(p)', text: 'Внимание' } };
      const { valid, errors } = validateFormSchema(schema, opts);
      expect(valid).toBe(false);
      expect(errors.join('\n')).toMatch(/text/);
    });

    it('отвергает текстового ребёнка неверного типа', () => {
      const schema = { format: 2, root: { component: '$html(p)', children: [true] } };
      expect(validateFormSchema(schema, opts).valid).toBe(false);
    });

    it('$html не проходит там, где ожидается компонент реестра ($component)', () => {
      const schema = { format: 2, root: { component: '$component(html)' } };
      const { valid, errors } = validateFormSchema(schema, opts);
      expect(valid).toBe(false);
      expect(errors.join('\n')).toMatch(/unknown component/i);
    });
  });
});
