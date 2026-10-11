/**
 * Живая проверка заявки на кредит — стратегии `change`, `blur` и `afterFirstSubmit` на настоящей
 * форме.
 *
 * Сборка стратегию не армирует: в приложении `start()` контроллера зовёт `useFormBundle`, здесь —
 * сценарий (`bundle.validation!.controller.start()`). Живой прогон проверяет полный набор правил
 * (все шаги и `extras`), не метит поля тронутыми и показывает замечания только тронутых или
 * изменённых пользователем полей. Ввод пользователя — `setValue` ноды (он ставит `dirty`), уход
 * из поля — `markAsTouched()`, как это делает привязка поля в React. Здесь проверяется:
 * - `change` с `debounce` — одна проверка на серию правок (фейковые часы), без задержки —
 *   прогон на каждую правку, устаревший отменён вместе с запросом ИНН;
 * - `blur` — уход пользователя из поля против касаний самой проверки (шаг, отправка);
 * - `afterFirstSubmit` + `liveAfterSubmit` — до отправки молчит, после — живёт;
 * - `revalidateWhen` поведения рядом с живой проверкой — без зацикливания;
 * - строки массивов, добавленные после `start()`, — под стратегией;
 * - `stop` / `dispose` контроллера; обходы `eachLeafSignal` / `eachValueSignal`, на которых
 *   стратегия строит подписку.
 * Статусы отправки — в `submit-statuses`, гонки проверки — в `async-and-races`.
 */

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { advance, settle, useFakeClock } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes } from '../test-utils/issues';
import { eachLeafSignal, eachValueSignal } from '../../src/index';
import { defineValidation, type ValidationDefinition } from '../../src/form/validation/index';
import {
  VALID_INN,
  addCoBorrower,
  fillApplicantStep,
  fillLoanStep,
  flushBehaviors,
} from './fixtures/loan-application/actions';
import { createLoanServer } from './fixtures/loan-application/api';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import type { LoanApplication } from './fixtures/loan-application/model';

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
    bundle.validation?.controller.dispose();
    disposeForm(bundle.form);
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Помощники ──────────────────────────────────────────────────────────────────────────────

/** Задержка живой проверки в сценариях, мс. */
const LIVE_DEBOUNCE = 300;

/** Правила сценария со счётчиком прогонов полного набора: замечаний не дают, вызов — на прогон. */
function countingRules(): {
  runs: Mock<() => void>;
  extraRules: ValidationDefinition<LoanApplication>;
} {
  const runs = vi.fn<() => void>();
  return { runs, extraRules: defineValidation<LoanApplication>(() => runs()) };
}

/**
 * Собрать заявку со счётчиком прогонов и армировать живую проверку — как это делает
 * `useFormBundle`.
 */
async function started(
  options: LoanFormOptions
): Promise<LoanForm & { runs: Mock<() => void>; stop: () => void }> {
  const { runs, extraRules } = countingRules();
  const built = build({ ...options, extraRules });
  await flushBehaviors();
  const stop = built.bundle.validation!.controller.start();
  return { ...built, runs, stop };
}

// ─── Сборка и старт ─────────────────────────────────────────────────────────────────────────

describe('живая проверка — сборка и старт', () => {
  it('LS-01: сборка стратегию не армирует — без start() правки заявки не проверяются', async () => {
    const { runs, extraRules } = countingRules();
    const { bundle, server } = build({ strategy: 'change', extraRules });
    const { form } = bundle;

    form.loan.amount.setValue(5);
    form.applicant.inn.setValue(VALID_INN);
    await settle();

    expect(runs).not.toHaveBeenCalled();
    expect(server.callsOf('checkInn')).toEqual([]);
    expect(form.loan.amount.issues.value).toEqual([]);
  });
});

// ─── change ─────────────────────────────────────────────────────────────────────────────────

describe('стратегия change', () => {
  it('LS-02: с debounce — одна проверка на серию правок после паузы; показано только то, что правил пользователь', async () => {
    useFakeClock();
    const { bundle, server, runs } = await started({
      strategy: 'change',
      debounce: LIVE_DEBOUNCE,
      seed: (model) => fillApplicantStep(model),
    });
    const { form } = bundle;

    for (const lastName of ['P', 'Pe', 'Petrov']) {
      form.applicant.lastName.setValue(lastName);
      await advance(LIVE_DEBOUNCE - 100);
    }
    expect(runs).not.toHaveBeenCalled();
    await advance(100);
    await flushBehaviors();

    expect(runs).toHaveBeenCalledTimes(1);
    expect(server.callsOf('checkInn')).toHaveLength(1);
    expect(issueCodes(form.applicant.lastName)).toEqual(['name.cyrillic']);
    expect(form.applicant.lastName.shouldShowError.value).toBe(true);
    // Прогон проверил всю заявку, но поле, которого пользователь не касался, ошибку не показывает.
    expect(issueCodes(form.phone)).toEqual(['phone.required']);
    expect(form.phone.shouldShowError.value).toBe(false);
    // Живой прогон полей не метит.
    expect(form.applicant.lastName.touched.value).toBe(false);
  });

  it('LS-03: без задержки — прогон на каждую правку; устаревший отменён вместе с запросом ИНН', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle, runs } = await started({
      strategy: 'change',
      server,
      seed: (model) => fillApplicantStep(model),
    });
    const { form } = bundle;

    form.applicant.lastName.setValue('Петров');
    form.applicant.lastName.setValue('Петровский');

    // Производные поля (полное имя) пересчитаны в той же волне — лишних прогонов они не дают.
    expect(runs).toHaveBeenCalledTimes(2);
    const [stale, fresh] = server.callsOf('checkInn');
    expect([stale.aborted, fresh.aborted]).toEqual([true, false]);
    expect(bundle.validating.value).toBe(true);

    fresh.resolve({ status: 'found' });
    await settle();

    expect(bundle.validating.value).toBe(false);
    expect(form.applicant.inn.pending.value).toBe(false);
    expect(form.applicant.lastName.issues.value).toEqual([]);
  });
});

// ─── blur ───────────────────────────────────────────────────────────────────────────────────

describe('стратегия blur', () => {
  it('LS-04: уход пользователя из поля запускает прогон; касания самой проверки — шаг и отправка — нет', async () => {
    const { bundle, runs } = await started({ strategy: 'blur' });
    const { form, model } = bundle;

    form.loan.amount.markAsTouched();
    await settle();
    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(form.loan.amount)).toEqual(['loan.amount.required']);
    expect(form.loan.amount.shouldShowError.value).toBe(true);
    // Срок тоже пуст, но пользователь его не покидал — ошибка не показана.
    expect([issueCodes(form.loan.term), form.loan.term.shouldShowError.value]).toEqual([
      ['loan.term.required'],
      false,
    ]);

    // Ввод без ухода из поля проверку не запускает.
    fillLoanStep(model);
    await settle();
    expect(runs).toHaveBeenCalledTimes(1);

    // «Далее» метит поля шага тронутыми от имени проверки — живой прогон это не будит.
    expect(await bundle.flow!.next()).toMatchObject({ status: 'moved' });
    await settle();
    expect(runs).toHaveBeenCalledTimes(1);

    // Отказ отправки метит тронутой всю форму — тоже от имени проверки: прогон один, свой.
    expect((await bundle.submit(vi.fn())).status).toBe('invalid');
    await settle();
    expect(runs).toHaveBeenCalledTimes(2);
  });

  it('LS-05: повторный уход из исправленного поля перепроверяет его [ReFormer-t6qm]', async () => {
    const { bundle } = await started({ strategy: 'blur' });
    const { form } = bundle;
    // Первый уход из пустого поля показал «сумма обязательна» (LS-04).
    form.loan.amount.markAsTouched();
    await settle();

    // Пользователь вернулся в поле, ввёл сумму и снова ушёл. Было: стратегия видела только
    // смену `touched` с false на true, а поле уже тронуто — повторный уход прогона не
    // запускал, и исправленная ошибка висела до следующей явной проверки.
    form.loan.amount.setValue(500_000);
    form.loan.amount.markAsTouched();
    await settle();

    expect(form.loan.amount.issues.value).toEqual([]);
  });
});

// ─── afterFirstSubmit ───────────────────────────────────────────────────────────────────────

describe('стратегия afterFirstSubmit', () => {
  it('LS-06: liveAfterSubmit change — до первой отправки молчит, после — проверяет каждую правку', async () => {
    const { bundle, runs } = await started({ strategy: 'afterFirstSubmit' });
    const { form } = bundle;

    form.loan.amount.setValue(5);
    form.loan.amount.markAsTouched();
    await settle();
    expect(runs).not.toHaveBeenCalled();
    expect(form.loan.amount.issues.value).toEqual([]);

    expect((await bundle.submit(vi.fn())).status).toBe('invalid');
    expect(issueCodes(form.loan.amount)).toEqual(['loan.amount.min', 'loan.amount.step']);

    form.loan.amount.setValue(500_000);
    await settle();

    expect(runs).toHaveBeenCalledTimes(2);
    expect(form.loan.amount.issues.value).toEqual([]);
  });

  it('LS-07: поведение под вопросом: проверка шага визарда первой отправкой не считается', async () => {
    // поведение под вопросом: живую фазу включает только `validate()` / `submit()` контроллера.
    // «Далее» визарда (`flow.next()`) показывает ошибки шага, но живую фазу не включает: поле,
    // исправленное после отказа шага, держит прежнюю ошибку до следующего «Далее». Для визарда
    // «после первой попытки» естественнее считать и первую проверку шага.
    const { bundle, runs } = await started({ strategy: 'afterFirstSubmit' });
    const { form } = bundle;
    form.loan.amount.setValue(5);

    expect(await bundle.flow!.next()).toMatchObject({ status: 'stayed', reason: 'invalid' });
    expect(issueCodes(form.loan.amount)).toEqual(['loan.amount.min', 'loan.amount.step']);

    form.loan.amount.setValue(500_000);
    await settle();

    expect(runs).not.toHaveBeenCalled();
    expect(issueCodes(form.loan.amount)).toEqual(['loan.amount.min', 'loan.amount.step']);
  });

  it('LS-08: liveAfterSubmit blur — до отправки молчит и на уход из поля; после — ввод без ухода не проверяет', async () => {
    const { bundle, runs } = await started({
      strategy: 'afterFirstSubmit',
      liveAfterSubmit: 'blur',
    });
    const { form } = bundle;

    form.loan.amount.setValue(5);
    form.loan.amount.markAsTouched();
    await settle();
    expect(runs).not.toHaveBeenCalled();

    expect((await bundle.submit(vi.fn())).status).toBe('invalid');
    form.loan.amount.setValue(500_000);
    await settle();

    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(form.loan.amount)).toEqual(['loan.amount.min', 'loan.amount.step']);
  });

  it('LS-09: liveAfterSubmit blur — после отказа отправки уход из исправленного поля перепроверяет его [ReFormer-t6qm]', async () => {
    const { bundle } = await started({ strategy: 'afterFirstSubmit', liveAfterSubmit: 'blur' });
    const { form } = bundle;
    form.loan.amount.setValue(5);
    await bundle.submit(vi.fn());

    // Отказ отправки пометил тронутой всю форму. Было: стратегия видела только смену
    // `touched`, и ни один уход из поля после первой отправки живой прогон не запускал —
    // живой фазы не было вовсе.
    form.loan.amount.setValue(500_000);
    form.loan.amount.markAsTouched();
    await settle();

    expect(form.loan.amount.issues.value).toEqual([]);
  });
});

// ─── revalidateWhen ─────────────────────────────────────────────────────────────────────────

describe('revalidateWhen рядом с живой проверкой', () => {
  it('LS-10: смена стоимости залога — взнос перепроверен сразу, живой прогон — после паузы, по одному разу, без цикла', async () => {
    useFakeClock();
    const { bundle, runs } = await started({ strategy: 'change', debounce: LIVE_DEBOUNCE });
    const { form, model } = bundle;
    model.loan.type = 'mortgage';
    await flushBehaviors();
    model.loan.patch({ propertyValue: 5_000_000, initialPayment: 1_000_000 });
    await advance(LIVE_DEBOUNCE);
    await flushBehaviors();
    runs.mockClear();
    form.loan.initialPayment.markAsTouched();

    form.loan.propertyValue.setValue(800_000);
    await flushBehaviors();
    // `revalidateWhen` перепроверил взнос своей схемой, не дожидаясь живого прогона.
    expect(issueCodes(form.loan.initialPayment)).toEqual(['loan.initialPayment.tooHigh']);
    expect(runs).not.toHaveBeenCalled();

    await advance(LIVE_DEBOUNCE);
    await flushBehaviors();
    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(form.loan.propertyValue)).toEqual(['loan.propertyValue.min']);
    expect(issueCodes(form.loan.initialPayment)).toEqual(['loan.initialPayment.tooHigh']);

    // Замечания, записанные обоими прогонами, ни один из них снова не будят.
    await advance(10 * LIVE_DEBOUNCE);
    await flushBehaviors();
    expect(runs).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(bundle.validating.value).toBe(false);
  });
});

// ─── Строки после start() ───────────────────────────────────────────────────────────────────

describe('строки массивов, добавленные после start()', () => {
  it('LS-11: blur — поле новой строки созаёмщика и её телефона под стратегией', async () => {
    const { bundle, runs } = await started({ strategy: 'blur' });
    const { form, model } = bundle;
    addCoBorrower(model, { fullName: '' });
    await settle();
    runs.mockClear();
    const row = form.coBorrowers.at(0)!;

    row.fullName.markAsTouched();
    await settle();
    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(row.fullName)).toEqual(['coBorrower.fullName.required']);
    expect(row.fullName.shouldShowError.value).toBe(true);

    // Вложенный массив строки: телефон тоже под стратегией.
    const phone = row.phones.at(0)!.number;
    phone.setValue('12-34');
    phone.markAsTouched();
    await settle();
    expect(runs).toHaveBeenCalledTimes(2);
    expect(issueCodes(phone)).toEqual(['phone']);
  });

  it('LS-12: поведение под вопросом [ReFormer-jefl]: при blur добавление строки само запускает прогон', async () => {
    // поведение под вопросом: стратегия подписана на состав массивов (иначе не увидела бы уход
    // из полей новых строк), и смена состава — уже живой прогон, хотя из поля никто не уходил.
    // Созаёмщик с телефоном — два массива, два прогона; ошибки не видны (поля не тронуты), но
    // каждый такой прогон зовёт и async-правила — с заполненным ИНН это запрос на сервер.
    const { bundle, runs } = await started({ strategy: 'blur' });

    addCoBorrower(bundle.model);
    await settle();

    expect(runs).toHaveBeenCalledTimes(2);
  });

  it('LS-13: change — правка поля новой строки проверяется и показывает ошибку', async () => {
    const { bundle, runs } = await started({ strategy: 'change' });
    const { form, model } = bundle;
    addCoBorrower(model);
    await settle();
    runs.mockClear();
    const row = form.coBorrowers.at(0)!;

    row.fullName.setValue('Ив');
    await settle();

    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(row.fullName)).toEqual(['minLength']);
    expect(row.fullName.shouldShowError.value).toBe(true);
  });
});

// ─── stop и dispose ─────────────────────────────────────────────────────────────────────────

describe('stop и dispose контроллера', () => {
  it('LS-14: stop() из start() снимает подписки, повторный start() армирует заново; start() идемпотентен', async () => {
    const { bundle, runs, stop } = await started({ strategy: 'change' });
    const { controller } = bundle.validation!;
    const { form } = bundle;
    controller.start();

    form.loan.purpose.setValue('Ремонт квартиры');
    await settle();
    expect(runs).toHaveBeenCalledTimes(1);

    stop();
    form.loan.purpose.setValue('Ремонт кухни');
    await settle();
    expect(runs).toHaveBeenCalledTimes(1);

    controller.start();
    form.loan.purpose.setValue('Ремонт дачи');
    await settle();
    expect(runs).toHaveBeenCalledTimes(2);
  });

  it('LS-15: dispose во время задержки снимает отложенный прогон; правки после — тишина', async () => {
    useFakeClock();
    const { bundle, runs } = await started({ strategy: 'change', debounce: LIVE_DEBOUNCE });
    const { form } = bundle;

    form.loan.purpose.setValue('Ремонт квартиры');
    expect(vi.getTimerCount()).toBe(1);
    bundle.validation!.controller.dispose();

    expect(vi.getTimerCount()).toBe(0);
    form.loan.purpose.setValue('Ремонт кухни');
    await advance(2 * LIVE_DEBOUNCE);
    expect(runs).not.toHaveBeenCalled();
  });
});

// ─── Обходы модели ──────────────────────────────────────────────────────────────────────────

describe('eachLeafSignal и eachValueSignal — на что подписана стратегия', () => {
  /** Пути ручек модели в порядке обхода. */
  function walk(visit: typeof eachLeafSignal, model: LoanForm['bundle']['model']): string[] {
    const paths: string[] = [];
    visit(model, (handle) => paths.push(handle.__path));
    return paths;
  }

  it('LS-16: eachValueSignal — листья и массивы целиком, eachLeafSignal — только листья; новая строка — в обоих', async () => {
    const { bundle } = build();
    await settle();
    const { model } = bundle;
    const leaves = walk(eachLeafSignal, model);
    const values = walk(eachValueSignal, model);

    expect(values.filter((path) => !leaves.includes(path))).toEqual([
      'employment.previousJobs',
      'coBorrowers',
      'interests',
      'references',
    ]);
    // Поле файлов из начального `null` — лист, а не массив.
    expect(leaves).toContain('documents');

    addCoBorrower(model);
    await settle();
    const rowLeaves = walk(eachLeafSignal, model).filter((path) => !leaves.includes(path));
    const rowValues = walk(eachValueSignal, model).filter((path) => !values.includes(path));

    expect(rowValues.filter((path) => !rowLeaves.includes(path))).toEqual(['coBorrowers.0.phones']);
    expect(rowLeaves).toEqual(
      expect.arrayContaining(['coBorrowers.0.fullName', 'coBorrowers.0.phones.0.number'])
    );
  });

  it('LS-17: blur мультивыбора (массив целиком) виден стратегии — его ручку даёт только eachValueSignal', async () => {
    const { bundle, runs } = await started({ strategy: 'blur' });
    const { form, model } = bundle;
    model.$.interests.value = ['card', 'deposit', 'insurance', 'investments'];
    await settle();
    // Смена состава мультивыбора — смена состава массива: прогон без ухода из поля (ReFormer-jefl).
    expect(runs).toHaveBeenCalledTimes(1);
    expect(form.interests.shouldShowError.value).toBe(false);

    form.interests.markAsTouched();
    await settle();

    expect(runs).toHaveBeenCalledTimes(2);
    expect(issueCodes(form.interests)).toEqual(['interests.tooMany']);
    expect(form.interests.shouldShowError.value).toBe(true);
  });
});
