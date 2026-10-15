import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { checkRules, dropOrphanRules, ruleTargetPath, ruleWarnings } from './rules-integrity';
import { emptyRules, type FormRules } from './rules';

const schema = (): JsonFormSchema =>
  ({
    format: 2,
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
        { model: '$model(amount)', component: '$component(Input)' },
        {
          model: '$model(items)',
          initialValue: { price: 0 },
          item: {
            $template: {
              component: '$html(div)',
              children: [{ model: '$model(price)', component: '$component(Input)' }],
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

  it('цель правила строки принимается в обеих записях: от строки и полным путём', () => {
    // От строки цель пишет билдер одной схемы, полным путём — билдер единого контракта. Запись
    // от строки искалась среди полей ФОРМЫ, и исправное правило объявлялось осиротевшим.
    const relative: FormRules = {
      ...emptyRules(),
      validation: [{ target: 'price', rules: ['required'], each: 'items' }],
    };
    const full: FormRules = {
      ...emptyRules(),
      validation: [{ target: 'items.price', rules: ['required'], each: 'items' }],
    };
    expect(checkRules(schema(), relative)).toEqual([]);
    expect(checkRules(schema(), full)).toEqual([]);
    expect(ruleTargetPath(relative.validation[0]!)).toBe('items.price');
    expect(ruleTargetPath(full.validation[0]!)).toBe('items.price');
    // Без `each` цель — путь от корня формы, как и была.
    expect(ruleTargetPath({ target: 'amount' })).toBe('amount');
  });

  it('правило строки несуществующего массива остаётся замечанием — с полным путём', () => {
    const rules: FormRules = {
      ...emptyRules(),
      validation: [{ target: 'price', rules: ['required'], each: 'ghosts' }],
    };
    expect(checkRules(schema(), rules)).toMatchObject([
      { list: 'validation', index: 0, missing: 'ghosts.price' },
    ]);
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

describe('правила над именованными частями документа', () => {
  const withParts = (): JsonFormSchema =>
    ({
      format: 2,
      version: '1.0',
      parts: {
        address: {
          component: '$html(div)',
          children: [
            { selector: 'address-city', model: '$model(city)', component: '$component(Input)' },
          ],
        },
      },
      root: {
        component: '$html(div)',
        children: [
          { model: '$model(home)', part: '$part(address)' },
          { model: '$model(guests)', item: '$part(address)' },
        ],
      },
    }) as unknown as JsonFormSchema;

  it('поле подформы, поле части-строки и узел части — не осиротевшие', () => {
    const rules: FormRules = {
      validation: [
        { target: 'home.city', rules: ['required'] },
        { target: 'city', each: 'guests', rules: ['required'] },
        { target: 'guests.city', each: 'guests', rules: ['required'] },
      ],
      behavior: [],
      render: [{ kind: 'hideWhen', selector: 'address-city', condition: 'false' }],
    };
    expect(checkRules(withParts(), rules)).toEqual([]);
  });

  it('поле части без подключения в цель не годится: его пути в модели формы нет', () => {
    const rules: FormRules = {
      ...emptyRules(),
      validation: [{ target: 'city', rules: ['required'] }],
    };
    expect(checkRules(withParts(), rules).map((problem) => problem.missing)).toEqual(['city']);
  });
});
