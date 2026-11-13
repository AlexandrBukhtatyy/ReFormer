/**
 * Отказ отправки визарда переводит поток на первый шаг с ошибкой — `flow.onInvalidSubmit`
 * (ReFormer-d4bd).
 *
 * `bundle.submission.submit` прогоняет правила всех шагов, но поток по умолчанию не трогает. У
 * визарда с размонтированными неактивными шагами замечание раннего шага — межшаговое правило,
 * устаревшее после правки на позднем, — не видно, и «Отправить» на последнем шаге как будто ничего
 * не делает. С `onInvalidSubmit: 'firstInvalidStep'` отказ `invalid` переводит поток на первый шаг,
 * правила которого в том же прогоне проверили поле с блокирующим замечанием.
 *
 * Здесь — какой шаг находится (свои правила шага, вложенный `apply`, `extras` на поле шага,
 * async-правило, полный набор `validation.rules`), когда поток остаётся (`'stay'` по умолчанию,
 * текущий шаг, замечание только `extras`, закрытый шаг впереди, предупреждение, `error`,
 * `cancelled`) и что переход не исполняет правил сверх отправки — и с живой фазой шагов.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { controlledAsyncRule } from '../../test-utils/async-rules';
import { tick } from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';
import { createForm, type FormBundle } from '../../../src/form/form-bundle';
import type { FormFlowConfig, FormValidation } from '../../../src/form/form-level';
import {
  apply,
  defineValidation,
  validate,
  validateAsync,
  type AsyncRule,
  type ValidationDefinition,
} from '../../../src/form/validation';
import type { ValidationIssue } from '../../../src/form/types/contracts';

interface Address {
  city: string;
  street: string;
}

interface Order {
  customer: string;
  address: Address;
  login: string;
  limit: number;
  total: number;
  comment: string;
}

const EMPTY: Order = {
  customer: '',
  address: { city: '', street: '' },
  login: '',
  limit: 0,
  total: 0,
  comment: '',
};

/** Шаги по порядку: бюджет — четвёртый, позиции — пятый, подтверждение — шестой, без правил. */
const STEPS = ['customer', 'delivery', 'account', 'budget', 'items', 'confirm'] as const;
type StepId = (typeof STEPS)[number];

/** Правило «поле заполнено» со своим кодом — шпион: по нему считают вызовы. */
const filled = (code: string) =>
  vi.fn((value: unknown): ValidationIssue | null => (value === '' ? { code } : null));

/**
 * Правила заказа одной сборки — шпионы, чтобы считать вызовы. Бюджет — межшаговое правило шага 4:
 * сумма позиций (шаг 5) не больше лимита.
 */
function orderRules(loginFree?: AsyncRule<string>) {
  const spies = {
    customer: filled('customer.required'),
    city: filled('city.required'),
    street: filled('street.required'),
    login: vi.fn<AsyncRule<string>>(
      loginFree ?? (async (login) => (login === 'taken' ? { code: 'login.taken' } : null))
    ),
    withinLimit: vi.fn((order: Order): ValidationIssue | null =>
      order.total > order.limit ? { code: 'budget.exceeded' } : null
    ),
    total: vi.fn((total: number): ValidationIssue | null =>
      total > 0 ? null : { code: 'total.positive' }
    ),
  };
  const addressRules = defineValidation<Address>(({ model }) => {
    validate(model.$.city, [spies.city]);
    validate(model.$.street, [spies.street]);
  });
  const steps: Record<Exclude<StepId, 'confirm'>, ValidationDefinition<Order>> = {
    customer: defineValidation<Order>(({ model }) => validate(model.$.customer, [spies.customer])),
    // Подформа адреса — вложенный `apply` внутри правил шага.
    delivery: defineValidation<Order>(({ model }) => apply(model.$.address, addressRules)),
    account: defineValidation<Order>(({ model }) => validateAsync(model.$.login, [spies.login])),
    budget: defineValidation<Order>(({ model, cross }) => cross(model.$.limit, spies.withinLimit)),
    items: defineValidation<Order>(({ model }) => validate(model.$.total, [spies.total])),
  };
  return { spies, steps };
}

type OrderRules = ReturnType<typeof orderRules>;

const bundles: FormBundle<Order>[] = [];
afterEach(() => {
  for (const bundle of bundles.splice(0)) bundle.dispose();
});

interface SetupOptions {
  onInvalidSubmit?: FormFlowConfig<Order>['onInvalidSubmit'];
  validation?: (rules: OrderRules) => FormValidation<Order>;
  loginFree?: AsyncRule<string>;
}

function setup(options: SetupOptions = {}) {
  const rules = orderRules(options.loginFree);
  const { steps } = rules;
  const bundle = createForm<Order>({
    initial: structuredClone(EMPTY),
    validation: options.validation?.(rules) ?? {},
    flow: {
      steps: STEPS.map((id) => ({ id, rules: id === 'confirm' ? null : steps[id] })),
      onInvalidSubmit: options.onInvalidSubmit,
    },
  });
  bundles.push(bundle);
  return { bundle, ...rules, flow: bundle.flow! };
}

/** Верные данные всех шагов: лимит 100, сумма 50. */
function fillOrder(bundle: FormBundle<Order>): void {
  bundle.model.patch({
    customer: 'Анна',
    address: { city: 'Москва', street: 'Тверская' },
    login: 'anna',
    limit: 100,
    total: 50,
  });
}

/** «Далее» до шага `target`: каждый переход обязан пройти. */
async function passTo(bundle: FormBundle<Order>, target: StepId): Promise<void> {
  const flow = bundle.flow!;
  while (flow.current.peek() !== target) {
    const transition = await flow.next();
    if (transition.status !== 'moved') {
      throw new Error(`шаг «${flow.current.peek()}» не пройден: ${JSON.stringify(transition)}`);
    }
  }
}

/**
 * Межшаговое правило бюджета устарело: шаг 4 пройден, на шаге 5 сумму подняли выше лимита — правила
 * шага 5 её пропускают, и поток доходит до подтверждения.
 */
async function staleBudget(bundle: FormBundle<Order>): Promise<void> {
  fillOrder(bundle);
  await passTo(bundle, 'items');
  bundle.model.total = 200;
  await passTo(bundle, 'confirm');
}

describe('flow.onInvalidSubmit — firstInvalidStep', () => {
  it('устаревшее межшаговое правило: отправка с последнего шага переводит поток на шаг 4', async () => {
    const { bundle, flow } = setup({ onInvalidSubmit: 'firstInvalidStep' });
    await staleBudget(bundle);
    const handler = vi.fn();
    const seen: string[] = [];
    const stop = flow.current.subscribe((step) => seen.push(step));

    const outcome = await bundle.submission.submit(handler);
    stop();

    expect(outcome).toMatchObject({ status: 'invalid', validation: { status: 'invalid' } });
    expect(handler).not.toHaveBeenCalled();
    expect(flow.current.value).toBe('budget');
    expect(seen).toEqual(['confirm', 'budget']);
    expect(issueCodes(bundle.form.limit)).toEqual(['budget.exceeded']);
    expect(bundle.form.limit.shouldShowError.value).toBe(true);
    // Назад: пройденными остаются шаги до цели, дальше — снова через «Далее».
    expect([...flow.completed.value]).toEqual(['customer', 'delivery', 'account']);
  });

  it('первый по порядку шаг, а не ближайший к текущему', async () => {
    const { bundle, flow } = setup({ onInvalidSubmit: 'firstInvalidStep' });
    await staleBudget(bundle);
    bundle.model.customer = '';

    await bundle.submission.submit(vi.fn());

    expect(flow.current.value).toBe('customer');
  });

  it('замечание на текущем шаге — поток остаётся', async () => {
    const { bundle, flow } = setup({ onInvalidSubmit: 'firstInvalidStep' });
    fillOrder(bundle);
    await passTo(bundle, 'items');
    bundle.model.total = 0;

    const outcome = await bundle.submission.submit(vi.fn());

    expect(outcome.status).toBe('invalid');
    expect(flow.current.value).toBe('items');
    expect(issueCodes(bundle.form.total)).toEqual(['total.positive']);
  });

  it('по умолчанию поток остаётся на месте', async () => {
    const { bundle, flow } = setup();
    await staleBudget(bundle);

    const outcome = await bundle.submission.submit(vi.fn());

    expect(outcome.status).toBe('invalid');
    expect(flow.current.value).toBe('confirm');
    expect(issueCodes(bundle.form.limit)).toEqual(['budget.exceeded']);
  });

  it("'stay' — поток остаётся на месте", async () => {
    const { bundle, flow } = setup({ onInvalidSubmit: 'stay' });
    await staleBudget(bundle);

    await bundle.submission.submit(vi.fn());

    expect(flow.current.value).toBe('confirm');
  });

  it('замечание extras на поле, которого не проверяет ни один шаг, — поток остаётся', async () => {
    const extras = defineValidation<Order>(({ model }) =>
      validate(model.$.comment, [filled('comment.required')])
    );
    const { bundle, flow } = setup({
      onInvalidSubmit: 'firstInvalidStep',
      validation: () => ({ extras }),
    });
    fillOrder(bundle);
    await passTo(bundle, 'confirm');

    const outcome = await bundle.submission.submit(vi.fn());

    expect(outcome.status).toBe('invalid');
    expect(flow.current.value).toBe('confirm');
    expect(issueCodes(bundle.form.comment)).toEqual(['comment.required']);
  });

  it('замечание extras на поле, которое проверяет шаг, — переход на этот шаг', async () => {
    const extras = defineValidation<Order>(({ model, cross }) =>
      cross(model.$.customer, (order) =>
        order.customer === order.login ? { code: 'customer.sameAsLogin' } : null
      )
    );
    const { bundle, flow } = setup({
      onInvalidSubmit: 'firstInvalidStep',
      validation: () => ({ extras }),
    });
    fillOrder(bundle);
    await passTo(bundle, 'confirm');
    bundle.model.customer = 'anna';

    await bundle.submission.submit(vi.fn());

    expect(flow.current.value).toBe('customer');
    expect(issueCodes(bundle.form.customer)).toEqual(['customer.sameAsLogin']);
  });

  it('правило вложенного apply относится к шагу, чьи правила его подключили', async () => {
    const { bundle, flow } = setup({ onInvalidSubmit: 'firstInvalidStep' });
    fillOrder(bundle);
    await passTo(bundle, 'confirm');
    bundle.model.address.street = '';

    await bundle.submission.submit(vi.fn());

    expect(flow.current.value).toBe('delivery');
    expect(issueCodes(bundle.form.address.street)).toEqual(['street.required']);
  });

  it('async-правило ответило замечанием — переход на его шаг, правило спрошено один раз', async () => {
    const { bundle, flow, spies } = setup({ onInvalidSubmit: 'firstInvalidStep' });
    fillOrder(bundle);
    await passTo(bundle, 'confirm');
    bundle.model.login = 'taken';
    spies.login.mockClear();

    const outcome = await bundle.submission.submit(vi.fn());

    expect(outcome.status).toBe('invalid');
    expect(flow.current.value).toBe('account');
    expect(issueCodes(bundle.form.login)).toEqual(['login.taken']);
    expect(spies.login).toHaveBeenCalledTimes(1);
  });

  it('полный набор validation.rules, подключающий правила шагов, — шаг находится', async () => {
    const { bundle, flow } = setup({
      onInvalidSubmit: 'firstInvalidStep',
      validation: ({ steps }) => ({
        rules: defineValidation<Order>(() => {
          apply(steps.customer, steps.delivery, steps.account);
          // Вложенная композиция: правила шагов на втором уровне.
          apply(defineValidation<Order>(() => apply(steps.budget, steps.items)));
        }),
      }),
    });
    await staleBudget(bundle);

    await bundle.submission.submit(vi.fn());

    expect(flow.current.value).toBe('budget');
  });

  it('полный набор validation.rules без правил шагов — шаг не находится, поток остаётся', async () => {
    const { bundle, flow } = setup({
      onInvalidSubmit: 'firstInvalidStep',
      validation: () => ({
        // Те же проверки, но не через правила шагов: какому шагу принадлежит поле, неизвестно.
        rules: defineValidation<Order>(({ model, cross }) =>
          cross(model.$.limit, (order) =>
            order.total > order.limit ? { code: 'budget.exceeded' } : null
          )
        ),
      }),
    });
    await staleBudget(bundle);

    const outcome = await bundle.submission.submit(vi.fn());

    expect(outcome.status).toBe('invalid');
    expect(flow.current.value).toBe('confirm');
  });

  it('шаг с ошибкой впереди и закрыт — поток остаётся', async () => {
    const { bundle, flow } = setup({ onInvalidSubmit: 'firstInvalidStep' });
    fillOrder(bundle);
    bundle.model.total = 0; // шаг 5 — ещё не пройденный

    const outcome = await bundle.submission.submit(vi.fn());

    expect(outcome.status).toBe('invalid');
    expect(flow.current.value).toBe('customer');
    expect(flow.canGoTo('items')).toBe(false);
  });

  it('предупреждение раннего шага шаг не выбирает: переход — на шаг с блокирующим замечанием', async () => {
    const extras = defineValidation<Order>(({ model }) =>
      validate(model.$.customer, [() => ({ code: 'customer.short', severity: 'warning' })])
    );
    const { bundle, flow } = setup({
      onInvalidSubmit: 'firstInvalidStep',
      validation: () => ({ extras }),
    });
    await staleBudget(bundle);

    await bundle.submission.submit(vi.fn());

    expect(flow.current.value).toBe('budget');
    expect(issueCodes(bundle.form.customer)).toEqual(['customer.short']);
  });

  it('итог error поток не трогает', async () => {
    const { bundle, flow } = setup({
      onInvalidSubmit: 'firstInvalidStep',
      loginFree: async (login) => {
        if (login === 'down') throw new Error('сервис недоступен');
        return null;
      },
    });
    await staleBudget(bundle);
    bundle.model.login = 'down';

    const outcome = await bundle.submission.submit(vi.fn());

    expect(outcome.status).toBe('error');
    expect(flow.current.value).toBe('confirm');
  });

  it('итог cancelled поток не трогает; следующая отправка переводит', async () => {
    const check = controlledAsyncRule<string>();
    const { bundle, flow } = setup({ onInvalidSubmit: 'firstInvalidStep', loginFree: check.rule });
    // Проход визарда: «Далее» на шаге логина ждёт ответа правила.
    const passing = staleBudget(bundle);
    await tick();
    check.answers[0].resolve(null);
    await passing;

    const first = bundle.submission.submit(vi.fn());
    await tick();
    const second = bundle.submission.submit(vi.fn());
    await tick();
    expect(check.answers).toHaveLength(3);

    expect((await first).status).toBe('cancelled');
    expect(flow.current.value).toBe('confirm');

    check.answers[2].resolve(null);
    expect((await second).status).toBe('invalid');
    expect(flow.current.value).toBe('budget');
  });
});

describe('flow.onInvalidSubmit — переход без лишних прогонов правил', () => {
  /** Число вызовов каждого правила-шпиона сборки. */
  const callsOf = (spies: OrderRules['spies']): Record<string, number> =>
    Object.fromEntries(Object.entries(spies).map(([name, spy]) => [name, spy.mock.calls.length]));

  /** Один и тот же сценарий в двух режимах: вызовы правил после отправки. */
  async function callsAfterSubmit(
    onInvalidSubmit: 'stay' | 'firstInvalidStep',
    validation: FormValidation<Order> = {}
  ): Promise<{ calls: Record<string, number>; step: string }> {
    const { bundle, spies, flow } = setup({ onInvalidSubmit, validation: () => validation });
    bundle.validation!.controller.start();
    await staleBudget(bundle);
    await bundle.submission.submit(vi.fn());
    await tick();
    return { calls: callsOf(spies), step: flow.current.peek() };
  }

  it('каждое правило вызвано столько же раз, сколько при stay', async () => {
    const stay = await callsAfterSubmit('stay');
    const jump = await callsAfterSubmit('firstInvalidStep');

    expect([stay.step, jump.step]).toEqual(['confirm', 'budget']);
    expect(jump.calls).toEqual(stay.calls);
    // Отправка спросила async-правило один раз — сверх «Далее» на шаге логина.
    expect(jump.calls.login).toBe(2);
  });

  it('с живой фазой шагов возврат на шаг после отправки его не перепроверяет', async () => {
    const live: FormValidation<Order> = { liveAfterStep: 'change' };
    const stay = await callsAfterSubmit('stay', live);
    const jump = await callsAfterSubmit('firstInvalidStep', live);

    expect(jump.step).toBe('budget');
    expect(jump.calls).toEqual(stay.calls);
  });

  it('шаг, на который перевела отправка, живой: правка проверяет его правила', async () => {
    const { bundle, spies, flow } = setup({
      onInvalidSubmit: 'firstInvalidStep',
      validation: () => ({ liveAfterStep: 'change' }),
    });
    bundle.validation!.controller.start();
    await staleBudget(bundle);
    await bundle.submission.submit(vi.fn());
    expect(flow.current.value).toBe('budget');
    spies.withinLimit.mockClear();

    bundle.model.limit = 500;
    await tick();

    expect(spies.withinLimit).toHaveBeenCalledTimes(1);
    expect(issueCodes(bundle.form.limit)).toEqual([]);
  });
});
