/**
 * Загрузка и сброс заявки на кредит: черновик с сервера, точка отсчёта, два сброса и поток.
 *
 * Загрузку и сброс видят все слои сразу: модель хранит значения и снимок `initial`, ноды — признаки
 * правки (`dirty`, `touched`) и замечания, поведение пересчитывает производные поля и решает
 * отложенные записи, поток помнит пройденные шаги. Сценарии проверяют, что каждый слой делает при:
 * - загрузке черновика — `patch` + `captureInitial` (черновик — новая точка отсчёта), `set` против
 *   `patch` (недостающие ключи), `initial` + `seed` в сборке; производные поля и поле сервера
 *   (`markServerOwned`) загрузка не пишет; `signalAt` — замечания сервера по путям черновика;
 * - правке — `isDirty()` модели (сравнение со снимком) против `dirty` ноды (правка через поле),
 *   `getValue` / `setValue` группы, `markAsUntouched`;
 * - сбросе — `form.reset()` (значения к точке отсчёта модели, ноды чисты) и `model.reset()` (те же
 *   значения, ноды не трогает); `flow.reset()` после нескольких шагов и во время проверки шага;
 *   сброс в том же тике, что и загрузка, — отложенные записи решают по состоянию в момент записи.
 * Точка отсчёта у двух сбросов одна — решение по `ReFormer-k152.14`; ветви самих модели и нод
 * покрыты юнит-тестами (`tests/core/model/`, `tests/core/nodes/`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { settle } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes } from '../test-utils/issues';
import { getNodeForSignal, isDerived, type DeepPartial } from '../../src/index';
import {
  VALID_INN,
  addCoBorrower,
  daysFromToday,
  fillApplicantStep,
  passWizardTo,
  yearsAgo,
} from './fixtures/loan-application/actions';
import { createLoanServer } from './fixtures/loan-application/api';
import { annuityPayment } from './fixtures/loan-application/behavior';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import { LOAN_STEP_IDS } from './fixtures/loan-application/flow';
import {
  blankAddress,
  createLoanInitial,
  type Address,
  type Applicant,
  type LoanApplication,
} from './fixtures/loan-application/model';

// ─── Сборки теста и их уборка ───────────────────────────────────────────────────────────────

/** Сборки текущего теста: после теста их поведение и стратегия снимаются. */
const assembled: LoanForm[] = [];

function build(options?: LoanFormOptions): LoanForm {
  const built = createLoanForm(options);
  assembled.push(built);
  return built;
}

afterEach(() => {
  for (const { bundle } of assembled.splice(0)) {
    disposeForm(bundle.form);
    bundle.validation?.controller.dispose();
  }
  vi.restoreAllMocks();
});

// ─── Черновик с сервера ────────────────────────────────────────────────────────────────────

const MOSCOW_ADDRESS: Address = {
  region: 'Москва',
  city: 'Москва',
  street: 'ул. Тверская, д. 7',
  postalCode: '125009',
};

const SPB_ADDRESS: Address = {
  region: 'Санкт-Петербург',
  city: 'Колпино',
  street: 'ул. Ленина, д. 1',
  postalCode: '196650',
};

/** Ставка ипотеки на срок больше пяти лет, % годовых. */
const LONG_MORTGAGE_RATE = 10.9;

/**
 * Черновик заявки с сервера: ипотека на 10 лет с залогом и отдельный адрес проживания. Сервер
 * присылает и свои производные поля, и номер заявки — загрузка их не пишет.
 */
const loanDraft = (): DeepPartial<LoanApplication> => ({
  applicationNumber: 'ЧЕРНОВИК',
  loan: {
    type: 'mortgage',
    amount: 3_000_000,
    term: 120,
    purpose: 'Покупка квартиры',
    firstPaymentDate: daysFromToday(30),
    promoCode: '',
    propertyValue: 9_000_000,
    initialPayment: 2_000_000,
    interestRate: 1,
    monthlyPayment: 1,
  },
  phone: '+7 (900) 123-45-67',
  email: 'ivanov@example.ru',
  registrationAddress: MOSCOW_ADDRESS,
  sameAsRegistration: false,
  residenceAddress: SPB_ADDRESS,
});

/** Тот же черновик целиком — значения `initial` сборки (шаблоны массивов модели сохранены). */
function draftApplication(): LoanApplication {
  const application = createLoanInitial();
  Object.assign(application.loan, {
    type: 'mortgage',
    amount: 3_000_000,
    term: 120,
    purpose: 'Покупка квартиры',
    firstPaymentDate: daysFromToday(30),
    propertyValue: 9_000_000,
    initialPayment: 2_000_000,
  });
  application.phone = '+7 (900) 123-45-67';
  application.email = 'ivanov@example.ru';
  application.registrationAddress = { ...MOSCOW_ADDRESS };
  application.sameAsRegistration = false;
  application.residenceAddress = { ...SPB_ADDRESS };
  application.consent.smsPhone = '+79001234567';
  return application;
}

/** Загрузить черновик в собранную заявку и сделать его точкой отсчёта. */
async function loadDraft(bundle: LoanForm['bundle']): Promise<void> {
  await settle();
  bundle.model.patch(loanDraft());
  await settle();
  bundle.model.captureInitial();
}

// ─── Загрузка ──────────────────────────────────────────────────────────────────────────────

describe('загрузка заявки — patch, captureInitial, set, initial + seed', () => {
  it('RL-01: patch + captureInitial — черновик с сервера становится точкой отсчёта: reset возвращает его, а не пустую заявку', async () => {
    const { bundle } = build();
    const { model } = bundle;
    await loadDraft(bundle);
    expect(model.isDirty()).toBe(false);

    model.loan.amount = 3_500_000;
    model.residenceAddress.city = 'Пушкин';
    expect([model.isDirty(), model.loan.isDirty(), model.applicant.isDirty()]).toEqual([
      true,
      true,
      false,
    ]);

    model.reset();
    await settle();
    expect([model.loan.amount, model.residenceAddress.city, model.isDirty()]).toEqual([
      3_000_000,
      'Колпино',
      false,
    ]);
    // Производные поля — по загруженным данным: ставка ипотеки на 10 лет и платёж по ней.
    expect([model.loan.interestRate, model.loan.monthlyPayment]).toEqual([
      LONG_MORTGAGE_RATE,
      annuityPayment(3_000_000, 120, LONG_MORTGAGE_RATE),
    ]);
  });

  it('RL-02: set против patch — set ждёт заявку целиком и предупреждает о недостающих ключах, patch сливает частичное молча', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();

    model.patch({ applicant: { lastName: 'Иванов', passport: { series: '4510' } } });
    expect(warn).not.toHaveBeenCalled();
    expect([model.applicant.lastName, model.applicant.passport.series]).toEqual(['Иванов', '4510']);

    // Ответ сервера без типа — часть полей: они остаются прежними, dev сообщает их список.
    model.applicant.set({ lastName: 'Петров', firstName: 'Пётр' } as Applicant);
    expect([
      model.applicant.lastName,
      model.applicant.firstName,
      model.applicant.passport.series,
    ]).toEqual(['Петров', 'Пётр', '4510']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      'нет ключей «applicant.middleName», «applicant.birthDate», «applicant.inn», «applicant.passport»'
    );

    // Заявка целиком: массив заменён, производное поле и поле сервера из ответа не записаны.
    warn.mockClear();
    addCoBorrower(model);
    const full = createLoanInitial();
    Object.assign(full, { applicationNumber: 'ЧЕРНОВИК', email: 'petrov@example.ru' });
    full.loan.interestRate = 1;
    model.set(full);
    expect(warn).not.toHaveBeenCalled();
    expect([model.applicationNumber, model.loan.interestRate, model.email]).toEqual([
      '',
      15.9,
      'petrov@example.ru',
    ]);
    expect([model.coBorrowers.length, form.coBorrowers.length]).toEqual([0, 0]);
  });

  it('RL-03: производные поля и поле сервера — patch, set и setValue групп их не пишут, compute считает по загруженному', async () => {
    const { bundle } = build({
      seed: (model) => {
        model.applicationNumber = 'ЗК-000042';
      },
    });
    const { model, form } = bundle;
    await settle();

    model.patch(loanDraft());
    expect([model.applicationNumber, model.loan.interestRate, model.loan.monthlyPayment]).toEqual([
      'ЗК-000042',
      LONG_MORTGAGE_RATE,
      annuityPayment(3_000_000, 120, LONG_MORTGAGE_RATE),
    ]);

    form.loan.setValue({ ...model.loan.get(), term: 240, interestRate: 1, monthlyPayment: 1 });
    expect([model.loan.term, model.loan.interestRate, model.loan.monthlyPayment]).toEqual([
      240,
      LONG_MORTGAGE_RATE,
      annuityPayment(3_000_000, 240, LONG_MORTGAGE_RATE),
    ]);

    form.setValue({ ...model.get(), applicationNumber: 'ЗК-999999', totalIncome: 1 });
    expect([model.applicationNumber, model.totalIncome]).toEqual(['ЗК-000042', 0]);
    expect([isDerived(model.$.applicationNumber), isDerived(model.$.loan.term)]).toEqual([
      true,
      false,
    ]);
  });

  it('RL-04: initial + seed — модель из черновика и правка до сборки нод; поведение при сборке загруженное не стирает', async () => {
    const { bundle } = build({
      initial: draftApplication(),
      seed: (model) => fillApplicantStep(model),
    });
    const { model, form } = bundle;
    await settle();

    expect(isDerived(model.$.applicationNumber)).toBe(true);
    expect(model.loan.get()).toMatchObject({
      type: 'mortgage',
      propertyValue: 9_000_000,
      initialPayment: 2_000_000,
      interestRate: LONG_MORTGAGE_RATE,
    });
    expect([form.loan.propertyValue.disabled.value, form.residenceAddress.disabled.value]).toEqual([
      false,
      false,
    ]);
    expect([model.residenceAddress.city, model.consent.smsPhone]).toEqual([
      'Колпино',
      '+79001234567',
    ]);
    // Правка seed видна поведению при сборке: полное имя посчитано из неё.
    expect(model.applicant.fullName).toBe('Иванов Иван Иванович');
    // Загрузка — не правка поля: ноды не помечены.
    expect([form.dirty.value, form.touched.value]).toEqual([false, false]);
    expect((await bundle.validateStep('loan')).status).toBe('valid');
    expect((await bundle.validateStep('applicant')).status).toBe('valid');
  });

  it('RL-05: signalAt — пути замечаний сервера к черновику ведут к ручкам: лист, поле строки, массив целиком; группа — нет', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    model.patch(loanDraft());
    addCoBorrower(model);
    await settle();
    // Сервер проверил черновик и вернул замечания по путям полей — их разносят по нодам.
    const serverIssues: Record<string, string> = {
      'loan.amount': 'server.limitExceeded',
      'coBorrowers.0.fullName': 'server.duplicate',
      coBorrowers: 'server.tooMany',
    };

    for (const [path, code] of Object.entries(serverIssues)) {
      const handle = model.signalAt(path);
      if (handle !== undefined) getNodeForSignal(handle)?.setIssues([{ code }]);
    }

    expect(model.signalAt('loan.amount')).toBe(model.$.loan.amount);
    expect(model.loan.signalAt('amount')).toBe(model.$.loan.amount);
    expect(model.signalAt('coBorrowers.0.fullName')).toBe(model.$.coBorrowers[0].fullName);
    expect(model.signalAt('coBorrowers')).toBe(model.$.coBorrowers);
    // Группа — не ручка значения, а строки с таким номером нет.
    expect([
      model.signalAt('registrationAddress'),
      model.signalAt('coBorrowers.5.fullName'),
    ]).toEqual([undefined, undefined]);
    expect(issueCodes(form.loan.amount)).toEqual(['server.limitExceeded']);
    expect(issueCodes(form.coBorrowers.at(0)!.fullName)).toEqual(['server.duplicate']);
    expect(issueCodes({ issues: form.coBorrowers.ownIssues })).toEqual(['server.tooMany']);
    expect(form.valid.value).toBe(false);
  });
});

// ─── Правка: dirty, touched, значения групп ────────────────────────────────────────────────

describe('правка после загрузки — isDirty модели, dirty и touched нод, значения групп', () => {
  it('RL-06: isDirty() модели — сравнение со снимком, dirty ноды — правка через поле: загрузка и запись в модель его не ставят', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    model.patch(loanDraft());
    await settle();
    expect(form.dirty.value).toBe(false);
    model.captureInitial();

    form.loan.amount.setValue(3_500_000);
    expect({
      model: model.isDirty(),
      field: form.loan.amount.dirty.value,
      group: form.loan.dirty.value,
      form: form.dirty.value,
      otherGroup: form.applicant.dirty.value,
    }).toEqual({ model: true, field: true, group: true, form: true, otherGroup: false });

    // Вернул прежнее значение: модель совпадает со снимком, а поле помнит, что его правили.
    form.loan.amount.setValue(3_000_000);
    expect([model.isDirty(), form.loan.amount.dirty.value]).toEqual([false, true]);

    // Запись мимо поля (код приложения, поведение) — правка модели, но не поля.
    model.email = 'petrov@example.ru';
    expect([model.isDirty(), form.email.dirty.value]).toEqual([true, false]);
  });

  it('RL-07: getValue / setValue группы — значения в модель, производное поле пропущено, поля помечены правкой', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();

    form.applicant.setValue({
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Иванович',
      fullName: 'Петров Пётр',
      birthDate: yearsAgo(35),
      inn: VALID_INN,
      passport: {
        series: '4510',
        number: '123456',
        issueDate: yearsAgo(10),
        issuedBy: 'ОВД района Арбат города Москвы',
      },
    });

    expect(model.applicant.fullName).toBe('Иванов Иван Иванович');
    expect(form.applicant.getValue()).toEqual(model.applicant.get());
    expect([
      form.applicant.dirty.value,
      form.applicant.passport.series.dirty.value,
      form.applicant.touched.value,
    ]).toEqual([true, true, false]);
    expect(form.getValue()).toEqual(model.get());
    // Поле над массивом целиком (мультивыбор): значение — массив.
    form.interests.setValue(['card', 'deposit']);
    expect([model.interests.toArray(), form.interests.dirty.value]).toEqual([
      ['card', 'deposit'],
      true,
    ]);
    expect((await bundle.validateStep('applicant')).status).toBe('valid');
  });

  it('RL-08: markAsUntouched — показанные проверкой замечания скрыты, но остаются; правленное поле своё показывает', async () => {
    const { bundle } = build();
    const { form } = bundle;
    await settle();
    await bundle.flow!.next();
    form.loan.purpose.setValue('Ремонт');
    expect([form.loan.amount.shouldShowError.value, form.touched.value]).toEqual([true, true]);

    form.markAsUntouched();

    expect({
      touched: form.touched.value,
      shown: form.loan.amount.shouldShowError.value,
      invalid: form.loan.amount.invalid.value,
      edited: form.loan.purpose.shouldShowError.value,
    }).toEqual({ touched: false, shown: false, invalid: true, edited: true });
  });
});

// ─── Сброс: model.reset() против form.reset() ──────────────────────────────────────────────

describe('сброс заявки — model.reset() против form.reset()', () => {
  it('RL-09: model.reset() — значения к точке отсчёта, состояние нод (замечания, touched, dirty) прежнее', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await loadDraft(bundle);
    form.loan.amount.setValue(40_000_000);
    await bundle.validateStep('loan');
    expect(issueCodes(form.loan.amount)).toEqual(['loan.amount.max']);

    model.reset();
    await settle();

    expect(model.loan.amount).toBe(3_000_000);
    // Так задумано (решение по k152.14): сброс для пользователя — form.reset(), он чистит и ноды.
    // model.reset() — сброс значений модели: замечания — дело проверки, и верное значение
    // показывается с прежней ошибкой, пока проверку не запустят снова.
    expect({
      issues: issueCodes(form.loan.amount),
      touched: form.loan.amount.touched.value,
      dirty: form.loan.amount.dirty.value,
      shown: form.loan.amount.shouldShowError.value,
    }).toEqual({ issues: ['loan.amount.max'], touched: true, dirty: true, shown: true });
    expect((await bundle.validateStep('loan')).status).toBe('valid');
    expect(form.loan.amount.issues.value).toEqual([]);
  });

  it('RL-10: form.reset() — ноды чисты, значения — к точке отсчёта модели: загруженный черновик', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await loadDraft(bundle);
    form.loan.amount.setValue(40_000_000);
    await bundle.validateStep('loan');

    form.reset();
    await settle();

    expect([form.issues.value, form.touched.value, form.dirty.value]).toEqual([[], false, false]);
    // Один сброс: та же точка отсчёта, что у model.reset(), — черновик, загруженный с
    // captureInitial, а не «чистый лист», — и модель после сброса не изменена.
    expect([model.loan.amount, model.residenceAddress.city]).toEqual([3_000_000, 'Колпино']);
    expect(model.isDirty()).toBe(false);
  });

  it('RL-10a: form.reset() — состав массива к точке отсчёта: добавленная после загрузки строка уходит', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await loadDraft(bundle);
    model.coBorrowers.push();
    await settle();
    model.captureInitial();
    model.coBorrowers.push();
    await settle();
    expect(model.coBorrowers.length).toBe(2);

    form.reset();
    await settle();

    expect(model.coBorrowers.length).toBe(1);
    expect([form.dirty.value, model.isDirty()]).toEqual([false, false]);
  });

  // Было: `model.reset()` писал в производное поле значение снимка — снятого до первого расчёта, —
  // а compute пересчитывает поле, только когда меняются его источники. Вид и срок сброс не менял:
  // ставка оставалась нулевой, хотя у потребительского кредита она 15,9 % — её показала бы сводка
  // шага и получил бы обработчик отправки. Теперь сброс производное поле не пишет.
  it('RL-11: после model.reset() производное поле согласовано с compute — ставка потребительского кредита 15,9 % [ReFormer-e9rw]', async () => {
    const { bundle } = build();
    const { model } = bundle;
    await settle();
    model.loan.patch({ amount: 500_000, purpose: 'Ремонт квартиры' });

    model.reset();
    await settle();

    expect(model.loan.interestRate).toBe(15.9);
  });

  // Было: `form.reset()` писал в поле ставки значение создания ноды — ноды строятся до поведения,
  // и значение снято до первого расчёта; источники compute сброс не менял — ставка оставалась 0.
  it('RL-12: после form.reset() производное поле согласовано с compute — ставка потребительского кредита 15,9 % [ReFormer-e9rw]', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    form.loan.amount.setValue(500_000);

    form.reset();
    await settle();

    expect(model.loan.interestRate).toBe(15.9);
  });

  // Снимок модели снят при её создании, до поведения: ставку посчитал `computeFrom` при сборке, и
  // значение поля разошлось со снимком. Было: нетронутая заявка — dirty, «Есть несохранённые
  // изменения» и подтверждение сброса из docs/llms/28-submit-and-reset.md срабатывали на пустой
  // форме. Теперь производное поле изменением не считается.
  it('RL-13: свежая заявка без правок не dirty — ставку посчитало поведение, а не пользователь [ReFormer-e9rw]', async () => {
    const { bundle } = build();
    await settle();

    expect(bundle.model.isDirty()).toBe(false);
  });

  it('RL-14: initial + seed — правки seed входят в точку отсчёта: оба сброса их сохраняют', async () => {
    const initial = createLoanInitial();
    initial.email = 'ivanov@example.ru';
    const { bundle } = build({
      initial,
      seed: (model) => {
        model.applicationNumber = 'ЗК-000042';
        model.dependents = 2;
      },
    });
    const { model, form } = bundle;
    await settle();
    model.email = 'petrov@example.ru';
    model.dependents = 3;

    form.reset();
    expect([model.email, model.dependents, model.applicationNumber]).toEqual([
      'ivanov@example.ru',
      2,
      'ЗК-000042',
    ]);

    // seed — правка модели при сборке формы, и точка отсчёта своей модели снимается после неё:
    // model.reset() правки seed тоже сохраняет. Номер заявки сброс не трогает: полем владеет
    // сервер (`markDerived`), как и `set` с `patch` [ReFormer-e9rw].
    model.email = 'petrov@example.ru';
    model.dependents = 3;
    model.reset();
    expect([model.email, model.dependents, model.applicationNumber]).toEqual([
      'ivanov@example.ru',
      2,
      'ЗК-000042',
    ]);
    expect(model.isDirty()).toBe(false);
  });

  it('RL-15: initial с ипотекой — смена вида выключает залог, а сброс выключенного поля возвращает загруженную стоимость', async () => {
    const { bundle } = build({ initial: draftApplication() });
    const { model, form } = bundle;
    await settle();

    model.loan.type = 'car';
    await settle();

    expect(form.loan.propertyValue.disabled.value).toBe(true);
    // Так задумано (решение по k152.14): `resetOnDisable` сбрасывает поле к значению
    // создания ноды, а у сборки из `initial` это загруженный залог — поле выключено, но не стёрто
    // и уходит в отправку автокредита. После загрузки через patch (RL-01, CB-01) поле стирается.
    expect([model.loan.propertyValue, model.loan.initialPayment]).toEqual([9_000_000, 2_000_000]);
    expect(model.get().loan.propertyValue).toBe(9_000_000);
  });

  it('RL-16: form.reset() пары syncFields — пара возвращается к собранной форме, телефон из seed цел', async () => {
    // Своя модель (`initial`): точку отсчёта снимает сборка, и правки seed в неё входят. У
    // переданной модели (сборка без `initial`) точкой отсчёта управляет владелец — seed туда не попадает.
    const { bundle } = build({
      initial: createLoanInitial(),
      seed: (model) => {
        model.phone = '+7 (900) 123-45-67';
      },
    });
    const { model, form } = bundle;
    // Первая копия syncFields выполнена ещё в сборке — до микротаска, и точка отсчёта снята после неё.
    expect(model.consent.smsPhone).toBe('+79001234567');
    model.email = 'ivanov@example.ru';
    model.consent.smsPhone = '+79990000000';
    await settle();
    expect(model.phone).toBe('+79990000000');

    form.reset();
    await settle();

    // Точка отсчёта — собранная форма, пара в ней согласована: сброс возвращает обе стороны, и
    // синхронизации нечего менять.
    expect([model.phone, model.consent.smsPhone, model.email]).toEqual([
      '+7 (900) 123-45-67',
      '+79001234567',
      '',
    ]);
  });
});

// ─── Сброс потока и сброс в том же тике ────────────────────────────────────────────────────

describe('сброс заявки — поток шагов и отложенные записи поведения', () => {
  it('RL-17: flow.reset() после нескольких шагов — поток на первом шаге, пройденные забыты; данные и touched прежние', async () => {
    const { bundle } = build();
    const flow = bundle.flow!;
    await passWizardTo(bundle, 'contacts');

    flow.reset();

    expect([flow.current.value, flow.index.value, [...flow.completed.value]]).toEqual([
      'loan',
      0,
      [],
    ]);
    expect(LOAN_STEP_IDS.filter((id) => flow.canGoTo(id))).toEqual(['loan']);
    expect(flow.goTo('applicant')).toMatchObject({ status: 'stayed', reason: 'locked' });
    expect([bundle.model.applicant.lastName, bundle.form.loan.amount.touched.value]).toEqual([
      'Иванов',
      true,
    ]);
    expect(await flow.next()).toEqual({ status: 'moved', from: 'loan', to: 'applicant' });
  });

  it('RL-18: flow.reset() во время проверки шага — переход отменён, поток на первом шаге', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle } = build({ server });
    const flow = bundle.flow!;
    await passWizardTo(bundle, 'applicant');
    fillApplicantStep(bundle.model);
    await settle();
    const transition = flow.next();
    await settle();
    expect([flow.validating.value, bundle.form.applicant.inn.pending.value]).toEqual([true, true]);

    flow.reset();
    server.last('checkInn').resolve({ status: 'found' });

    expect(await transition).toMatchObject({ status: 'stayed', step: 'loan', reason: 'cancelled' });
    expect([flow.current.value, [...flow.completed.value]]).toEqual(['loan', []]);
  });

  it('RL-19: загрузка и model.reset() в одном тике — отложенные записи поведения решают по состоянию после сброса', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();

    model.patch(loanDraft());
    model.loan.promoCode = 'spring 24';
    model.reset();
    await settle();

    expect(model.loan.get()).toMatchObject({
      type: 'consumer',
      propertyValue: null,
      initialPayment: null,
      promoCode: '',
    });
    expect([form.loan.propertyValue.disabled.value, form.residenceAddress.disabled.value]).toEqual([
      true,
      true,
    ]);
    expect([model.residenceAddress.get(), model.consent.smsPhone]).toEqual([blankAddress(), '']);
  });

  it('RL-20: смена вида и form.reset() в одном тике — доступность залога по состоянию после сброса', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    model.loan.type = 'mortgage';
    await settle();
    model.loan.patch({ propertyValue: 9_000_000 });

    model.loan.type = 'car';
    form.reset();
    expect(form.loan.propertyValue.disabled.value).toBe(false);
    await settle();

    expect([
      model.loan.type,
      model.loan.propertyValue,
      form.loan.propertyValue.disabled.value,
    ]).toEqual(['consumer', null, true]);
  });
});
