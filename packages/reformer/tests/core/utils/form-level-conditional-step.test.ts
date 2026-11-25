/**
 * Условный шаг потока сборки — скрытый узел шага.
 *
 * Шаг «Компания» заказа нужен только юрлицу: `hideWhen(schema.node('company'), …)` в поведении
 * формы. Пока узел скрыт, поток сборки шаг пропускает (его нет в `flow.activeSteps`), а правила
 * шага не исполняются ни переходом, ни отправкой — иначе физлицо не отправило бы заказ из-за
 * полей, которых не видит. Здесь же — принудительное скрытие узла (`setHidden`), шаги без узла в
 * дереве схемы (визард в JSX) и чтение скрытия узла `isNodeHidden`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed } from '@preact/signals-core';
import { issueCodes } from '../../test-utils/issues';
import { createForm, type FormBundle } from '../../../src/form/form-bundle';
import { defineFormBehavior, hideWhen } from '../../../src/form/behaviors';
import { createSchemaScope, isNodeHidden } from '../../../src/form/schema-controller';
import { defineValidation, validate } from '../../../src/form/validation';
import type { FormModel } from '../../../src/model/types';
import type { FormFlowConfig } from '../../../src/form/form-level';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';
import type { ValidationIssue } from '../../../src/form/types/contracts';

interface Order {
  customerType: 'person' | 'company';
  name: string;
  companyName: string;
  city: string;
}

const EMPTY: Order = { customerType: 'person', name: '', companyName: '', city: '' };

const Stub = (): null => null;

/** Дерево заказа: визард из трёх шагов, идентификатор шага — `selector` узла. */
const orderSchema = (model: FormModel<Order>): FormSchemaNode => ({
  selector: 'wizard',
  component: Stub,
  children: [
    {
      selector: 'buyer',
      component: Stub,
      children: [
        { model: model.$.customerType, component: Stub },
        { model: model.$.name, component: Stub },
      ],
    },
    {
      selector: 'company',
      component: Stub,
      children: [{ model: model.$.companyName, component: Stub }],
    },
    {
      selector: 'delivery',
      component: Stub,
      children: [{ model: model.$.city, component: Stub }],
    },
  ],
});

/** Правило «поле заполнено» со своим кодом — шпион: по нему считают вызовы. */
const filled = (code: string) =>
  vi.fn((value: unknown): ValidationIssue | null => (value === '' ? { code } : null));

const bundles: FormBundle<Order>[] = [];
afterEach(() => {
  for (const bundle of bundles.splice(0)) bundle.dispose();
  vi.restoreAllMocks();
});

interface SetupOptions {
  schema?: ((model: FormModel<Order>) => FormSchemaNode) | null;
  onInvalidSubmit?: FormFlowConfig<Order>['onInvalidSubmit'];
}

function setup(options: SetupOptions = {}) {
  const spies = {
    name: filled('name.required'),
    companyName: filled('companyName.required'),
    city: filled('city.required'),
  };
  const behavior = defineFormBehavior<Order>(({ model, schema }) => {
    hideWhen(schema.node('company'), () => model.customerType !== 'company');
  });
  const bundle = createForm<Order>({
    initial: structuredClone(EMPTY),
    ...(options.schema === null ? {} : { schema: options.schema ?? orderSchema }),
    behavior,
    flow: {
      steps: [
        {
          id: 'buyer',
          rules: defineValidation<Order>(({ model }) => validate(model.$.name, [spies.name])),
        },
        {
          id: 'company',
          rules: defineValidation<Order>(({ model }) =>
            validate(model.$.companyName, [spies.companyName])
          ),
        },
        {
          id: 'delivery',
          rules: defineValidation<Order>(({ model }) => validate(model.$.city, [spies.city])),
        },
      ],
      onInvalidSubmit: options.onInvalidSubmit,
    },
  });
  bundles.push(bundle);
  return { bundle, spies, flow: bundle.flow! };
}

describe('условный шаг: поток сборки пропускает скрытый узел шага', () => {
  it('у физлица шага «Компания» в потоке нет, у юрлица — есть', () => {
    const { bundle, flow } = setup();

    expect(flow.steps).toEqual(['buyer', 'company', 'delivery']);
    expect(flow.activeSteps.value).toEqual(['buyer', 'delivery']);

    bundle.model.customerType = 'company';

    expect(flow.activeSteps.value).toEqual(['buyer', 'company', 'delivery']);
  });

  it('«Далее» у физлица ведёт с покупателя сразу на доставку', async () => {
    const { bundle, flow } = setup();
    bundle.model.name = 'Анна';

    expect(await flow.next()).toEqual({ status: 'moved', from: 'buyer', to: 'delivery' });
    expect(flow.isLast.value).toBe(true);
    expect(flow.goTo('company')).toEqual({
      status: 'stayed',
      step: 'delivery',
      reason: 'inactive',
    });
  });

  it('«Далее» у юрлица ведёт на «Компанию» и проверяет её правила', async () => {
    const { bundle, flow } = setup();
    bundle.model.patch({ customerType: 'company', name: 'Анна' });

    expect(await flow.next()).toEqual({ status: 'moved', from: 'buyer', to: 'company' });
    expect(await flow.next()).toMatchObject({
      status: 'stayed',
      step: 'company',
      reason: 'invalid',
    });
    expect(issueCodes(bundle.form.companyName)).toEqual(['companyName.required']);
  });

  it('состав участвующих шагов меняется реактивно — подписчик узнаёт о смене', () => {
    const { bundle, flow } = setup();
    const seen: string[] = [];
    const stop = flow.activeSteps.subscribe((steps) => seen.push(steps.join(',')));

    bundle.model.customerType = 'company';
    bundle.model.customerType = 'person';
    stop();

    expect(seen).toEqual(['buyer,delivery', 'buyer,company,delivery', 'buyer,delivery']);
  });
});

describe('условный шаг: правила пропущенного шага не исполняются', () => {
  it('отправка физлица проходит с пустым полем шага «Компания»', async () => {
    const { bundle, spies } = setup();
    bundle.model.patch({ name: 'Анна', city: 'Москва' });
    const handler = vi.fn(() => 'sent');

    const outcome = await bundle.submission.submit(handler);

    expect(outcome).toEqual({ status: 'submitted', result: 'sent' });
    expect(spies.companyName).not.toHaveBeenCalled();
    expect(spies.name).toHaveBeenCalled();
  });

  it('отправка юрлица с пустым полем шага «Компания» отказывает', async () => {
    const { bundle } = setup({ onInvalidSubmit: 'firstInvalidStep' });
    bundle.model.patch({ customerType: 'company', name: 'Анна', city: 'Москва' });
    await bundle.flow!.next();
    bundle.model.companyName = 'Ромашка';
    await bundle.flow!.next();
    bundle.model.companyName = '';

    const outcome = await bundle.submission.submit(vi.fn());

    expect(outcome).toMatchObject({ status: 'invalid' });
    expect(bundle.flow!.current.value).toBe('company');
  });

  it('шаг перестал участвовать — полная проверка гасит замечания его полей', async () => {
    const { bundle } = setup();
    bundle.model.patch({ customerType: 'company', name: 'Анна', city: 'Москва' });
    expect((await bundle.validate()).status).toBe('invalid');
    expect(issueCodes(bundle.form.companyName)).toEqual(['companyName.required']);

    bundle.model.customerType = 'person';

    expect((await bundle.validate()).status).toBe('valid');
    expect(issueCodes(bundle.form.companyName)).toEqual([]);
  });

  it('validateStep пропущенного шага — без замечаний и без вызова правил', async () => {
    const { bundle, spies } = setup();

    expect((await bundle.validateStep('company')).status).toBe('valid');
    expect(spies.companyName).not.toHaveBeenCalled();

    bundle.model.customerType = 'company';

    expect((await bundle.validateStep('company')).status).toBe('invalid');
  });
});

describe('условный шаг: принудительное скрытие и шаги без узла в дереве', () => {
  it('setHidden узла шага убирает шаг из потока, resetHidden — возвращает', () => {
    const { bundle, flow } = setup();
    bundle.model.customerType = 'company';

    bundle.render.node('delivery').setHidden(true);
    expect(flow.activeSteps.value).toEqual(['buyer', 'company']);

    bundle.render.node('delivery').resetHidden();
    expect(flow.activeSteps.value).toEqual(['buyer', 'company', 'delivery']);
  });

  it('принудительное значение главнее условия hideWhen', () => {
    const { bundle, flow } = setup();

    bundle.render.node('company').setHidden(false);

    expect(flow.activeSteps.value).toEqual(['buyer', 'company', 'delivery']);
  });

  it('без схемы (визард в JSX) правило скрытия шага действует так же', async () => {
    const { bundle, flow } = setup({ schema: null });
    bundle.model.name = 'Анна';

    expect(flow.activeSteps.value).toEqual(['buyer', 'delivery']);
    expect(await flow.next()).toEqual({ status: 'moved', from: 'buyer', to: 'delivery' });
  });

  it('дерево без узлов шагов: правило скрытия шага — не «узел не найден»', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setup({ schema: (model) => ({ model: model.$.name, component: Stub }) });

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('isNodeHidden — скрыт ли узел области', () => {
  it('без правил узел виден', () => {
    const scope = createSchemaScope();

    expect(isNodeHidden(scope.__overrideMaps, 'company')).toBe(false);
  });

  it('условие, записанное после первого чтения, видно подписчику', () => {
    const scope = createSchemaScope();
    const hidden = computed(() => isNodeHidden(scope.__overrideMaps, 'company'));
    expect(hidden.value).toBe(false);

    const remove = scope.node('company').addHideCondition(() => true);
    expect(hidden.value).toBe(true);

    remove();
    expect(hidden.value).toBe(false);
  });

  it('принудительное значение главнее условия, сброс возвращает условие', () => {
    const scope = createSchemaScope();
    const hidden = computed(() => isNodeHidden(scope.__overrideMaps, 'company'));
    scope.node('company').addHideCondition(() => true);

    scope.node('company').setHidden(false);
    expect(hidden.value).toBe(false);

    scope.node('company').resetHidden();
    expect(hidden.value).toBe(true);
  });
});
