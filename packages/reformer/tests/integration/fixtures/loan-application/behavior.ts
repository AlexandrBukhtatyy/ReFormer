/**
 * Поведение заявки на кредит: вычисляемые поля, доступность и видимость, согласованность
 * значений, работа со строками массивов, правила узлов визарда и пользовательский оператор.
 *
 * Каждый оператор `@reformer/core/behaviors` здесь решает задачу настоящей анкеты:
 * - `compute` / `computeFrom` — платёж, полное имя, доход семьи; ставка по явным зависимостям;
 * - `enableWhen` / `disableWhen` со сбросом — залог ипотеки, работодатель; `enableWhen` группы —
 *   адрес проживания и адрес созаёмщика;
 * - `copyFrom` группы (адрес проживания = адрес регистрации) и с `transform` (почта для
 *   уведомлений); `syncFields` — телефон для кода подписи; `transformValue` — индекс, промокод,
 *   телефон; `resetWhen` — промокод не действует на ипотеку;
 * - `onChange` с `immediate` (пределы суммы) и с `debounce` + `signal` (города региона);
 * - `revalidateWhen` — перепроверка взноса при смене стоимости залога;
 * - `apply` / `applyEach` с вложением, `exclusiveFlag`, `aggregateInto` — строки созаёмщиков;
 * - `hideWhen`, `onInit` + `patchProps`, `onComponentEvent`, `renderEffect` + `flow.goTo`,
 *   `onMount` / `onUnmount` — правила узлов, которые исполняет рендерер;
 * - {@link showCompleteness} — пользовательский оператор на `getScope` / `effect` / `defer` /
 *   `onDispose`, неотличимый от встроенных на месте вызова.
 *
 * Поведение собирается на сборку ({@link createLoanBehavior}): ему нужны сервер и правила той же
 * сборки.
 */

import {
  aggregateInto,
  apply,
  applyEach,
  compute,
  computeFrom,
  copyFrom,
  defer,
  defineFormBehavior,
  disableWhen,
  effect,
  enableWhen,
  exclusiveFlag,
  getScope,
  hideWhen,
  onChange,
  onComponentEvent,
  onDispose,
  onInit,
  onMount,
  onUnmount,
  renderEffect,
  resetWhen,
  revalidateWhen,
  syncFields,
  transformValue,
  type FormBehavior,
  type ReadonlySignal,
} from '../../../../src/form/behaviors/index';
import type { FormModel } from '../../../../src/index';
import { validateModel } from '../../../../src/form/validation/index';
import type { LoanApi } from './api';
import {
  LOAN_LIMITS,
  type Address,
  type Applicant,
  type CoBorrower,
  type Employment,
  type LoanApplication,
  type LoanType,
  type Phone,
} from './model';
import type { LoanRules } from './validation';

/** Задержка загрузки городов после выбора региона, мс. */
export const CITY_LOOKUP_DEBOUNCE = 300;

/** Период автосохранения черновика, пока визард на экране, мс. */
export const AUTOSAVE_INTERVAL = 30_000;

/** Базовая ставка по виду кредита, % годовых. */
const BASE_RATE: Readonly<Record<LoanType, number>> = { consumer: 15.9, mortgage: 9.9, car: 12.5 };

/** Ставка по виду кредита и сроку: длинный кредит (больше пяти лет) — на процент дороже. */
function interestRateFor(type: LoanType, term: number | null): number {
  return BASE_RATE[type] + (term !== null && term > 60 ? 1 : 0);
}

/** Аннуитетный платёж, ₽ (целые); без суммы или срока — `0`. */
export function annuityPayment(amount: number | null, term: number | null, rate: number): number {
  if (amount === null || term === null || amount <= 0 || term <= 0) return 0;
  const monthly = rate / 12 / 100;
  if (monthly === 0) return Math.round(amount / term);
  return Math.round((amount * monthly) / (1 - (1 + monthly) ** -term));
}

/** Полное имя: фамилия, имя и отчество через пробел. */
function fullNameOf(applicant: Pick<Applicant, 'lastName' | 'firstName' | 'middleName'>): string {
  return [applicant.lastName, applicant.firstName, applicant.middleName]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(' ');
}

/** Телефон без разделителей: `+7 (900) 123-45-67` → `+79001234567`. */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s()-]/g, '');
}

/** Доли ответственности созаёмщиков в сумме — 100 %: долю последнего досчитывает форма. */
function sharesSumToHundred(rows: CoBorrower[]): Array<{
  index: number;
  patch: Partial<CoBorrower>;
}> {
  if (rows.length === 0) return [];
  const others = rows.slice(0, -1).reduce((sum, row) => sum + row.share, 0);
  return [{ index: rows.length - 1, patch: { share: 100 - others } }];
}

/** Поле считается заполненным: не пустое, не `false`, не пустой список. */
const isFilled = (value: unknown): boolean =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  value !== false &&
  !(Array.isArray(value) && value.length === 0);

/**
 * Пользовательский оператор: заполненность анкеты, %, — в пропсы узла `selector` (`progress`).
 *
 * Написан на низкоуровневом наборе авторинга и вызывается внутри схемы поведения, как встроенный:
 * `getScope` даёт схему своей области, `effect` следит за полями, `defer` выносит запись пропсов
 * из эффекта (правка пропсов пишет сигналы версии узла — внутри эффекта он подписался бы на них
 * сам), `onDispose` убирает индикатор, когда поведение снимают.
 *
 * @param selector - Узел, который показывает индикатор.
 * @param handles - Поля, по которым считается заполненность.
 *
 * @example
 * ```ts
 * showCompleteness('wizard', [model.$.loan.amount, model.$.applicant.lastName]);
 * ```
 */
function showCompleteness(selector: string, handles: readonly ReadonlySignal<unknown>[]): void {
  const node = getScope<unknown>().schema.node(selector);
  effect(() => {
    const filled = handles.filter((handle) => isFilled(handle.value)).length;
    const progress = Math.round((filled / handles.length) * 100);
    defer(() => node.patchProps({ progress }));
  });
  onDispose(() => node.patchProps({ progress: undefined }));
}

/**
 * Поведение адреса — на оба адреса заёмщика и на адрес созаёмщика: индекс — только цифры, список
 * городов подгружается по региону; ответ на устаревший регион отбрасывается по `signal`.
 */
function addressBehavior(server: LoanApi): FormBehavior<Address> {
  return defineFormBehavior<Address>(({ model: address, form }) => {
    transformValue(address.$.postalCode, (code) => code.replace(/\D/g, '').slice(0, 6));
    onChange(
      address.$.region,
      async (region, { signal }) => {
        form.city.updateComponentProps({ options: [], loading: region !== '' });
        if (region === '') return;
        try {
          const cities = await server.loadCities(region, signal);
          if (!signal.aborted) form.city.updateComponentProps({ options: cities, loading: false });
        } catch {
          // Отменённый запрос ждёт следующий вызов; сбой сети — пустой список.
          if (!signal.aborted) form.city.updateComponentProps({ options: [], loading: false });
        }
      },
      { debounce: CITY_LOOKUP_DEBOUNCE }
    );
  });
}

/** Телефон созаёмщика: в номере остаются цифры, плюс, скобки, пробелы и дефисы. */
const phoneBehavior = defineFormBehavior<Phone>(({ model: phone }) => {
  transformValue(phone.$.number, (number) => number.replace(/[^\d+()\s-]/g, ''));
});

/** Строка созаёмщика: адрес нужен, только если созаёмщик живёт отдельно. */
function coBorrowerBehavior(address: FormBehavior<Address>): FormBehavior<CoBorrower> {
  return defineFormBehavior<CoBorrower>(({ model: row, schema }) => {
    apply(row.$.address, address);
    applyEach(row.$.phones, phoneBehavior);
    enableWhen(row.$.address, () => !row.livesWithApplicant);
    hideWhen(schema.node('co-borrower-address'), () => row.livesWithApplicant);
  });
}

/** Подформа занятости: без работы данные работодателя не нужны — поля выключаются и стираются. */
const employmentBehavior = defineFormBehavior<Employment>(({ model: employment, schema }) => {
  const unemployed = () => employment.status === 'unemployed';
  disableWhen(
    [
      employment.$.companyName,
      employment.$.position,
      employment.$.companySite,
      employment.$.monthlyIncome,
    ],
    unemployed,
    { resetOnDisable: true }
  );
  hideWhen(schema.node('employer'), unemployed);
});

/** Поля, по которым визард показывает заполненность анкеты. */
const completenessFields = (model: FormModel<LoanApplication>): ReadonlySignal<unknown>[] => [
  model.$.loan.amount,
  model.$.loan.term,
  model.$.loan.purpose,
  model.$.applicant.lastName,
  model.$.applicant.firstName,
  model.$.applicant.birthDate,
  model.$.applicant.inn,
  model.$.phone,
  model.$.email,
  model.$.documents,
];

/**
 * Поведение заявки для одной сборки.
 *
 * @param server - API заявки: города, черновик.
 * @param rules - Правила той же сборки: перепроверка взноса идёт их схемой.
 */
export function createLoanBehavior(
  server: LoanApi,
  rules: LoanRules
): FormBehavior<LoanApplication> {
  const address = addressBehavior(server);

  return defineFormBehavior<LoanApplication>(({ model, form, schema, flow }) => {
    const mortgage = (): boolean => model.loan.type === 'mortgage';

    // Вычисляемые поля. Ставка зависит ровно от вида и срока — зависимости перечислены явно.
    computeFrom([model.$.loan.type, model.$.loan.term], model.$.loan.interestRate, interestRateFor);
    compute(model.$.loan.monthlyPayment, () =>
      annuityPayment(model.loan.amount, model.loan.term, model.loan.interestRate)
    );
    compute(model.$.applicant.fullName, () => fullNameOf(model.applicant));
    compute(
      model.$.totalIncome,
      () =>
        (model.employment.monthlyIncome ?? 0) +
        model.coBorrowers
          .map((coBorrower) => coBorrower.monthlyIncome ?? 0)
          .reduce((sum, income) => sum + income, 0)
    );
    compute(model.$.paymentToIncomeRatio, () =>
      model.totalIncome > 0 ? Math.round((model.loan.monthlyPayment / model.totalIncome) * 100) : 0
    );

    // Залог — только у ипотеки: вне её поля выключены и стёрты, секция скрыта.
    enableWhen([model.$.loan.propertyValue, model.$.loan.initialPayment], mortgage, {
      resetOnDisable: true,
    });
    hideWhen(schema.node('mortgage'), () => !mortgage());
    // Ошибку взноса пересчитываем при смене стоимости залога — если пользователь её уже видел.
    revalidateWhen([model.$.loan.propertyValue], () => {
      if (form.loan.initialPayment.touched.peek()) void validateModel(model, rules.initialPayment);
    });

    // Промокод: заглавные без пробелов; на ипотеку не действует.
    transformValue(model.$.loan.promoCode, (code) => code.toUpperCase().replace(/\s+/g, ''));
    resetWhen(model.$.loan.promoCode, mortgage, { resetValue: '' });

    // Пределы суммы по виду кредита — в поле суммы сразу при сборке и при каждой смене вида.
    onChange(
      model.$.loan.type,
      (type) => form.loan.amount.updateComponentProps({ ...LOAN_LIMITS[type] }),
      { immediate: true }
    );

    // Адреса: одна подсхема на оба; проживание по умолчанию — копия регистрации.
    apply([model.$.registrationAddress, model.$.residenceAddress], address);
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration,
    });
    enableWhen(model.$.residenceAddress, () => !model.sameAsRegistration);
    hideWhen(schema.node('residence-address'), () => model.sameAsRegistration);

    // Занятость — подформа со своим поведением.
    apply(model.$.employment, employmentBehavior);

    // Созаёмщики: поведение строки, один основной контакт, доли в сумме 100 %.
    applyEach(model.$.coBorrowers, coBorrowerBehavior(address));
    exclusiveFlag(model.$.coBorrowers, (row: FormModel<CoBorrower>) => row.$.isPrimaryContact);
    aggregateInto(model.$.coBorrowers, sharesSumToHundred);
    hideWhen(schema.node('co-borrowers-list'), () => !model.hasCoBorrowers);
    onChange(model.$.hasCoBorrowers, (hasCoBorrowers) => {
      if (!hasCoBorrowers) form.coBorrowers.clear();
    });

    // Согласия: код подписи — на контактный телефон, уведомления — на контактную почту.
    syncFields(model.$.phone, model.$.consent.smsPhone, { transform: normalizePhone });
    copyFrom(model.$.email, model.$.consent.notificationEmail, {
      when: () => model.consent.notifyByEmail,
      transform: (email) => email.trim().toLowerCase(),
    });

    // Визард: заголовок до первого рендера, переходы по шагам — через поток сборки.
    const wizard = schema.node('wizard');
    onInit(wizard, () =>
      wizard.patchProps({
        title:
          model.applicationNumber === '' ? 'Новая заявка' : `Заявка № ${model.applicationNumber}`,
      })
    );
    onComponentEvent(wizard, 'onStepClick', (stepId: string) => flow?.goTo(stepId));
    // Ипотеке нужен залог: сменили вид на ипотеку на другом шаге — возвращаем к шагу кредита.
    renderEffect(schema, () => {
      if (mortgage() && model.loan.propertyValue === null && flow?.current.peek() !== 'loan') {
        flow?.goTo('loan');
      }
    });
    onMount(wizard, () => {
      const timer = setInterval(() => void server.saveDraft(model.get()), AUTOSAVE_INTERVAL);
      return () => clearInterval(timer);
    });
    onUnmount(wizard, () => void server.saveDraft(model.get()));
    showCompleteness('wizard', completenessFields(model));
  });
}
