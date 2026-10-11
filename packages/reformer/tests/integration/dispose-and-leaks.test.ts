/**
 * Снятие заявки на кредит и утечки (`fixtures/loan-application`).
 *
 * У бандла сборки своего `dispose` нет: форму с поведением снимает `disposeForm(form)`, стратегию
 * живой проверки — `bundle.validation.controller.dispose()`; вместе это то, что делает владелец
 * сборки при размонтировании. Здесь проверяется, что после снятия от заявки не остаётся ничего
 * живого — ни на счётчиках, ни в поведении:
 * - живые effect'ы (`liveEffects()`) возвращаются к базе — со строками массивов, вложенными
 *   массивами и подформами в строках; удалённая строка отдаёт свои effect'ы сразу;
 * - таймеры `debounce` (поиск города, живая проверка) сняты, запросы с `AbortSignal` отменены;
 * - отложенные записи поведения, запланированные в том же тике, не случаются (зонд
 *   `test-utils/dispose-probe` по каждому отложенному оператору заявки);
 * - правила поведения в хранилищах областей схемы сняты, признаки derived отпущены;
 * - записи в модель после снятия не будят `compute`, `onChange`, проверку и сервер;
 * - 50 циклов «собрать → заполнить → проверить → снять» не копят effect'ы и таймеры;
 * - удалённая строка и снятая сборка уходят сборщику мусора.
 * Юнит-аналоги по модулям — `*.leaks.test.ts` в `tests/core/**` и `tests/behaviors/`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createdEffects, liveEffects } from '../test-utils/effect-tracker';
import { advance, settle, tick, useFakeClock } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { runDisposeProbe, type DisposeProbe } from '../test-utils/dispose-probe';
import { collectGarbage, collectUntilReleased } from '../test-utils/gc';
import { issueCodes } from '../test-utils/issues';
import { mountScope } from '../test-utils/schema-harness';
import {
  createForm,
  isDerived,
  unmarkDerived,
  type FormBundle,
  type FormModel,
  type SchemaOverrideMaps,
} from '../../src/index';
import {
  VALID_INN,
  addCoBorrower,
  fillApplicantStep,
  fillContactsStep,
  fillEmploymentStep,
  fillLoanStep,
  flushBehaviors,
} from './fixtures/loan-application/actions';
import { createLoanServer } from './fixtures/loan-application/api';
import {
  AUTOSAVE_INTERVAL,
  CITY_LOOKUP_DEBOUNCE,
  createLoanBehavior,
} from './fixtures/loan-application/behavior';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import { createLoanFlow } from './fixtures/loan-application/flow';
import { LOAN_LIMITS, type LoanApplication } from './fixtures/loan-application/model';
import { loanSchema } from './fixtures/loan-application/schema';
import { createLoanRules } from './fixtures/loan-application/validation';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

// ─── Сборки теста и их снятие ──────────────────────────────────────────────────────────────

/**
 * Снять сборку целиком — так, как это делает владелец при размонтировании: поведение формы и
 * стратегию живой проверки. Повторное снятие безопасно.
 */
function disposeBundle(bundle: FormBundle<LoanApplication>): void {
  disposeForm(bundle.form);
  bundle.validation?.controller.dispose();
}

/** Сборки текущего теста: после теста снимаются ещё раз (снятие идемпотентно). */
const assembled: LoanForm[] = [];

function build(options?: LoanFormOptions): LoanForm {
  const built = createLoanForm(options);
  assembled.push(built);
  return built;
}

afterEach(() => {
  for (const { bundle } of assembled.splice(0)) disposeBundle(bundle);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Помощники утверждений ─────────────────────────────────────────────────────────────────

/** Хранилище правил узлов области: корня сборки либо под-модели (строка, подформа). */
const mapsOf = (bundle: FormBundle<LoanApplication>, subModel: object): SchemaOverrideMaps =>
  bundle.render.controller.scopeOf(subModel).__overrideMaps;

/**
 * Правила, которые записало в область поведение: условия скрытия, эффекты рендера, обработчики
 * событий (`селектор.событие`) и хуки жизненного цикла. Императивные `patchProps` / `setHidden`
 * сюда не входят: снятие поведения их не откатывает по контракту.
 */
function rulesOf(maps: SchemaOverrideMaps) {
  return {
    conditions: [...maps.conditionRegistry.keys()],
    effects: maps.effectRegistry.length,
    handlers: [...maps.callbackRegistry].flatMap(([selector, handlers]) =>
      [...handlers.keys()].map((event) => `${selector}.${event}`)
    ),
    lifecycle: [...maps.lifecycleRegistry.keys()],
  };
}

const NO_RULES = { conditions: [], effects: 0, handlers: [], lifecycle: [] };

/** Цели `compute` / `computeFrom` поведения заявки. */
const computedTargets = (model: FormModel<LoanApplication>) => ({
  'loan.interestRate': model.$.loan.interestRate,
  'loan.monthlyPayment': model.$.loan.monthlyPayment,
  'applicant.fullName': model.$.applicant.fullName,
  totalIncome: model.$.totalIncome,
  paymentToIncomeRatio: model.$.paymentToIncomeRatio,
});

/** Признак derived у целей `compute` и у поля сервера (`markServerOwned`). */
const derivedFlags = (model: FormModel<LoanApplication>): Record<string, boolean> => ({
  ...Object.fromEntries(
    Object.entries(computedTargets(model)).map(([path, handle]) => [path, isDerived(handle)])
  ),
  applicationNumber: isDerived(model.$.applicationNumber),
});

/**
 * Вторая сборка заявки над той же моделью — перемонтирование формы над моделью из хранилища:
 * новая сборка строится раньше, чем снимается прежняя (так React меняет компонент по ключу).
 */
function remountOn(model: FormModel<LoanApplication>): LoanForm {
  const server = createLoanServer();
  const rules = createLoanRules(server.api);
  const bundle = createForm<LoanApplication>({
    model,
    schema: loanSchema,
    behavior: createLoanBehavior(server.api, rules),
    validation: { extras: rules.crossStep },
    flow: createLoanFlow(rules),
  });
  const built = { bundle, server, rules };
  assembled.push(built);
  return built;
}

// ─── Живые effect'ы ────────────────────────────────────────────────────────────────────────

describe("dispose-and-leaks — живые effect'ы заявки", () => {
  it("DL-01: сборка и start() — снятие формы и стратегии возвращает effect'ы к базе; повторное снятие ничего не меняет", async () => {
    const base = liveEffects();
    const { bundle } = build({ strategy: 'change' });
    bundle.validation?.controller.start();
    fillLoanStep(bundle.model);
    await settle();
    const built = liveEffects() - base;

    disposeForm(bundle.form);
    const formOnly = liveEffects() - base;
    bundle.validation?.controller.dispose();
    const disposed = liveEffects() - base;
    disposeBundle(bundle);

    // Форма сама стратегию не снимает: у бандла два владельца подписок — форма и контроллер.
    expect({ grew: built > 0, formOnly, disposed, again: liveEffects() - base }).toEqual({
      grew: true,
      formOnly: 1,
      disposed: 0,
      again: 0,
    });
  });

  it("DL-02: строки массивов, вложенные массивы и подформы в строках — после снятия effect'ов столько же, сколько до сборки", async () => {
    const base = liveEffects();
    const { bundle } = build({ strategy: 'blur' });
    bundle.validation?.controller.start();
    await settle();
    const empty = liveEffects() - base;
    const { model } = bundle;
    // Строка созаёмщика: подформа адреса (своё поведение) и вложенный массив телефонов.
    addCoBorrower(model, { livesWithApplicant: false });
    addCoBorrower(model).phones.push();
    // Массив в подформе занятости и массив с шаблоном строки из схемы.
    fillEmploymentStep(model);
    model.references.push();
    await settle();
    const withRows = liveEffects() - base;

    disposeBundle(bundle);

    expect({ rowsAdded: withRows > empty, after: liveEffects() - base }).toEqual({
      rowsAdded: true,
      after: 0,
    });
  });

  it("DL-03: удалённые строки отдают свои effect'ы сразу — до снятия формы", async () => {
    const { bundle } = build({ strategy: 'change' });
    bundle.validation?.controller.start();
    const { model } = bundle;
    await settle();
    const before = liveEffects();

    const separate = addCoBorrower(model, { livesWithApplicant: false });
    addCoBorrower(model);
    fillEmploymentStep(model);
    model.references.push();
    await settle();
    const withRows = liveEffects();
    separate.phones.push();
    await settle();
    const extraPhone = liveEffects();
    separate.phones.removeAt(1);
    await settle();
    const phoneRemoved = liveEffects();

    model.coBorrowers.removeAt(0);
    await settle();
    const oneRow = liveEffects();
    model.coBorrowers.clear();
    model.employment.previousJobs.clear();
    model.references.clear();
    await settle();

    expect({
      rowsAdded: withRows > before,
      phone: { added: extraPhone > withRows, removed: phoneRemoved === withRows },
      rowRemoved: oneRow < withRows,
      cleared: liveEffects() - before,
    }).toEqual({
      rowsAdded: true,
      phone: { added: true, removed: true },
      rowRemoved: true,
      cleared: 0,
    });
  });

  it('DL-04: каждая стратегия живой проверки — start() добавляет свой effect, снятие возвращает к базе', () => {
    const strategies: Array<{ name: string; options: LoanFormOptions; effects: number }> = [
      { name: 'submit', options: {}, effects: 0 },
      { name: 'change', options: { strategy: 'change' }, effects: 1 },
      { name: 'change + debounce', options: { strategy: 'change', debounce: 300 }, effects: 1 },
      { name: 'blur', options: { strategy: 'blur' }, effects: 1 },
      { name: 'afterFirstSubmit', options: { strategy: 'afterFirstSubmit' }, effects: 1 },
      {
        name: 'afterFirstSubmit + blur',
        options: { strategy: 'afterFirstSubmit', liveAfterSubmit: 'blur' },
        effects: 1,
      },
    ];

    const measured = strategies.map(({ name, options }) => {
      const base = liveEffects();
      const { bundle } = build(options);
      const built = liveEffects();
      bundle.validation?.controller.start();
      const strategy = liveEffects() - built;
      disposeBundle(bundle);
      return { name, strategy, after: liveEffects() - base };
    });

    expect(measured).toEqual(
      strategies.map(({ name, effects }) => ({ name, strategy: effects, after: 0 }))
    );
  });
});

// ─── Таймеры и запросы ─────────────────────────────────────────────────────────────────────

describe('dispose-and-leaks — таймеры debounce и AbortSignal', () => {
  it('DL-05: ожидающие таймеры debounce — поиск городов и живая проверка — снятие снимает', async () => {
    useFakeClock();
    const server = createLoanServer({ manual: ['loadCities'] });
    const { bundle } = build({ server, strategy: 'change', debounce: 200 });
    bundle.validation?.controller.start();
    await flushBehaviors();

    bundle.model.registrationAddress.region = 'Москва';
    bundle.model.applicant.inn = VALID_INN;
    // Регион скопирован и в адрес проживания: у каждого адреса свой таймер поиска городов.
    await flushBehaviors();
    const pending = vi.getTimerCount();
    disposeBundle(bundle);
    const afterDispose = vi.getTimerCount();
    await advance(1_000);
    await flushBehaviors();

    expect({
      pending,
      afterDispose,
      cities: server.callsOf('loadCities').length,
      innChecks: server.callsOf('checkInn').length,
      innIssues: issueCodes(bundle.form.applicant.inn),
    }).toEqual({ pending: 3, afterDispose: 0, cities: 0, innChecks: 0, innIssues: [] });
  });

  it('DL-06: идущий запрос городов отменён снятием; ответ после снятия пропсы поля не трогает', async () => {
    useFakeClock();
    const server = createLoanServer({ manual: ['loadCities'] });
    const { bundle } = build({ server });
    const city = bundle.form.registrationAddress.city;
    await flushBehaviors();
    // Отдельный адрес проживания: регион не копируется — запрос один.
    bundle.model.sameAsRegistration = false;
    bundle.model.registrationAddress.region = 'Москва';
    await advance(CITY_LOOKUP_DEBOUNCE);
    const call = server.last('loadCities');
    const inFlight = { aborted: call.aborted, props: city.componentProps.value };

    disposeBundle(bundle);
    call.resolve(['Москва', 'Зеленоград']);
    await flushBehaviors();

    expect({ inFlight, aborted: call.aborted, props: city.componentProps.value }).toEqual({
      inFlight: { aborted: false, props: { label: 'Город', options: [], loading: true } },
      aborted: true,
      props: { label: 'Город', options: [], loading: true },
    });
  });

  // Запрос проверки ИНН принадлежит живому прогону стратегии. Было: прогон отменялся только
  // следующим прогоном той же пары «модель + правила», а `controller.dispose()` снимал лишь
  // подписку и таймер — ответ, пришедший после снятия, ложился замечанием на ноды снятой формы.
  it('DL-07: снятие стратегии отменяет идущую живую проверку — запрос ИНН получает отмену [ReFormer-4xy9]', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle } = build({ server, strategy: 'change' });
    bundle.validation?.controller.start();
    bundle.model.applicant.inn = VALID_INN;
    await settle();
    const call = server.last('checkInn');

    disposeBundle(bundle);

    try {
      expect(call.aborted).toBe(true);
    } finally {
      // Уборка: прогон без ответа висел бы до конца файла.
      call.resolve({ status: 'found' });
    }
  });

  it("DL-08: монтирование и размонтирование узлов, затем снятие — ни таймера автосохранения, ни effect'ов", async () => {
    useFakeClock();
    const base = liveEffects();
    const { bundle, server } = build({ strategy: 'change' });
    bundle.validation?.controller.start();
    const view = mountScope(bundle.render.controller.scopeOf(bundle.model), ['wizard']);
    const mounted = vi.getTimerCount();
    await advance(AUTOSAVE_INTERVAL);

    view.unmount();
    disposeBundle(bundle);
    await advance(AUTOSAVE_INTERVAL * 3);

    // Черновик: один раз по интервалу, пока визард на экране, и один — при размонтировании.
    expect({
      mounted,
      timers: vi.getTimerCount(),
      effects: liveEffects() - base,
      drafts: server.callsOf('saveDraft').length,
    }).toEqual({ mounted: 1, timers: 0, effects: 0, drafts: 2 });
  });
});

// ─── Отложенные записи в том же тике ───────────────────────────────────────────────────────

/** Сценарий зонда «правка → снятие в том же тике» на заявке. */
interface LoanDeferredWrite {
  readonly id: string;
  readonly name: string;
  /** Подготовка после сборки — до ожидания начальных записей. */
  readonly prepare?: (bundle: FormBundle<LoanApplication>) => void;
  /** Правка, после которой поведение пишет отложенно. */
  readonly change: (bundle: FormBundle<LoanApplication>) => void;
  /** Случилась ли запись. */
  readonly written: (built: LoanForm) => boolean;
  /** Под фейковыми часами — для записей по таймеру. */
  readonly clock?: boolean;
}

const deferredWrites: LoanDeferredWrite[] = [
  {
    id: 'DL-09',
    name: 'enableWhen со сбросом — залог включается при выборе ипотеки',
    change: ({ model }) => {
      model.loan.type = 'mortgage';
    },
    written: ({ bundle }) => !bundle.form.loan.propertyValue.disabled.value,
  },
  {
    id: 'DL-10',
    name: 'enableWhen группы — отдельный адрес проживания включается',
    change: ({ model }) => {
      model.sameAsRegistration = false;
    },
    written: ({ bundle }) => !bundle.form.residenceAddress.disabled.value,
  },
  {
    id: 'DL-11',
    name: 'disableWhen со сбросом в подформе — без работы поля работодателя выключаются',
    change: ({ model }) => {
      model.employment.patch({ companyName: 'ООО «Ромашка»', status: 'unemployed' });
    },
    written: ({ bundle }) => bundle.form.employment.companyName.disabled.value,
  },
  {
    id: 'DL-12',
    name: 'copyFrom группы — адрес проживания копирует регистрацию',
    change: ({ model }) => {
      model.registrationAddress.street = 'ул. Тверская, д. 7';
    },
    written: ({ bundle }) => bundle.model.residenceAddress.street === 'ул. Тверская, д. 7',
  },
  {
    id: 'DL-13',
    name: 'syncFields с transform — телефон для кода подписи',
    change: ({ model }) => {
      model.phone = '+7 (900) 123-45-67';
    },
    written: ({ bundle }) => bundle.model.consent.smsPhone === '+79001234567',
  },
  {
    id: 'DL-14',
    name: 'transformValue — промокод заглавными без пробелов',
    change: ({ model }) => {
      model.loan.promoCode = 'spring 24';
    },
    written: ({ bundle }) => bundle.model.loan.promoCode === 'SPRING24',
  },
  {
    id: 'DL-15',
    name: 'transformValue в подформе адреса — в индексе только цифры',
    change: ({ model }) => {
      model.registrationAddress.postalCode = '125-009';
    },
    written: ({ bundle }) => bundle.model.registrationAddress.postalCode === '125009',
  },
  {
    id: 'DL-16',
    name: 'resetWhen — промокод стирается при выборе ипотеки',
    prepare: ({ model }) => {
      model.loan.promoCode = 'SPRING24';
    },
    change: ({ model }) => {
      model.loan.type = 'mortgage';
    },
    written: ({ bundle }) => bundle.model.loan.promoCode === '',
  },
  {
    id: 'DL-17',
    name: 'onChange с immediate — пределы суммы при смене вида кредита',
    change: ({ model }) => {
      model.loan.type = 'car';
    },
    written: ({ bundle }) =>
      bundle.form.loan.amount.componentProps.value.max === LOAN_LIMITS.car.max,
  },
  {
    id: 'DL-18',
    name: 'onChange без задержки — снятая отметка «есть созаёмщики» очищает список',
    prepare: ({ model }) => void addCoBorrower(model),
    change: ({ model }) => {
      model.hasCoBorrowers = false;
    },
    written: ({ bundle }) => bundle.model.coBorrowers.length === 0,
  },
  {
    id: 'DL-19',
    name: 'onChange с debounce — запрос городов по региону',
    clock: true,
    change: ({ model }) => {
      model.registrationAddress.region = 'Москва';
    },
    written: ({ server }) => server.callsOf('loadCities').length > 0,
  },
  {
    id: 'DL-20',
    name: 'exclusiveFlag — основной контакт у созаёмщиков один',
    prepare: ({ model }) => {
      addCoBorrower(model, { isPrimaryContact: true });
      addCoBorrower(model);
    },
    change: ({ model }) => {
      model.coBorrowers.at(1).isPrimaryContact = true;
    },
    written: ({ bundle }) => !bundle.model.coBorrowers.at(0).isPrimaryContact,
  },
  {
    id: 'DL-21',
    name: 'aggregateInto — долю последнего созаёмщика досчитывает форма',
    prepare: ({ model }) => {
      addCoBorrower(model);
      addCoBorrower(model);
    },
    change: ({ model }) => {
      model.coBorrowers.at(0).share = 70;
    },
    written: ({ bundle }) => bundle.model.coBorrowers.at(1).share === 30,
  },
  {
    id: 'DL-22',
    name: 'revalidateWhen — смена стоимости залога перепроверяет увиденную ошибку взноса',
    prepare: ({ model, form }) => {
      model.loan.patch({ type: 'mortgage', propertyValue: 5_000_000, initialPayment: 1_000_000 });
      form.loan.initialPayment.markAsTouched();
    },
    change: ({ model }) => {
      model.loan.propertyValue = 800_000;
    },
    written: ({ bundle }) =>
      issueCodes(bundle.form.loan.initialPayment).includes('loan.initialPayment.tooHigh'),
  },
  {
    id: 'DL-23',
    name: 'пользовательский оператор на effect и defer — заполненность анкеты в пропсах визарда',
    change: ({ model }) => {
      model.loan.amount = 500_000;
    },
    written: ({ bundle }) =>
      mapsOf(bundle, bundle.model).propsOverrides.get('wizard')?.progress === 10,
  },
  {
    id: 'DL-24',
    name: 'transformValue в строке строки — телефон созаёмщика',
    prepare: ({ model }) => void addCoBorrower(model),
    change: ({ model }) => {
      model.coBorrowers.at(0).phones.at(0).number = '+7 (900) 765-43-21 доб.';
    },
    written: ({ bundle }) =>
      bundle.model.coBorrowers.at(0).phones.at(0).number === '+7 (900) 765-43-21 ',
  },
  {
    id: 'DL-25',
    name: 'enableWhen группы в строке — адрес созаёмщика, живущего отдельно',
    prepare: ({ model }) => void addCoBorrower(model),
    change: ({ model }) => {
      model.coBorrowers.at(0).livesWithApplicant = false;
    },
    written: ({ bundle }) => bundle.form.coBorrowers.at(0)?.address.disabled.value === false,
  },
];

/** Зонд сценария: своя сборка на прогон, снятие — как при размонтировании. */
const probeOf = (scenario: LoanDeferredWrite): DisposeProbe<LoanForm> => ({
  build() {
    const built = build({ server: createLoanServer() });
    scenario.prepare?.(built.bundle);
    return built;
  },
  change: ({ bundle }) => scenario.change(bundle),
  dispose: ({ bundle }) => disposeBundle(bundle),
  written: (built) => scenario.written(built),
  wait: scenario.clock
    ? async () => {
        await advance(CITY_LOOKUP_DEBOUNCE);
        await flushBehaviors();
      }
    : settle,
});

describe('dispose-and-leaks — отложенные записи поведения в том же тике', () => {
  for (const scenario of deferredWrites) {
    it(`${scenario.id}: ${scenario.name} — запись есть без снятия и отменяется снятием в том же тике`, async () => {
      if (scenario.clock) useFakeClock();
      const probe = probeOf(scenario);

      expect({
        control: await runDisposeProbe(probe, false),
        disposed: await runDisposeProbe(probe, true),
      }).toEqual({ control: true, disposed: false });
    });
  }
});

// ─── Реестры схемы и признаки derived ──────────────────────────────────────────────────────

describe('dispose-and-leaks — реестры схемы и признаки derived', () => {
  it('DL-26: правила поведения в областях схемы сняты — корень, подформы и строки созаёмщиков', async () => {
    const { bundle } = build();
    const { model } = bundle;
    const separate = addCoBorrower(model, { livesWithApplicant: false });
    const together = addCoBorrower(model);
    await settle();
    const scopes = {
      root: model,
      employment: model.employment,
      registration: model.registrationAddress,
      separate,
      together,
      separateAddress: separate.address,
    };
    const rules = () =>
      Object.fromEntries(
        Object.entries(scopes).map(([name, subModel]) => [name, rulesOf(mapsOf(bundle, subModel))])
      );
    const before = rules();

    disposeBundle(bundle);

    expect({ before, after: rules() }).toEqual({
      before: {
        root: {
          conditions: ['mortgage', 'residence-address', 'co-borrowers-list'],
          effects: 1,
          handlers: ['wizard.onStepClick'],
          lifecycle: ['wizard'],
        },
        employment: { ...NO_RULES, conditions: ['employer'] },
        registration: NO_RULES,
        separate: { ...NO_RULES, conditions: ['co-borrower-address'] },
        together: { ...NO_RULES, conditions: ['co-borrower-address'] },
        separateAddress: NO_RULES,
      },
      after: Object.fromEntries(Object.keys(scopes).map((name) => [name, NO_RULES])),
    });
  });

  it('DL-27: признаки derived целей compute отпущены — загрузка снова пишет эти поля; поле сервера помечено по-прежнему', () => {
    const { bundle } = build();
    const { model } = bundle;
    const before = derivedFlags(model);

    disposeBundle(bundle);
    const after = derivedFlags(model);
    model.patch({ totalIncome: 123_456, applicationNumber: 'ЗК-000001' });

    expect({
      before,
      after,
      loaded: { totalIncome: model.totalIncome, applicationNumber: model.applicationNumber },
    }).toEqual({
      before: {
        'loan.interestRate': true,
        'loan.monthlyPayment': true,
        'applicant.fullName': true,
        totalIncome: true,
        paymentToIncomeRatio: true,
        applicationNumber: true,
      },
      after: {
        'loan.interestRate': false,
        'loan.monthlyPayment': false,
        'applicant.fullName': false,
        totalIncome: false,
        paymentToIncomeRatio: false,
        applicationNumber: true,
      },
      loaded: { totalIncome: 123_456, applicationNumber: '' },
    });
  });

  it('DL-28: unmarkDerived — явную пометку сервера снимает только она; после неё загрузка пишет номер заявки', () => {
    const { bundle } = build();
    const { model } = bundle;
    disposeBundle(bundle);
    const afterDispose = isDerived(model.$.applicationNumber);

    unmarkDerived(model.$.applicationNumber);
    model.patch({ applicationNumber: 'ЗК-000042' });

    expect({
      afterDispose,
      released: !isDerived(model.$.applicationNumber),
      applicationNumber: model.applicationNumber,
    }).toEqual({ afterDispose: true, released: true, applicationNumber: 'ЗК-000042' });
  });

  it('DL-29: перемонтирование над той же моделью — снятие прежней сборки не трогает новую', async () => {
    const base = liveEffects();
    const first = build();
    const { model } = first.bundle;
    const single = liveEffects() - base;
    const second = remountOn(model);
    await settle();

    disposeBundle(first.bundle);
    const afterFirst = liveEffects() - base;
    fillLoanStep(model);
    await settle();
    const result = await second.bundle.validate();

    expect({
      effects: afterFirst === single,
      derived: derivedFlags(model),
      // Платёж считает уже новая сборка: у прежней `compute` снят.
      payment: model.loan.monthlyPayment > 0,
      checked: result.status,
      // Замечания разносятся по нодам новой формы: реестр «ручка → нода» указывает на неё.
      issues: {
        second: issueCodes(second.bundle.form.applicant.lastName),
        first: issueCodes(first.bundle.form.applicant.lastName),
      },
    }).toEqual({
      effects: true,
      derived: {
        'loan.interestRate': true,
        'loan.monthlyPayment': true,
        'applicant.fullName': true,
        totalIncome: true,
        paymentToIncomeRatio: true,
        applicationNumber: true,
      },
      payment: true,
      checked: 'invalid',
      issues: { second: ['required'], first: [] },
    });
  });
});

// ─── После снятия ──────────────────────────────────────────────────────────────────────────

describe('dispose-and-leaks — записи в модель после снятия', () => {
  it('DL-30: compute, onChange и пропсы молчат; новые строки не получают ни форм, ни поведения', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    addCoBorrower(model, { share: 60 });
    await settle();
    const snapshot = () => ({
      monthlyPayment: model.loan.monthlyPayment,
      interestRate: model.loan.interestRate,
      fullName: model.applicant.fullName,
      totalIncome: model.totalIncome,
      amountProps: form.loan.amount.componentProps.value,
      smsPhone: model.consent.smsPhone,
      residenceStreet: model.residenceAddress.street,
      progress: mapsOf(bundle, model).propsOverrides.get('wizard')?.progress,
      formRows: form.coBorrowers.length,
    });
    const before = snapshot();

    disposeBundle(bundle);
    fillLoanStep(model, { type: 'car', term: 84 });
    fillApplicantStep(model);
    fillContactsStep(model);
    fillEmploymentStep(model);
    model.hasCoBorrowers = false;
    addCoBorrower(model, { share: 10 });
    await settle();

    expect({
      ...snapshot(),
      coBorrowers: model.coBorrowers.length,
      lastShare: model.coBorrowers.at(1).share,
    }).toEqual({
      ...before,
      // Строки модели живут сами по себе: снятое `onChange` список не очистило, а снятое
      // `aggregateInto` долю последнего не досчитало.
      coBorrowers: 2,
      lastShare: 10,
      // Свой `onDispose` пользовательский оператор выполнил при снятии.
      progress: undefined,
    });
  });

  it('DL-31: ни запросов к серверу, ни замечаний живой проверки — и после прокрутки часов', async () => {
    useFakeClock();
    const { bundle, server } = build({ strategy: 'change', debounce: 100 });
    bundle.validation?.controller.start();
    const { model, form } = bundle;
    await flushBehaviors();
    model.sameAsRegistration = false;
    model.registrationAddress.region = 'Москва';
    model.applicant.inn = '5001';
    await advance(CITY_LOOKUP_DEBOUNCE);
    await flushBehaviors();
    // Контроль: до снятия те же правки доходят до сервера и до проверки.
    const live = {
      cities: server.callsOf('loadCities').length,
      innIssues: issueCodes(form.applicant.inn),
    };
    const spies = (['checkInn', 'loadCities', 'saveDraft', 'submitApplication'] as const).map(
      (method) => vi.spyOn(server.api, method)
    );

    disposeBundle(bundle);
    model.registrationAddress.region = 'Санкт-Петербург';
    model.applicant.inn = VALID_INN;
    form.applicant.inn.markAsTouched();
    await advance(1_000);
    await flushBehaviors();

    expect({
      live,
      requests: spies.map((spy) => spy.mock.calls.length),
      innIssues: issueCodes(form.applicant.inn),
    }).toEqual({
      live: { cities: 1, innIssues: ['applicant.inn.format'] },
      requests: [0, 0, 0, 0],
      innIssues: ['applicant.inn.format'],
    });
  });
});

// ─── Циклы и сборщик мусора ────────────────────────────────────────────────────────────────

describe('dispose-and-leaks — циклы и сборщик мусора', () => {
  it("DL-32: 50 циклов «собрать → заполнить → проверить → снять» — effect'ы и таймеры не копятся", async () => {
    useFakeClock();
    const base = { effects: liveEffects(), timers: vi.getTimerCount() };
    const drift = new Set<string>();
    const created = new Set<number>();

    for (let cycle = 0; cycle < 50; cycle++) {
      const createdBefore = createdEffects();
      const { bundle } = build({ strategy: 'change', debounce: 100 });
      bundle.validation?.controller.start();
      fillLoanStep(bundle.model);
      fillApplicantStep(bundle.model);
      fillContactsStep(bundle.model);
      addCoBorrower(bundle.model, { livesWithApplicant: false });
      await advance(CITY_LOOKUP_DEBOUNCE);
      await bundle.validate();
      disposeBundle(bundle);
      drift.add(
        JSON.stringify({
          effects: liveEffects() - base.effects,
          timers: vi.getTimerCount() - base.timers,
        })
      );
      created.add(createdEffects() - createdBefore);
    }

    // Каждый цикл создаёт одно и то же число effect'ов и снимает их все.
    expect({ drift: [...drift], created: created.size }).toEqual({
      drift: [JSON.stringify({ effects: 0, timers: 0 })],
      created: 1,
    });
  });

  it('DL-33: удалённая строка созаёмщика уходит сборщику мусора — с формой, областью схемы и поведением строки', async () => {
    const { bundle } = build();
    const refs = trackFirstCoBorrower(bundle);
    await settle();

    bundle.model.coBorrowers.removeAt(0);
    await collectUntilReleased(refs);

    expect({
      released: refs.map((ref) => ref.deref() === undefined),
      // Сборка жива: строку отпустила она сама, а не сборщик вместе со всей формой.
      rows: bundle.form.coBorrowers.length,
    }).toEqual({ released: refs.map(() => true), rows: 1 });
  });

  it('DL-34: снятая сборка уходит сборщику мусора; без снятия её держит ожидающий таймер живой проверки', async () => {
    const disposed = assembleWithPendingCheck(true);
    const kept = assembleWithPendingCheck(false);

    await collectUntilReleased(disposed.refs);
    // Контроль честный: сборка мусора прошла только что — вторая сборка её пережила.
    await tick();
    collectGarbage();
    const released = {
      disposed: disposed.refs.map((ref) => ref.deref() === undefined),
      kept: kept.refs.map((ref) => ref.deref() === undefined),
    };
    // Уборка: снять и вторую сборку — таймер и поведение.
    kept.controller.deref()?.dispose();
    const keptForm = kept.refs[0].deref();
    if (keptForm !== undefined) disposeForm(keptForm);

    expect(released).toEqual({ disposed: [true, true], kept: [false, false] });
  });
});

/**
 * Добавить двух созаёмщиков и отдать слабые ссылки на всё, что принадлежит первому: модель строки
 * и её телефона, форму строки, подформы адреса и строки телефона (вложенный массив), область
 * схемы и скомпилированную схему строки. Сильных ссылок наружу нет.
 *
 * Чего в списке нет намеренно — поиска городов у строки: отменённый снятием запрос держит в
 * журнале заглушки свой `AbortSignal`, а причина отмены (`DOMException`) — стек вызова, в котором
 * есть и поведение строки; удалённая строка дожила бы до сборки журнала.
 */
function trackFirstCoBorrower(bundle: FormBundle<LoanApplication>): WeakRef<object>[] {
  const row = addCoBorrower(bundle.model, { livesWithApplicant: false });
  addCoBorrower(bundle.model);
  const rowForm = bundle.form.coBorrowers.at(0);
  const compiled = bundle.render.tree?.arrays.get(bundle.model.$.coBorrowers)?.row(row);
  return [
    row,
    row.phones.at(0),
    rowForm,
    rowForm?.address,
    // Форму строки вложенного массива раньше держал effect синхронизации внешнего [ReFormer-68sy].
    rowForm?.phones.at(0),
    bundle.render.controller.scopeOf(row),
    compiled,
  ].map((target) => new WeakRef(target as object));
}

/**
 * Сборка с живой проверкой, у которой ждёт таймер (`debounce` — минута). Наружу — только слабые
 * ссылки: на форму, модель и контроллер (последний — чтобы снять таймер после проверки).
 */
function assembleWithPendingCheck(dispose: boolean) {
  const { bundle } = createLoanForm({ strategy: 'change', debounce: 60_000 });
  const controller = bundle.validation!.controller;
  controller.start();
  bundle.model.applicant.inn = VALID_INN;
  if (dispose) disposeBundle(bundle);
  return {
    refs: [new WeakRef(bundle.form as object), new WeakRef(bundle.model as object)],
    controller: new WeakRef(controller),
  };
}
