/**
 * Асинхронность и гонки заявки на кредит: проверка ИНН на сервере, поиск городов региона и
 * отложенные записи — глазами формы целиком.
 *
 * Юнит-тесты раннера, стратегии и потока проверяют каждую ветвь по отдельности; здесь — то, что
 * видно, когда они работают вместе на настоящей форме:
 * - пока сервер проверяет ИНН, ждут поле, его группа и форма (`pending`), идёт проверка бандла и
 *   потока (`validating`), а замечания шага разносятся целиком после ответа;
 * - сбой сервера — это сбой проверки (`error`, `ruleFailed`, `failures`), а не «ИНН в порядке»;
 * - устаревший прогон отменяется (`cancelled`) вместе с запросом его правила (`AbortSignal`), а
 *   прогоны разных схем (шаг и отправка) друг друга не отменяют;
 * - строку удалили, пока ждали её async-правило, — статус проверки совпадает с `valid` формы;
 * - поиск городов (`onChange` с `debounce` и `signal`) и снятие формы во время задержки;
 * - `runOutsideEffect`, `safeCallback`, `safeDebouncedCallback` в реакциях приложения поверх формы.
 * Статусы отправки — в `submit-statuses`, живые стратегии — в `live-strategies`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { advance, settle, useFakeClock } from '../test-utils/async';
import { controlledAsyncRule, type ControlledAsyncRule } from '../test-utils/async-rules';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes } from '../test-utils/issues';
import {
  eachValueSignal,
  runOutsideEffect,
  safeCallback,
  safeDebouncedCallback,
} from '../../src/index';
import { effect } from '../../src/signals';
import {
  applyEach,
  defineValidation,
  validateAsync,
  type ValidationDefinition,
} from '../../src/form/validation/index';
import {
  VALID_INN,
  addCoBorrower,
  fillApplicantStep,
  flushBehaviors,
  passWizardTo,
} from './fixtures/loan-application/actions';
import { createLoanServer } from './fixtures/loan-application/api';
import { CITY_LOOKUP_DEBOUNCE } from './fixtures/loan-application/behavior';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import type { CoBorrower, LoanApplication } from './fixtures/loan-application/model';

// ─── Сборки теста и их уборка ───────────────────────────────────────────────────────────────

/** Сборки текущего теста: после теста их поведение и стратегия снимаются. */
const assembled: LoanForm[] = [];

function build(options?: LoanFormOptions): LoanForm {
  const built = createLoanForm(options);
  assembled.push(built);
  return built;
}

/** Реакции приложения поверх формы (`effect`), снимаемые после теста. */
const reactions: Array<() => void> = [];

afterEach(() => {
  for (const stop of reactions.splice(0)) stop();
  for (const { bundle } of assembled.splice(0)) {
    bundle.validation?.controller.dispose();
    disposeForm(bundle.form);
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Помощники ──────────────────────────────────────────────────────────────────────────────

/** ИНН верного формата, которого нет в списках заглушки: сервер его «находит». */
const OTHER_INN = '500100732260';

/** Сборка на шаге «Заёмщик» с заполненным шагом: следующий `flow.next()` спросит сервер про ИНН. */
async function atApplicantStep(options?: LoanFormOptions): Promise<LoanForm> {
  const built = build(options);
  await passWizardTo(built.bundle, 'applicant');
  fillApplicantStep(built.bundle.model);
  await flushBehaviors();
  return built;
}

/**
 * Проверка созаёмщика в бюро кредитных историй — async-правило строки (по ФИО), ответы выдаёт
 * тест. Подключается правилами сценария (`extraRules`): проверяется полной проверкой и отправкой.
 */
function bureauCheck(check: ControlledAsyncRule<string>): ValidationDefinition<LoanApplication> {
  const row = defineValidation<CoBorrower>(({ model }) =>
    validateAsync(model.$.fullName, [check.rule])
  );
  return defineValidation<LoanApplication>(({ model }) => applyEach(model.$.coBorrowers, row));
}

// ─── Ожидание проверки ──────────────────────────────────────────────────────────────────────

describe('async-правило ИНН — ожидание проверки шага', () => {
  it('AR-01: пока сервер проверяет ИНН, ждут поле, группа заёмщика и форма; идёт проверка бандла и потока', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle } = await atApplicantStep({ server });
    const { form } = bundle;

    const next = bundle.flow!.next();

    expect(server.callsOf('checkInn').map((call) => call.args[0])).toEqual([VALID_INN]);
    expect([form.applicant.inn.pending.value, form.applicant.pending.value]).toEqual([true, true]);
    expect(form.pending.value).toBe(true);
    // Соседи ИНН без async-правил не ждут.
    expect([form.applicant.passport.pending.value, form.loan.pending.value]).toEqual([
      false,
      false,
    ]);
    // Пока поле ждёт, оно ни valid, ни invalid — как и форма.
    expect([form.applicant.inn.valid.value, form.applicant.inn.invalid.value]).toEqual([
      false,
      false,
    ]);
    expect([form.valid.value, form.invalid.value]).toEqual([false, false]);
    expect([bundle.validating.value, bundle.flow!.validating.value]).toEqual([true, true]);
    expect(bundle.submitting.value).toBe(false);

    server.last('checkInn').resolve({ status: 'found' });

    expect(await next).toEqual({ status: 'moved', from: 'applicant', to: 'contacts' });
    expect([form.applicant.inn.pending.value, form.pending.value]).toEqual([false, false]);
    expect([bundle.validating.value, bundle.flow!.validating.value]).toEqual([false, false]);
  });

  it('AR-02: замечания шага разносятся целиком после ответа сервера — синхронные не обгоняют проверку ИНН', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle } = await atApplicantStep({ server });
    bundle.model.applicant.lastName = '';
    const { form } = bundle;

    const next = bundle.flow!.next();
    await settle();

    // Фамилия пуста, но её замечание ждёт прогон целиком: поле не мигает статусом до ответа.
    expect(form.applicant.lastName.issues.value).toEqual([]);
    server.last('checkInn').resolve({ status: 'found' });

    expect(await next).toMatchObject({ status: 'stayed', step: 'applicant', reason: 'invalid' });
    expect(issueCodes(form.applicant.lastName)).toEqual(['required']);
    expect(form.applicant.inn.issues.value).toEqual([]);
  });

  it('AR-03: «нет в реестре» — замечание с ИНН в параметрах, поле видно с ошибкой, шаг не пройден', async () => {
    const server = createLoanServer({ unknownInns: [VALID_INN] });
    const { bundle } = await atApplicantStep({ server });
    const { form } = bundle;

    const transition = await bundle.flow!.next();

    expect(transition).toMatchObject({ status: 'stayed', reason: 'invalid' });
    expect(form.applicant.inn.issues.value).toEqual([
      { code: 'applicant.inn.notFound', params: { inn: VALID_INN } },
    ]);
    expect(form.applicant.inn.shouldShowError.value).toBe(true);
    expect(bundle.flow!.completed.value.has('applicant')).toBe(false);
  });
});

// ─── Сбой async-правила ─────────────────────────────────────────────────────────────────────

describe('отклонение async-правила — сбой проверки, а не «ИНН в порядке»', () => {
  it('AR-04: flow.next() — причина error, сбой сети в failures, на поле ruleFailed, шаг не пройден', async () => {
    const server = createLoanServer({ failingInns: [VALID_INN] });
    const { bundle } = await atApplicantStep({ server });
    const { form, model } = bundle;

    const transition = await bundle.flow!.next();

    expect(transition).toMatchObject({
      status: 'stayed',
      step: 'applicant',
      reason: 'error',
      validation: { status: 'error' },
    });
    const failures = transition.status === 'stayed' ? transition.validation!.failures : [];
    expect(failures.map((failure) => failure.handle)).toEqual([model.$.applicant.inn]);
    expect(failures[0]?.error).toMatchObject({
      name: 'NetworkError',
      message: 'Сервис проверки ИНН недоступен',
    });
    expect(issueCodes(form.applicant.inn)).toEqual(['ruleFailed']);
    expect([form.applicant.inn.invalid.value, form.applicant.inn.shouldShowError.value]).toEqual([
      true,
      true,
    ]);
    expect([...bundle.flow!.completed.value]).toEqual(['loan']);
  });

  it('AR-05: validate() — статус error важнее invalid; проверка после восстановления сети снимает ruleFailed', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const { form, model } = bundle;
    server.hold('checkInn');
    model.email = 'ivanov@';

    const failed = bundle.validate();
    server.last('checkInn').reject(new Error('Сервис проверки ИНН недоступен'));
    const result = await failed;

    expect(result.status).toBe('error');
    expect(result.failures.map((failure) => failure.handle)).toEqual([model.$.applicant.inn]);
    expect([issueCodes(form.applicant.inn), issueCodes(form.email)]).toEqual([
      ['ruleFailed'],
      ['email'],
    ]);

    model.email = 'ivanov@example.ru';
    const retry = bundle.validate();
    server.last('checkInn').resolve({ status: 'found' });

    expect((await retry).status).toBe('valid');
    expect([form.applicant.inn.issues.value, form.email.issues.value]).toEqual([[], []]);
    expect(form.valid.value).toBe(true);
  });
});

// ─── Устаревший прогон ──────────────────────────────────────────────────────────────────────

describe('устаревший прогон — cancelled и отмена запроса правила', () => {
  it('AR-06: второй «Далее» поверх первого — первый cancelled, его запрос ИНН отменён и сбоем не считается', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle } = await atApplicantStep({ server });
    const { form } = bundle;

    const first = bundle.flow!.next();
    const second = bundle.flow!.next();
    const [stale, fresh] = server.callsOf('checkInn');

    // Сигнал правила устаревшего прогона сработал сразу, а заглушка, как fetch, отклонила запрос.
    expect([stale.aborted, stale.settled]).toEqual([true, true]);
    expect(fresh.aborted).toBe(false);
    expect(await first).toMatchObject({
      status: 'stayed',
      step: 'applicant',
      reason: 'cancelled',
      validation: { status: 'cancelled', failures: [] },
    });
    // Отменённый прогон снял только свою отметку: поле ждёт ответа на свежий запрос.
    expect(form.applicant.inn.pending.value).toBe(true);
    expect(bundle.flow!.validating.value).toBe(true);

    fresh.resolve({ status: 'found' });

    expect(await second).toEqual({ status: 'moved', from: 'applicant', to: 'contacts' });
    expect(form.applicant.inn.issues.value).toEqual([]);
    expect(form.applicant.inn.pending.value).toBe(false);
  });

  it('AR-07: повторная полная проверка поверх первой — первая cancelled, запрос её правила отменён', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    server.hold('checkInn');

    const first = bundle.validate();
    const second = bundle.validate();
    const [stale, fresh] = server.callsOf('checkInn').slice(-2);
    expect([stale.aborted, fresh.aborted]).toEqual([true, false]);
    fresh.resolve({ status: 'found' });

    expect(await first).toMatchObject({ status: 'cancelled', failures: [] });
    expect((await second).status).toBe('valid');
    expect(bundle.validating.value).toBe(false);
  });

  it('AR-08: переход назад во время проверки шага — next() остаётся там, куда перевели, с причиной cancelled', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle } = await atApplicantStep({ server });
    const flow = bundle.flow!;

    const next = flow.next();
    expect(flow.previous()).toEqual({ status: 'moved', from: 'applicant', to: 'loan' });
    server.last('checkInn').resolve({ status: 'found' });

    // Проверка прошла, но относится к прежнему положению потока: переход вперёд не случился.
    expect(await next).toMatchObject({
      status: 'stayed',
      step: 'loan',
      reason: 'cancelled',
      validation: { status: 'valid' },
    });
    expect(flow.current.value).toBe('loan');
    expect([...flow.completed.value]).toEqual([]);
  });

  it('AR-09: отправка поверх проверки шага её не отменяет — у ИНН два запроса с живыми сигналами, итог у каждого свой', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle } = await atApplicantStep({ server });
    const handler = vi.fn();

    const next = bundle.flow!.next();
    const submit = bundle.submit(handler);
    const [stepCheck, submitCheck] = server.callsOf('checkInn');

    // Отмена ключится парой «модель + схема»: у шага и у отправки схемы разные.
    expect([stepCheck.aborted, submitCheck.aborted]).toEqual([false, false]);
    stepCheck.resolve({ status: 'found' });
    submitCheck.resolve({ status: 'found' });

    expect(await next).toEqual({ status: 'moved', from: 'applicant', to: 'contacts' });
    // Отправка проверила все шаги: дальше заёмщика анкета пуста.
    expect(await submit).toMatchObject({ status: 'invalid' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('AR-10: поведение под вопросом [ReFormer-jefl]: поздний ответ проверки шага затирает замечание ИНН от отправки', async () => {
    // поведение под вопросом: замечания ноды не разделены по источнику, и прогоны разных схем
    // друг друга не отменяют — побеждает тот, кто ответил последним. Отправка, начатая позже по
    // свежему ИНН, получила «нет в реестре» и отказала, а поздний ответ проверки шага по прежнему
    // ИНН стёр это замечание: отказ отправки есть, а ошибки на экране нет.
    const server = createLoanServer({ manual: ['checkInn'] });
    const { bundle } = await atApplicantStep({ server });
    const { form, model } = bundle;

    const next = bundle.flow!.next();
    model.applicant.inn = OTHER_INN;
    const submit = bundle.submit(vi.fn());
    const [stepCheck, submitCheck] = server.callsOf('checkInn');
    expect([stepCheck.args[0], submitCheck.args[0]]).toEqual([VALID_INN, OTHER_INN]);

    submitCheck.resolve({ status: 'not-found' });
    expect((await submit).status).toBe('invalid');
    expect(issueCodes(form.applicant.inn)).toEqual(['applicant.inn.notFound']);

    stepCheck.resolve({ status: 'found' });
    await next;

    expect(form.applicant.inn.issues.value).toEqual([]);
  });
});

// ─── Строка удалена во время проверки ──────────────────────────────────────────────────────

describe('строка удалена, пока ждали её async-правило', () => {
  /** Сборка на шаге проверки заявки с двумя созаёмщиками и проверкой бюро в правилах сценария. */
  async function twoCoBorrowers(check: ControlledAsyncRule<string>): Promise<LoanForm> {
    const built = build({ extraRules: bureauCheck(check) });
    const { model } = built.bundle;
    await passWizardTo(built.bundle, 'review');
    model.coBorrowers.at(0).share = 50;
    addCoBorrower(model, { fullName: 'Петров Пётр Петрович' });
    await settle();
    return built;
  }

  it('AR-11: статус проверки совпадает с valid формы — замечание удалённой строки не учитывается', async () => {
    const check = controlledAsyncRule<string>();
    const { bundle } = await twoCoBorrowers(check);
    const { form, model } = bundle;
    // Шаги правила сценария не зовут: бюро спрашивает только полная проверка.
    expect(check.values).toEqual([]);

    const run = bundle.validate();
    expect(check.values).toEqual(['Иванова Мария Петровна', 'Петров Пётр Петрович']);
    expect([
      form.coBorrowers.pending.value,
      form.coBorrowers.at(1)!.fullName.pending.value,
    ]).toEqual([true, true]);

    model.coBorrowers.removeAt(1);
    check.answers[0].resolve(null);
    check.answers[1].resolve({ code: 'coBorrower.debtor' });
    const result = await run;

    expect(result.status).toBe('valid');
    expect(form.valid.value).toBe(true);
    expect(form.coBorrowers.length).toBe(1);
    expect(form.coBorrowers.issues.value).toEqual([]);
  });

  it('AR-12: поведение под вопросом: проверка ждёт ответа по удалённой строке, её запрос не отменён', async () => {
    // поведение под вопросом: удаление строки прогон не отменяет — он ждёт и её async-правило,
    // хотя его ответ уже ни на что не влияет. Запрос по удалённому созаёмщику продолжается (его
    // сигнал не сработал), а поле оставшейся строки держится в pending до этого ответа: медленный
    // ответ по строке, которой больше нет, задерживает проверку всей формы.
    const check = controlledAsyncRule<string>();
    const { bundle } = await twoCoBorrowers(check);
    const { form, model } = bundle;

    const run = bundle.validate();
    model.coBorrowers.removeAt(1);
    check.answers[0].resolve(null);
    await settle();

    expect(check.signals.map((signal) => signal.aborted)).toEqual([false, false]);
    expect(form.coBorrowers.at(0)!.fullName.pending.value).toBe(true);
    expect(bundle.validating.value).toBe(true);

    check.answers[1].resolve(null);
    await run;
    expect([form.coBorrowers.at(0)!.fullName.pending.value, bundle.validating.value]).toEqual([
      false,
      false,
    ]);
  });
});

// ─── Поиск городов: onChange с debounce и signal ───────────────────────────────────────────

describe('поиск городов — onChange с debounce и signal', () => {
  it('AR-13: правка региона во время запроса сразу отменяет прежний запрос [ReFormer-y66c]', async () => {
    useFakeClock();
    const server = createLoanServer({ manual: ['loadCities'] });
    const { bundle } = build({ server });
    const { model } = bundle;
    await flushBehaviors();
    model.sameAsRegistration = false;
    await flushBehaviors();
    model.registrationAddress.region = 'Москва';
    await advance(CITY_LOOKUP_DEBOUNCE);
    const stale = server.last('loadCities');

    // Регион сменили, пока сервер отвечал про прежний. Док `onChange`: «при следующей смене
    // значения предыдущий signal аннулируется». Было: с `debounce` сигнал гас только через
    // задержку — ответ про Москву, пришедший в эти 300 мс, ложился в список городов Петербурга.
    model.registrationAddress.region = 'Санкт-Петербург';
    await flushBehaviors();

    expect(stale.aborted).toBe(true);
  });

  it('AR-14: снятие формы во время задержки — запрос не уходит, таймеров не остаётся', async () => {
    useFakeClock();
    const server = createLoanServer();
    const { bundle } = build({ server });
    const { model } = bundle;
    await flushBehaviors();
    model.sameAsRegistration = false;
    await flushBehaviors();

    model.registrationAddress.region = 'Москва';
    await advance(CITY_LOOKUP_DEBOUNCE - 100);
    expect(vi.getTimerCount()).toBe(1);
    disposeForm(bundle.form);

    expect(vi.getTimerCount()).toBe(0);
    await advance(CITY_LOOKUP_DEBOUNCE);
    expect(server.callsOf('loadCities')).toEqual([]);
  });
});

// ─── Утилиты субстрата в реакциях приложения ──────────────────────────────────────────────

describe('runOutsideEffect, safeCallback, safeDebouncedCallback — реакции приложения', () => {
  it('AR-15: safeCallback — подсказка в пропсы поля из своего эффекта: запись на микротаске, чтения колбэка не подписывают', async () => {
    const { bundle } = build();
    await settle();
    const { model, form } = bundle;
    const runs = vi.fn();
    // Подсказка под суммой — реакция приложения, а не поведение формы: эффект следит за суммой,
    // а срок колбэк лишь читает.
    const showHint = safeCallback((amount: number | null) => {
      form.loan.amount.updateComponentProps({ hint: `${amount} ₽ на ${model.loan.term} мес.` });
    });
    reactions.push(
      effect(() => {
        runs();
        showHint(model.$.loan.amount.value);
      })
    );
    model.loan.term = 24;

    model.loan.amount = 300_000;
    expect(form.loan.amount.componentProps.value.hint).toBeUndefined();
    await settle();
    expect(form.loan.amount.componentProps.value.hint).toBe('300000 ₽ на 24 мес.');

    model.loan.term = 36;
    await settle();
    expect(runs).toHaveBeenCalledTimes(2);
    expect(form.loan.amount.componentProps.value.hint).toBe('300000 ₽ на 24 мес.');
  });

  it('AR-16: safeDebouncedCallback — черновик сохраняется после паузы в правках; сбой сохранения — в dev-лог', async () => {
    useFakeClock();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { bundle, server } = build();
    await flushBehaviors();
    const { model } = bundle;
    server.hold('saveDraft');
    const pause = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const afterPause = (save: () => void): void => {
      clearTimeout(timer);
      timer = setTimeout(save, pause);
    };
    const saveDraft = safeDebouncedCallback(() => server.api.saveDraft(model.get()), afterPause);
    let initial = true;
    reactions.push(
      effect(() => {
        // Любая правка заявки — те же ручки, на которые подписывается живая проверка.
        eachValueSignal(model, (handle) => void handle.value);
        if (initial) {
          initial = false;
          return;
        }
        saveDraft();
      }),
      () => clearTimeout(timer)
    );

    model.loan.purpose = 'Ремонт';
    await advance(pause / 2);
    model.loan.purpose = 'Ремонт квартиры';
    await advance(pause);
    expect(server.callsOf('saveDraft').map((call) => call.args[0].loan.purpose)).toEqual([
      'Ремонт квартиры',
    ]);

    server.last('saveDraft').reject(new Error('503 Service Unavailable'));
    await flushBehaviors();
    expect(error).toHaveBeenCalledWith(
      '[safeDebouncedCallback]',
      expect.objectContaining({ message: '503 Service Unavailable' })
    );

    model.loan.term = 24;
    await advance(pause);
    expect(server.callsOf('saveDraft')).toHaveLength(2);
  });

  it('AR-17: runOutsideEffect — отложенная запись проходит через поведение формы, отменитель снимает её в том же тике', async () => {
    const { bundle } = build();
    await settle();
    const { model } = bundle;
    const cancellers: Array<() => void> = [];
    // Ипотеке — долгий срок: реакция приложения пишет срок вне своего эффекта.
    const stop = effect(() => {
      if (model.$.loan.type.value !== 'mortgage') return;
      cancellers.push(
        runOutsideEffect(() => {
          model.loan.term = 240;
        })
      );
    });
    reactions.push(stop);

    model.loan.type = 'mortgage';
    expect(model.loan.term).toBeNull();
    await settle();
    expect(model.loan.term).toBe(240);
    // Запись прошла через поведение заявки: ставка длинного кредита — на процент выше базовой.
    expect(model.loan.interestRate).toBe(10.9);

    model.loan.type = 'car';
    model.loan.term = 60;
    model.loan.type = 'mortgage';
    // Реакцию снимают в том же тике (уход со страницы) вместе с ожидающей записью — и запись
    // не случается.
    stop();
    for (const cancel of cancellers.splice(0)) cancel();
    await settle();

    expect(model.loan.term).toBe(60);
  });
});
