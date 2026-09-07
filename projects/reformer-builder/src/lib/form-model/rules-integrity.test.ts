import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { checkRules, dropOrphanRules, ruleWarnings } from './rules-integrity';
import { emptyRules, type FormRules } from './rules';

const schema = (): JsonFormSchema =>
  ({
    version: '1.0',
    root: {
      component: '$html(div)',
      children: [
        {
          component: '$component(Section)',
          selector: 'dostavka-section',
          componentProps: { title: 'Доставка' },
          children: [],
        },
        { value: '$model(amount)', component: '$component(Input)' },
        {
          array: '$model(items)',
          initialValue: { price: 0 },
          item: {
            $template: {
              component: '$html(div)',
              children: [{ value: '$model(price)', component: '$component(Input)' }],
            },
          },
        },
      ],
    },
  }) as unknown as JsonFormSchema;

describe('checkRules — правило, указывающее в никуда', () => {
  it('чистый набор не даёт замечаний', () => {
    const rules: FormRules = {
      validation: [{ target: 'amount', rules: ['required'] }],
      behavior: [{ kind: 'enableWhen', target: 'amount', sources: [], expr: 'true' }],
      render: [{ kind: 'hideWhen', selector: 'dostavka-section', condition: 'false' }],
    };
    expect(checkRules(schema(), rules)).toEqual([]);
  });

  it('вложенный путь массива законен — точное совпадение отвергло бы правила для items', () => {
    const rules: FormRules = {
      ...emptyRules(),
      validation: [{ target: 'items.price', rules: ['required'], each: 'items' }],
    };
    expect(checkRules(schema(), rules)).toEqual([]);
  });

  it('валидация на удалённое поле сообщается с адресом', () => {
    const rules: FormRules = {
      ...emptyRules(),
      validation: [{ target: 'ghost', rules: ['required'] }],
    };
    const [p] = checkRules(schema(), rules);
    expect(p).toMatchObject({ list: 'validation', index: 0, missing: 'ghost' });
  });

  it('поведение проверяется и по target, и по sources', () => {
    const rules: FormRules = {
      ...emptyRules(),
      behavior: [{ kind: 'computeFrom', target: 'amount', sources: ['ghost'], expr: '1' }],
    };
    const [p] = checkRules(schema(), rules);
    expect(p).toMatchObject({ list: 'behavior', missing: 'ghost' });
  });

  it('render-правило на несуществующий селектор — главный молчаливый отказ', () => {
    const rules: FormRules = {
      ...emptyRules(),
      render: [{ kind: 'hideWhen', selector: 'typo-section', condition: 'false' }],
    };
    const [p] = checkRules(schema(), rules);
    expect(p).toMatchObject({ list: 'render', missing: 'typo-section' });
    // Формулировка обязана называть последствие: в рантайме schema.node('typo') — тихий no-op.
    expect(p.message).toContain('ничего не сделает');
  });

  it('замечания текстом идут в общий канал предупреждений', () => {
    const rules: FormRules = {
      ...emptyRules(),
      render: [{ kind: 'patchProps', selector: 'nope', props: {} }],
    };
    expect(ruleWarnings(schema(), rules)).toHaveLength(1);
  });
});

describe('dropOrphanRules — только по явному решению пользователя', () => {
  it('убирает осиротевшие и не трогает годные', () => {
    const rules: FormRules = {
      validation: [
        { target: 'amount', rules: ['required'] },
        { target: 'ghost', rules: ['required'] },
      ],
      behavior: [],
      render: [
        { kind: 'hideWhen', selector: 'dostavka-section', condition: 'false' },
        { kind: 'hideWhen', selector: 'typo', condition: 'false' },
      ],
    };
    const out = dropOrphanRules(schema(), rules);
    expect(out.validation).toHaveLength(1);
    expect(out.validation[0].target).toBe('amount');
    expect(out.render).toHaveLength(1);
    expect(out.render[0].selector).toBe('dostavka-section');
  });
});
