/**
 * Условные ветки заявки на кредит: доступность, видимость и проверка полей по одному условию.
 *
 * В заявке условие управляет сразу тремя механизмами ядра: поведение выключает поле
 * (`enableWhen` / `disableWhen`, со сбросом и без), правило узла прячет его секцию (`hideWhen` —
 * в корне, в строке массива и в подформе), схема проверки не применяет его правила
 * (`validateWhen`). Сценарии проверяют, что механизмы согласованы: выключенное поле скрыто, не
 * проверяется и не держит ни шаг, ни отправку; включённое видно и проверяется; после повторного
 * включения значение — по `resetOnDisable`. Отдельно: `compute(…, { when })`, условие на
 * вычисляемом поле (цепочка «вид и срок → ставка → платёж → нагрузка → условие»), ручные
 * `enable()` / `disable()` против поведения и переключение туда-обратно в одном тике и на соседних
 * тиках — отложенная запись решает по состоянию в момент записи.
 *
 * Видимость читается харнессом `mountScope` — так, как её покажет рендерер. Ветви одного модуля
 * покрыты юнит-тестами (`tests/behaviors/`, `tests/core/validation/`); здесь — их взаимодействие.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { settle } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes } from '../test-utils/issues';
import { mountScope, type MountedScope } from '../test-utils/schema-harness';
import type { FormModel, SchemaScope } from '../../src/index';
import {
  compute,
  defineFormBehavior,
  enableWhen,
  hideWhen,
  type FormBehavior,
} from '../../src/form/behaviors/index';
import {
  defineValidation,
  validate,
  validateWhen,
  type ValidationResult,
} from '../../src/form/validation/index';
import { required } from '../../src/form/validators/index';
import {
  addCoBorrower,
  fillContactsStep,
  fillEmploymentStep,
  fillLoanStep,
  passWizardTo,
} from './fixtures/loan-application/actions';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import type { Address, LoanApplication } from './fixtures/loan-application/model';

// ─── Сборки теста и их уборка ───────────────────────────────────────────────────────────────

/** Сборки текущего теста: после теста их поведение и стратегия снимаются. */
const assembled: LoanForm[] = [];
/** Смонтированные харнессом области: их эффекты рендера снимаются после теста. */
const mounted: MountedScope[] = [];

function build(options?: LoanFormOptions): LoanForm {
  const built = createLoanForm(options);
  assembled.push(built);
  return built;
}

/** Смонтировать область схемы, как это делает рендерер, — с уборкой после теста. */
function mount(scope: SchemaScope, selectors: string[]): MountedScope {
  const view = mountScope(scope, selectors);
  mounted.push(view);
  return view;
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
  for (const { bundle } of assembled.splice(0)) {
    disposeForm(bundle.form);
    bundle.validation?.controller.dispose();
  }
  vi.restoreAllMocks();
});

// ─── Помощники ──────────────────────────────────────────────────────────────────────────────

/** Непустые замечания прогона по путям полей. */
function issuesByPath(result: ValidationResult): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [handle, issues] of result.issues) {
    if (issues.length > 0) out[handle.__path] = issues.map((issue) => issue.code);
  }
  return out;
}

/** Отдельный адрес — в Санкт-Петербурге. */
const SPB_ADDRESS: Address = {
  region: 'Санкт-Петербург',
  city: 'Колпино',
  street: 'ул. Ленина, д. 1',
  postalCode: '196650',
};

// ─── Согласованность ветки ──────────────────────────────────────────────────────────────────

describe('условные ветки заявки — доступность, видимость и проверка согласованы', () => {
  it('CB-01: ипотека — залог доступен, виден и проверяется только у ипотеки; после возврата стёрт', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    fillLoanStep(model, { amount: 3_000_000 });
    await settle();
    const view = mount(bundle.render.controller.scopeOf(model), ['mortgage']);
    const collateral = () => ({
      hidden: view.isHidden('mortgage'),
      disabled: [form.loan.propertyValue.disabled.value, form.loan.initialPayment.disabled.value],
    });

    expect(collateral()).toEqual({ hidden: true, disabled: [true, true] });
    expect(issuesByPath(await bundle.validateStep('loan'))).toEqual({});

    model.loan.type = 'mortgage';
    await settle();
    expect(collateral()).toEqual({ hidden: false, disabled: [false, false] });
    expect(issuesByPath(await bundle.validateStep('loan'))).toEqual({
      'loan.propertyValue': ['loan.propertyValue.required'],
      'loan.initialPayment': ['loan.initialPayment.required'],
    });

    model.loan.patch({ propertyValue: 900_000, initialPayment: 200_000 });
    expect(issuesByPath(await bundle.validateStep('loan'))).toEqual({
      'loan.propertyValue': ['loan.propertyValue.min'],
    });
    expect(form.loan.valid.value).toBe(false);

    // Вид сменили: поля выключены и скрыты, их замечания сняты сразу — до новой проверки.
    model.loan.type = 'car';
    await settle();
    expect(collateral()).toEqual({ hidden: true, disabled: [true, true] });
    expect([form.loan.propertyValue.issues.value, form.loan.valid.value]).toEqual([[], true]);
    expect([model.loan.propertyValue, model.loan.initialPayment]).toEqual([null, null]);

    // Снова ипотека: залог виден и проверяется, но введённое стёрто — `resetOnDisable`.
    model.loan.type = 'mortgage';
    await settle();
    expect(collateral()).toEqual({ hidden: false, disabled: [false, false] });
    expect([model.loan.propertyValue, model.loan.initialPayment]).toEqual([null, null]);
    expect((await bundle.validateStep('loan')).status).toBe('invalid');
  });

  it('CB-02: адрес проживания — копия регистрации, пока совпадает; отдельный виден и проверяется, без сброса', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    fillContactsStep(model);
    await settle();
    const view = mount(bundle.render.controller.scopeOf(model), ['residence-address']);
    const residence = () => ({
      hidden: view.isHidden('residence-address'),
      disabled: form.residenceAddress.disabled.value,
      city: model.residenceAddress.city,
    });

    expect(residence()).toEqual({ hidden: true, disabled: true, city: 'Москва' });
    expect(issuesByPath(await bundle.validateStep('contacts'))).toEqual({});

    model.sameAsRegistration = false;
    await settle();
    // Без сброса: отдельный адрес начинается с последней копии регистрации.
    expect(residence()).toEqual({ hidden: false, disabled: false, city: 'Москва' });
    model.residenceAddress.patch({ city: '', street: 'ул. Ленина, д. 1' });
    expect(issuesByPath(await bundle.validateStep('contacts'))).toEqual({
      'residenceAddress.city': ['address.city.required'],
    });

    // Снова совпадает: группа выключена, замечания её полей сняты, копия затирает отдельный адрес.
    model.sameAsRegistration = true;
    await settle();
    expect(residence()).toEqual({ hidden: true, disabled: true, city: 'Москва' });
    expect(form.residenceAddress.city.issues.value).toEqual([]);
    expect(model.residenceAddress.get()).toEqual(model.registrationAddress.get());
    expect(issuesByPath(await bundle.validateStep('contacts'))).toEqual({});
  });

  it('CB-03: подформа занятости — без работы работодатель выключен со сбросом, скрыт в области подформы и не проверяется', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    fillEmploymentStep(model);
    await settle();
    const view = mount(bundle.render.controller.scopeOf(model.employment), ['employer']);
    const { companyName, position, companySite, monthlyIncome } = form.employment;
    const employer = () => ({
      hidden: view.isHidden('employer'),
      disabled: [companyName, position, companySite, monthlyIncome].map(
        (field) => field.disabled.value
      ),
    });

    expect(employer()).toEqual({ hidden: false, disabled: [false, false, false, false] });
    expect(issuesByPath(await bundle.validateStep('employment'))).toEqual({});

    model.employment.status = 'unemployed';
    await settle();
    expect(employer()).toEqual({ hidden: true, disabled: [true, true, true, true] });
    expect([model.employment.companyName, model.employment.monthlyIncome]).toEqual(['', null]);
    // Прежние места работы — вне ветки: их проверяют и без работы.
    model.employment.previousJobs.at(0).company = '';
    expect(issuesByPath(await bundle.validateStep('employment'))).toEqual({
      'employment.previousJobs.0.company': ['previousJob.company.required'],
    });
    model.employment.previousJobs.at(0).company = 'АО «Лютик»';

    // Снова работает: поля видны и проверяются, но введённое стёрто — `resetOnDisable`.
    model.employment.status = 'self-employed';
    await settle();
    expect(employer()).toEqual({ hidden: false, disabled: [false, false, false, false] });
    expect(issuesByPath(await bundle.validateStep('employment'))).toEqual({
      'employment.companyName': ['employment.companyName.required'],
      'employment.position': ['employment.position.required'],
      'employment.monthlyIncome': ['employment.monthlyIncome.required'],
    });
  });

  it('CB-04: строка созаёмщика — адрес только у живущего отдельно: доступность, видимость и проверка в области строки, без сброса', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    model.dependents = 1;
    const row = addCoBorrower(model);
    await settle();
    const rowForm = form.coBorrowers.at(0)!;
    const view = mount(bundle.render.controller.scopeOf(row), ['co-borrower-address']);
    const address = () => ({
      hidden: view.isHidden('co-borrower-address'),
      disabled: rowForm.address.disabled.value,
    });

    expect(address()).toEqual({ hidden: true, disabled: true });
    expect(issuesByPath(await bundle.validateStep('co-borrowers'))).toEqual({});

    row.livesWithApplicant = false;
    await settle();
    expect(address()).toEqual({ hidden: false, disabled: false });
    expect(issuesByPath(await bundle.validateStep('co-borrowers'))).toEqual({
      'coBorrowers.0.address.region': ['address.region.required'],
      'coBorrowers.0.address.city': ['address.city.required'],
      'coBorrowers.0.address.street': ['address.street.required'],
      'coBorrowers.0.address.postalCode': ['address.postalCode.required'],
    });
    row.address.patch(SPB_ADDRESS);
    expect((await bundle.validateStep('co-borrowers')).status).toBe('valid');

    // Снова живёт с заёмщиком: адрес выключен и скрыт, но не стёрт — оператор без сброса.
    row.livesWithApplicant = true;
    await settle();
    expect(address()).toEqual({ hidden: true, disabled: true });
    row.livesWithApplicant = false;
    await settle();
    expect(row.address.get()).toEqual(SPB_ADDRESS);
    expect((await bundle.validateStep('co-borrowers')).status).toBe('valid');
  });

  it('CB-05: выключение снимает выставленные замечания сразу — отправка проходит без повторной правки', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const { model, form } = bundle;
    const handler = vi.fn(server.api.submitApplication);
    model.loan.type = 'mortgage';
    await settle();

    const refused = await bundle.submission.submit(handler);
    expect(refused.status).toBe('invalid');
    expect(issueCodes(form.loan.propertyValue)).toEqual([
      'loan.propertyValue.required',
      'loan.collateralTooLow',
    ]);
    expect(form.loan.propertyValue.shouldShowError.value).toBe(true);

    model.loan.type = 'consumer';
    await settle();
    expect([form.loan.propertyValue.issues.value, form.loan.initialPayment.issues.value]).toEqual([
      [],
      [],
    ]);
    expect(form.valid.value).toBe(true);
    expect((await bundle.submission.submit(handler)).status).toBe('submitted');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─── compute(…, { when }) и условие на вычисляемом поле ────────────────────────────────────

/** Взнос по умолчанию, % стоимости залога. */
const DEFAULT_INITIAL_SHARE = 20;

/**
 * Взнос по умолчанию — доля стоимости залога. Поле взноса выключает и стирает поведение заявки
 * вне ипотеки (`enableWhen` со сбросом), поэтому расчёт ограничен тем же условием (`when`) —
 * так требует JSDoc `enableWhen`; `guarded: false` — расчёт без этого условия.
 */
function defaultInitialPayment(guarded: boolean): FormBehavior<LoanApplication> {
  return defineFormBehavior<LoanApplication>(({ model }) => {
    compute(
      model.$.loan.initialPayment,
      () =>
        model.loan.propertyValue === null
          ? null
          : Math.round((model.loan.propertyValue * DEFAULT_INITIAL_SHARE) / 100),
      guarded ? { when: () => model.loan.type === 'mortgage' } : undefined
    );
  });
}

/** Нагрузка, выше которой нужен рекомендатель, % дохода семьи. */
const HIGH_LOAD = 40;

/**
 * Рекомендатели — только при высокой нагрузке: список доступен и виден, пока платёж больше
 * {@link HIGH_LOAD} % дохода семьи. Условие читает вычисляемое поле в конце цепочки «вид и срок →
 * ставка (`computeFrom`) → платёж (`compute`) → нагрузка (`compute`)».
 */
const referencesOnHighLoad = defineFormBehavior<LoanApplication>(({ model, schema }) => {
  const highLoad = (): boolean => model.paymentToIncomeRatio > HIGH_LOAD;
  enableWhen(model.$.references, highLoad);
  hideWhen(schema.node('references'), () => !highLoad());
});

/** При высокой нагрузке без рекомендателя заявку не отправить — то же условие в проверке. */
const referencesRequiredOnHighLoad = defineValidation<LoanApplication>(({ model }) => {
  validateWhen(
    () => model.paymentToIncomeRatio > HIGH_LOAD,
    () => validate(model.$.references, [required({ code: 'references.required' })])
  );
});

describe('условные ветки заявки — compute(…, { when }) и условие на вычисляемом поле', () => {
  it('CB-06: compute с when — взнос считается только у ипотеки; черновик вне ипотеки выключенное поле не заполняет', async () => {
    const { bundle } = build({ extraBehavior: defaultInitialPayment(true) });
    const { model, form } = bundle;
    await settle();
    fillLoanStep(model, { type: 'mortgage', amount: 3_000_000 });
    model.loan.propertyValue = 9_000_000;
    await settle();
    expect(model.loan.initialPayment).toBe(1_800_000);

    model.loan.type = 'car';
    await settle();
    // Черновик с сервера несёт стоимость залога прежней ипотеки — взнос остаётся пустым.
    model.patch({ loan: { propertyValue: 5_000_000 } });
    await settle();
    expect([form.loan.initialPayment.disabled.value, model.loan.initialPayment]).toEqual([
      true,
      null,
    ]);
    expect(model.get().loan.initialPayment).toBeNull();

    // Снова ипотека: условие истинно — расчёт по текущей стоимости залога.
    model.loan.type = 'mortgage';
    await settle();
    expect([form.loan.initialPayment.disabled.value, model.loan.initialPayment]).toEqual([
      false,
      1_000_000,
    ]);
  });

  it('CB-07: compute без when заполняет выключенное поле — значение уходит в отправку (предостережение JSDoc enableWhen)', async () => {
    const { bundle } = build({ extraBehavior: defaultInitialPayment(false) });
    const { model, form } = bundle;
    await settle();
    fillLoanStep(model, { type: 'mortgage', amount: 3_000_000 });
    model.loan.propertyValue = 9_000_000;
    await settle();
    model.loan.type = 'car';
    await settle();
    expect(model.loan.initialPayment).toBeNull();

    model.patch({ loan: { propertyValue: 5_000_000 } });
    await settle();

    expect(form.loan.initialPayment.disabled.value).toBe(true);
    expect(model.get().loan.initialPayment).toBe(1_000_000);
  });

  it('CB-08: условие на вычисляемом поле — нагрузка из цепочки вычислений включает, показывает и требует рекомендателей', async () => {
    const { bundle } = build({
      extraBehavior: referencesOnHighLoad,
      extraRules: referencesRequiredOnHighLoad,
    });
    await passWizardTo(bundle, 'review');
    const { model, form } = bundle;
    model.references.clear();
    await settle();
    const view = mount(bundle.render.controller.scopeOf(model), ['references']);
    const references = () => ({
      hidden: view.isHidden('references'),
      disabled: form.references.disabled.value,
    });
    expect(model.paymentToIncomeRatio).toBeLessThanOrEqual(HIGH_LOAD);
    expect(references()).toEqual({ hidden: true, disabled: true });
    expect((await bundle.validate()).status).toBe('valid');

    // Доход семьи падает — нагрузка выше порога: список доступен, виден и обязателен.
    model.hasCoBorrowers = false;
    model.employment.monthlyIncome = 40_000;
    await settle();
    expect(model.paymentToIncomeRatio).toBeGreaterThan(HIGH_LOAD);
    expect(references()).toEqual({ hidden: false, disabled: false });
    expect(issuesByPath(await bundle.validate())).toEqual({
      'loan.amount': ['loan.highDebtLoad'],
      references: ['references.required'],
    });

    // Срок больше пяти лет: ставка выше (`computeFrom`), но платёж и нагрузка ниже — ветка снова
    // выключена, скрыта и не проверяется; замечание списка снято вместе с выключением.
    model.loan.term = 61;
    await settle();
    expect(model.loan.interestRate).toBe(16.9);
    expect(model.paymentToIncomeRatio).toBeLessThanOrEqual(HIGH_LOAD);
    expect(references()).toEqual({ hidden: true, disabled: true });
    expect(form.references.issues.value).toEqual([]);
    expect((await bundle.validate()).status).toBe('valid');
  });

  it('CB-09: нагрузка подскочила и вернулась в одном тике — список не включается: решение по состоянию в момент записи', async () => {
    const { bundle } = build({ extraBehavior: referencesOnHighLoad });
    const { model, form } = bundle;
    await settle();
    fillLoanStep(model);
    fillEmploymentStep(model);
    await settle();
    expect(form.references.disabled.value).toBe(true);

    model.employment.monthlyIncome = 20_000;
    const peak = model.paymentToIncomeRatio;
    model.employment.monthlyIncome = 150_000;
    await settle();

    expect(peak).toBeGreaterThan(HIGH_LOAD);
    expect(form.references.disabled.value).toBe(true);
  });
});

// ─── Ручные enable() / disable() против поведения ──────────────────────────────────────────

describe('условные ветки заявки — ручные enable() / disable() против поведения', () => {
  it('CB-10: ручной disable() включённого поведением поля держится до следующего решения поведения', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    fillLoanStep(model, { type: 'mortgage', amount: 3_000_000 });
    model.loan.initialPayment = 600_000;
    await settle();

    // Выключенное поле не проверяется: шаг проходит без стоимости залога.
    form.loan.propertyValue.disable();
    expect(await bundle.flow!.next()).toEqual({ status: 'moved', from: 'loan', to: 'applicant' });

    // Смена условия — снова решение поведения: поле включено, его правила действуют.
    model.loan.type = 'car';
    await settle();
    model.loan.type = 'mortgage';
    await settle();
    expect(form.loan.propertyValue.disabled.value).toBe(false);
    expect(issueCodes(form.loan.propertyValue)).toEqual([]);
    expect(issuesByPath(await bundle.validateStep('loan'))).toMatchObject({
      'loan.propertyValue': ['loan.propertyValue.required'],
    });
  });

  it('CB-11: ручной enable() выключенного поведением поля возвращает его в проверку — правило extras держит отправку', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const { model, form } = bundle;

    form.loan.propertyValue.enable();
    const refused = await bundle.submission.submit(server.api.submitApplication);
    expect(refused.status).toBe('invalid');
    expect(issueCodes(form.loan.propertyValue)).toEqual(['loan.collateralTooLow']);

    // Условие изменилось — поведение снова выключает поле, и отправка проходит.
    model.loan.type = 'car';
    await settle();
    expect(form.loan.propertyValue.disabled.value).toBe(true);
    expect((await bundle.submission.submit(server.api.submitApplication)).status).toBe('submitted');
  });

  it('CB-12: поведение включает поле внутри выключенной вручную группы', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    fillEmploymentStep(model);
    await settle();

    form.employment.disable();
    model.employment.status = 'unemployed';
    await settle();
    model.employment.status = 'self-employed';
    await settle();

    // поведение под вопросом [ReFormer-04vp]: выключение группы — разовая запись, а `disableWhen`
    // поля решает по своему условию и о группе не знает: поля работодателя включены внутри
    // выключенной группы, остальные поля подформы — нет.
    expect({
      group: form.employment.disabled.value,
      status: form.employment.status.disabled.value,
      companyName: form.employment.companyName.disabled.value,
    }).toEqual({ group: true, status: true, companyName: false });
  });

  // Режим просмотра: форма выключена целиком, а загрузка данных меняет условие ветки. Поведение
  // включает поля залога внутри выключенной группы `loan`; агрегат формы выключенную группу не
  // считает (form.valid === true). Было: проверка формы смотрела только на ноду самого поля и
  // находила замечания, хотя `FormLevel.validate` обещает статус, совпадающий с `valid` формы.
  it('CB-13: проверка формы согласна с form.valid, когда поведение включило поле внутри выключенной формы [ReFormer-kowh]', async () => {
    const { bundle } = build();
    await settle();
    fillLoanStep(bundle.model);
    await settle();

    bundle.form.disable();
    bundle.model.loan.type = 'mortgage';
    await settle();
    const result = await bundle.validate();

    expect(result.status === 'valid').toBe(bundle.form.valid.value);
  });
});

// ─── Туда-обратно: один тик против соседних ────────────────────────────────────────────────

/** Переключение ветки туда и обратно: оператор с отложенной записью и что он делает с данными. */
interface Toggle {
  readonly operator: string;
  /** Данные до переключения: ветка в исходном положении, поле заполнено. */
  prepare(model: FormModel<LoanApplication>): void;
  away(model: FormModel<LoanApplication>): void;
  back(model: FormModel<LoanApplication>): void;
  read(model: FormModel<LoanApplication>): unknown;
  /** Значение, когда решение «туда» отменено решением «обратно». */
  readonly kept: unknown;
  /** Значение, когда решение «туда» выполнено. */
  readonly applied: unknown;
}

const TOGGLES: readonly Toggle[] = [
  {
    operator: 'enableWhen со сбросом — залог ипотеки',
    prepare: (model) => fillLoanStep(model, { type: 'mortgage', propertyValue: 9_000_000 }),
    away: (model) => void (model.loan.type = 'consumer'),
    back: (model) => void (model.loan.type = 'mortgage'),
    read: (model) => model.loan.propertyValue,
    kept: 9_000_000,
    applied: null,
  },
  {
    operator: 'disableWhen со сбросом — работодатель в подформе',
    prepare: (model) => fillEmploymentStep(model),
    away: (model) => void (model.employment.status = 'unemployed'),
    back: (model) => void (model.employment.status = 'employed'),
    read: (model) => model.employment.companyName,
    kept: 'ООО «Ромашка»',
    applied: '',
  },
  {
    operator: 'copyFrom группы с when — адрес проживания',
    prepare: (model) => {
      fillContactsStep(model);
      model.sameAsRegistration = false;
      model.residenceAddress.patch(SPB_ADDRESS);
    },
    away: (model) => void (model.sameAsRegistration = true),
    back: (model) => void (model.sameAsRegistration = false),
    read: (model) => model.residenceAddress.city,
    kept: 'Колпино',
    applied: 'Москва',
  },
  {
    operator: 'resetWhen — промокод',
    prepare: (model) => fillLoanStep(model),
    away: (model) => void (model.loan.type = 'mortgage'),
    back: (model) => void (model.loan.type = 'consumer'),
    read: (model) => model.loan.promoCode,
    kept: 'SPRING24',
    applied: '',
  },
];

describe('условные ветки заявки — туда и обратно: побеждает состояние в момент записи', () => {
  it.each(TOGGLES)('CB-14 · $operator — в одном тике данные целы', async (toggle) => {
    const { bundle } = build();
    await settle();
    toggle.prepare(bundle.model);
    await settle();

    toggle.away(bundle.model);
    toggle.back(bundle.model);
    await settle();

    expect(toggle.read(bundle.model)).toEqual(toggle.kept);
  });

  it.each(TOGGLES)(
    'CB-15 · $operator — на соседних тиках решение каждого тика выполнено',
    async (toggle) => {
      const { bundle } = build();
      await settle();
      toggle.prepare(bundle.model);
      await settle();

      toggle.away(bundle.model);
      await settle();
      toggle.back(bundle.model);
      await settle();

      expect(toggle.read(bundle.model)).toEqual(toggle.applied);
    }
  );
});
