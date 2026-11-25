/**
 * Сценарии кредитной заявки: одинаковое видимое поведение всех реализаций
 * (docs/specs/credit-application-form.md + BENCH-CONTRACT §3, §8).
 *
 * Тела сценариев — функцией, а не спеком: их исполняют и conformance бенчмарка (по разу на каждую
 * библиотеку форм), и кросс-фреймворк проверка (по разу на каждый стек: React, Vue, Angular).
 * Сценарий знает только DOM-контракт и `window.__bench`; какую страницу открыть и каким драйвером
 * вести контролы без нативного элемента, говорит `open`.
 *
 * Тексты — из `shared/messages/credit.ts`, канонический payload — `toCreditPayload` из
 * `shared/domain/credit.ts`; вычисляемые значения записаны числами (посчитаны по формулам спеки
 * с часами бенча 2026-06-15), чтобы ошибка общей формулы тоже была видна.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CONSUMER, CreditPage, MORTGAGE, SMS_VALID_CODE } from '../pom/credit';
import {
  CREDIT_SUBMIT_MESSAGE,
  msg,
  type CreditMessageKey,
} from '../../forms-benchmark/src/shared/messages/credit';
import { CREDIT_APPLICATION_1 } from '../../forms-benchmark/src/shared/api/credit-fixtures';
import {
  CREDIT_INITIAL_INPUT,
  computeInterestRate,
  computeMonthlyPayment,
  computePaymentToIncomeRatio,
  toCreditPayload,
  toDomPath,
  toFieldPattern,
  type CreditInput,
} from '../../forms-benchmark/src/shared/domain/credit';

/** Ожидаемые ошибки: путь поля → правило; ключ текста — `<шаблон пути>.<правило>`. */
function errorsOf(rules: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, rule] of Object.entries(rules)) {
    out[toDomPath(path)] = msg(`${toFieldPattern(path)}.${rule}` as CreditMessageKey);
  }
  return out;
}

const required = (...paths: string[]) =>
  errorsOf(Object.fromEntries(paths.map((p) => [p, 'required'])));

const EMPLOYER = ['companyName', 'companyInn', 'companyPhone', 'companyAddress', 'position'];
const BUSINESS = ['businessType', 'businessInn', 'businessActivity'];
const CAR = ['carBrand', 'carModel', 'carYear', 'carPrice'];
const ADDRESS = ['region', 'city', 'street', 'house', 'apartment', 'postalCode'];

const withPersonal = (
  v: CreditInput,
  patch: Partial<CreditInput['personalData']>
): CreditInput => ({
  ...v,
  personalData: { ...v.personalData, ...patch },
});

/**
 * Объявить сценарии кредитной заявки для одной страницы.
 *
 * @param title - Заголовок группы тестов: участник бенчмарка или стек.
 * @param open - POM страницы для теста; `testInfo` — чтобы выбрать страницу и драйвер контролов
 *   по проекту Playwright.
 */
export function creditScenarios(
  title: string,
  open: (page: Page, testInfo: TestInfo) => CreditPage
): void {
  test.describe(title, () => {
    let form: CreditPage;

    test.beforeEach(async ({ page }, testInfo) => {
      form = open(page, testInfo);
    });

    test('исходное состояние: шаг 1, начальные значения, справочники загружены один раз', async () => {
      await form.goto();
      await form.expectStep(1, CREDIT_INITIAL_INPUT);
      await expect(form.computed('initialPayment')).toHaveCount(0);
      await expect(form.computed('interestRate')).toHaveText('15.5');
      await expect(form.computed('monthlyPayment')).toHaveText('0');
      await form.expectNoPrevious();
      await expect(form.nextButton).toBeVisible();
      await expect(form.submitButton).toHaveCount(0);
      expect(await form.errors()).toEqual({});
      expect(await form.calls()).toEqual({ dictionaries: 1, regions: 1 });
    });

    test('«Далее» на пустом шаге 1: ошибки первых правил, шаг не меняется', async () => {
      await form.goto();
      await form.next();
      await form.expectAtStep(1);
      expect(await form.errors()).toEqual(required('loanAmount', 'loanPurpose'));
    });

    test('тихая фаза до первого «Далее» на каждом шаге, затем живая перепроверка', async () => {
      await form.goto();
      await form.type('loanAmount', '100');
      await form.type('loanPurpose', 'short');
      await form.blur();
      await form.idle();
      expect(await form.errors()).toEqual({});

      await form.next();
      expect(await form.errors()).toEqual(
        errorsOf({ loanAmount: 'min', loanPurpose: 'minLength' })
      );
      await form.type('loanAmount', '20000000', { clear: true });
      await form.idle();
      await expect(form.error('loanAmount')).toHaveText(msg('loanAmount.max'));
      await form.type('loanAmount', '500000', { clear: true });
      await form.type('loanPurpose', 'Home renovation', { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual({});
      await form.next();
      await form.expectAtStep(2);

      // Шаг 2 снова тихий, хотя на шаге 1 «Далее» уже нажимали.
      await form.set('personalData.birthDate', '2015-01-01');
      await form.type('passportData.series', '12');
      await form.blur();
      await form.idle();
      expect(await form.errors()).toEqual({});
      await form.next();
      await expect(form.error('personalData.birthDate')).toHaveText(
        msg('personalData.birthDate.minAge')
      );
      await expect(form.error('passportData.series')).toHaveText(
        msg('passportData.series.pattern')
      );
    });

    test('пустые шаги 2–6: «Далее» и «Отправить» показывают ошибки первых правил', async () => {
      await form.goto();
      await form.goToStep(2, CONSUMER);

      await form.next();
      await form.expectAtStep(2);
      expect(await form.errors()).toEqual(
        required(
          'personalData.lastName',
          'personalData.firstName',
          'personalData.middleName',
          'personalData.birthDate',
          'personalData.birthPlace',
          'passportData.series',
          'passportData.number',
          'passportData.issueDate',
          'passportData.issuedBy',
          'passportData.departmentCode',
          'inn',
          'snils'
        )
      );
      await form.fillStep(2, CONSUMER);
      await form.next();

      await form.next();
      await form.expectAtStep(3);
      expect(await form.errors()).toEqual(
        required(
          'phoneMain',
          'email',
          ...['region', 'city', 'street', 'house', 'postalCode'].map(
            (f) => `registrationAddress.${f}`
          )
        )
      );
      await form.fillStep(3, CONSUMER);
      await form.next();

      await form.next();
      await form.expectAtStep(4);
      expect(await form.errors()).toEqual(
        required(...EMPLOYER, 'workExperienceTotal', 'workExperienceCurrent', 'monthlyIncome')
      );
      await form.fillStep(4, CONSUMER);
      await form.next();

      // Шаг 5 по умолчанию валиден.
      await form.expectAtStep(5);
      await form.next();
      await form.expectAtStep(6);
      expect(await form.errors()).toEqual({});

      await form.submit();
      expect(await form.errors()).toEqual(
        required(
          'agreePersonalData',
          'agreeCreditHistory',
          'agreeTerms',
          'confirmAccuracy',
          'electronicSignature'
        )
      );
      expect(await form.submissions()).toHaveLength(0);
      await expect(form.result).toHaveCount(0);
    });

    test('поле, появившееся после неудачного «Далее», молчит до изменения или следующего «Далее»', async () => {
      // BENCH-CONTRACT §8: условие стало истинным уже в живой фазе шага.
      await form.goto();
      await form.next();
      expect(await form.errors()).toEqual(required('loanAmount', 'loanPurpose'));
      await form.set('loanType', 'mortgage');
      await form.idle();
      await expect(form.field('propertyValue')).toHaveCount(1);
      await expect(form.error('propertyValue')).toHaveCount(0);
      await form.type('propertyValue', '1');
      await form.idle();
      await expect(form.error('propertyValue')).toHaveText(msg('propertyValue.min'));
      await form.set('loanType', 'car');
      await form.idle();
      for (const f of CAR) await expect(form.error(f)).toHaveCount(0);
      await form.next();
      await form.expectAtStep(1);
      for (const f of ['carBrand', 'carModel', 'carYear', 'carPrice']) {
        await expect(form.error(f)).toHaveCount(1);
      }
    });

    test('тип кредита: секции ипотеки и автокредита, сброс скрытых полей, базовая ставка', async () => {
      await form.goto();
      const rates = {
        consumer: '15.5',
        mortgage: '8.5',
        car: '12',
        business: '18',
        refinancing: '14',
      };
      for (const [loanType, rate] of Object.entries(rates)) {
        await form.set('loanType', loanType);
        await expect(form.computed('interestRate')).toHaveText(rate);
      }

      await form.set('loanType', 'mortgage');
      await expect(form.input('propertyValue')).toHaveValue('');
      await expect(form.computed('initialPayment')).toHaveText('');
      for (const f of CAR) await expect(form.field(f)).toHaveCount(0);
      await form.type('propertyValue', '5000000');
      await expect(form.computed('initialPayment')).toHaveText('1000000');

      await form.set('loanType', 'car');
      await expect(form.field('propertyValue')).toHaveCount(0);
      await expect(form.computed('initialPayment')).toHaveCount(0);
      for (const f of CAR) await form.expectValue(f, '');
      await form.type('carBrand', 'Kia');
      await form.type('carYear', '2020');

      await form.set('loanType', 'mortgage');
      await expect(form.input('propertyValue')).toHaveValue('');
      await expect(form.computed('initialPayment')).toHaveText('');
      await form.set('loanType', 'car');
      await expect(form.input('carBrand')).toHaveValue('');
      await expect(form.input('carYear')).toHaveValue('');
    });

    test('автокредит: модели по марке (debounce в клиенте), сброс модели, платёж, год ≤ 2027', async () => {
      await form.goto();
      await form.set('loanType', 'car');
      await form.type('carBrand', 'Toyota');
      await form.idle();
      expect((await form.calls())['car-models']).toBe(1);
      expect(await form.options('carModel')).toEqual([
        '',
        'camry',
        'corolla',
        'rav4',
        'land_cruiser',
      ]);
      await form.set('carModel', 'camry');

      await form.type('carBrand', 'BMW', { clear: true });
      await form.expectValue('carModel', '');
      await form.idle();
      expect((await form.calls())['car-models']).toBe(2);
      expect(await form.options('carModel')).toEqual(['', '3_series', '5_series', 'x5']);
      await form.set('carModel', 'x5');

      await form.type('loanAmount', '1500000');
      await form.type('loanTerm', '36', { clear: true });
      await form.type('loanPurpose', 'Buying a family car');
      await form.type('carYear', '2028');
      await form.type('carPrice', '2000000');
      await expect(form.computed('interestRate')).toHaveText('12');
      await expect(form.computed('monthlyPayment')).toHaveText('49821');
      await form.next();
      await form.expectAtStep(1);
      expect(await form.errors()).toEqual(errorsOf({ carYear: 'max' }));
      await form.type('carYear', '2027', { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual({});
      await form.next();
      await form.expectAtStep(2);
    });

    test('ипотека: взнос — 20 % вверх до рубля, сумма ≤ стоимость − взнос, перепроверка при смене стоимости', async () => {
      await form.goto();
      await form.set('loanType', 'mortgage');
      await form.type('propertyValue', '1000002');
      await expect(form.computed('initialPayment')).toHaveText('200001');
      await form.type('loanAmount', '800002');
      await form.type('loanPurpose', 'Apartment purchase');
      await form.next();
      await form.expectAtStep(1);
      expect(await form.errors()).toEqual(errorsOf({ loanAmount: 'maxMortgage' }));
      await form.type('loanAmount', '800001', { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual({});

      await form.type('loanAmount', '4500000', { clear: true });
      await form.type('propertyValue', '5000000', { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual(errorsOf({ loanAmount: 'maxMortgage' }));
      await form.type('propertyValue', '6000000', { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual({});
      await form.next();
      await form.expectAtStep(2);
    });

    test('возраст 18–70: правило даты рождения', async () => {
      await form.goto();
      await form.goToStep(2, CONSUMER);
      await form.fillStep(2, withPersonal(CONSUMER, { birthDate: '2010-01-01' }));
      await form.next();
      await form.expectAtStep(2);
      expect(await form.errors()).toEqual(errorsOf({ 'personalData.birthDate': 'minAge' }));
      await form.set('personalData.birthDate', '1955-06-15');
      await form.idle();
      await expect(form.computed('age')).toHaveText('71');
      expect(await form.errors()).toEqual(errorsOf({ 'personalData.birthDate': 'maxAge' }));
      await form.set('personalData.birthDate', '1956-06-15');
      await form.idle();
      await expect(form.computed('age')).toHaveText('70');
      expect(await form.errors()).toEqual({});
      await form.next();
      await form.expectAtStep(3);
    });

    test('контакты: города по региону (кэш клиента), сброс города, адрес проживания, копия email', async () => {
      await form.goto();
      await form.goToStep(3, CONSUMER);

      await form.set('registrationAddress.region', 'moscow');
      await form.idle();
      expect((await form.calls()).cities).toBe(1);
      expect(await form.options('registrationAddress.city')).toEqual([
        '',
        'moscow',
        'zelenograd',
        'troitsk',
      ]);
      await form.set('registrationAddress.city', 'zelenograd');
      await form.set('registrationAddress.region', 'spb');
      await form.expectValue('registrationAddress.city', '');
      await form.idle();
      expect((await form.calls()).cities).toBe(2);
      expect(await form.options('registrationAddress.city')).toEqual([
        '',
        'spb',
        'kolpino',
        'pushkin',
      ]);
      await form.set('registrationAddress.region', 'moscow');
      await form.idle();
      expect((await form.calls()).cities).toBe(2);

      await expect(form.input('sameAsRegistration')).toBeChecked();
      for (const f of ADDRESS) await expect(form.field(`residenceAddress.${f}`)).toHaveCount(0);
      await form.set('sameAsRegistration', false);
      for (const f of ADDRESS) await form.expectValue(`residenceAddress.${f}`, '');
      await form.type('residenceAddress.street', 'Lenina street');
      await form.set('sameAsRegistration', true);
      await expect(form.field('residenceAddress.street')).toHaveCount(0);
      await form.set('sameAsRegistration', false);
      await expect(form.input('residenceAddress.street')).toHaveValue('');

      await form.type('email', 'ivan@example.com');
      await form.set('sameEmail', true);
      await expect(form.input('emailAdditional')).toHaveValue('ivan@example.com');
      await expect(form.input('emailAdditional')).not.toBeEditable();
      await form.type('email', 'ivan.petrov@example.com', { clear: true });
      await expect(form.input('emailAdditional')).toHaveValue('ivan.petrov@example.com');
      await form.set('sameEmail', false);
      await expect(form.input('emailAdditional')).toHaveValue('');
      await expect(form.input('emailAdditional')).toBeEditable();
    });

    test('занятость: секции «по найму» и «ИП», сброс скрытых полей', async () => {
      await form.goto();
      await form.goToStep(4, CONSUMER);
      await expect(form.radio('employmentStatus', 'employed')).toBeChecked();
      for (const f of EMPLOYER) await expect(form.input(f)).toHaveValue('');
      for (const f of BUSINESS) await expect(form.field(f)).toHaveCount(0);
      await form.type('companyName', 'Acme');

      await form.set('employmentStatus', 'selfEmployed');
      for (const f of EMPLOYER) await expect(form.field(f)).toHaveCount(0);
      for (const f of BUSINESS) await expect(form.input(f)).toHaveValue('');
      await form.type('businessType', 'IP');

      await form.set('employmentStatus', 'unemployed');
      for (const f of [...EMPLOYER, ...BUSINESS]) await expect(form.field(f)).toHaveCount(0);
      await expect(form.input('monthlyIncome')).toBeVisible();

      await form.set('employmentStatus', 'employed');
      await expect(form.input('companyName')).toHaveValue('');
      await form.set('employmentStatus', 'selfEmployed');
      await expect(form.input('businessType')).toHaveValue('');
    });

    test('стаж на текущем месте ≤ общего, перепроверка при смене общего', async () => {
      await form.goto();
      await form.goToStep(4, CONSUMER);
      await form.fillStep(4, { ...CONSUMER, workExperienceTotal: 12, workExperienceCurrent: 24 });
      await form.next();
      await form.expectAtStep(4);
      expect(await form.errors()).toEqual(errorsOf({ workExperienceCurrent: 'maxTotal' }));
      await form.type('workExperienceTotal', '36', { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual({});
      await form.next();
      await form.expectAtStep(5);
    });

    test('платёж ≤ 50 % дохода: правило дохода, перепроверка при смене доп. дохода', async () => {
      const big: CreditInput = {
        ...CONSUMER,
        loanAmount: 1000000,
        loanTerm: 12,
        monthlyIncome: 100000,
      };
      await form.goto();
      await form.goToStep(4, big);
      await form.fillStep(4, big);
      await expect(form.computed('totalIncome')).toHaveText('100000');
      await expect(form.computed('paymentToIncomeRatio')).toHaveText('90');
      await form.next();
      await form.expectAtStep(4);
      expect(await form.errors()).toEqual(errorsOf({ monthlyIncome: 'paymentRatio' }));

      await form.type('additionalIncome', '100000');
      await form.idle();
      await expect(form.computed('totalIncome')).toHaveText('200000');
      await expect(form.computed('paymentToIncomeRatio')).toHaveText('45');
      // Доп. доход > 0 делает источник обязательным; доля в норме.
      expect(await form.errors()).toEqual(errorsOf({ additionalIncomeSource: 'required' }));
      await form.type('additionalIncomeSource', 'Rent');
      await form.idle();
      expect(await form.errors()).toEqual({});
      await form.next();
      await form.expectAtStep(5);
    });

    test('вычисляемые: ФИО, возраст, доход, доля платежа, доход созаемщиков, ставка за имущество', async () => {
      await form.goto();
      await form.fillStep(1, CONSUMER);
      await expect(form.computed('monthlyPayment')).toHaveText('24362');
      await form.next();

      await expect(form.computed('fullName')).toHaveText('');
      await expect(form.computed('age')).toHaveText('');
      await form.type('personalData.lastName', 'Ivanov');
      await expect(form.computed('fullName')).toHaveText('Ivanov');
      await form.type('personalData.firstName', 'Ivan');
      await form.type('personalData.middleName', 'Petrovich');
      await expect(form.computed('fullName')).toHaveText('Ivanov Ivan Petrovich');
      await form.set('personalData.birthDate', '2008-06-16');
      await expect(form.computed('age')).toHaveText('17');
      await form.set('personalData.birthDate', '2008-06-15');
      await expect(form.computed('age')).toHaveText('18');
      await form.fillStep(2, CONSUMER);
      await expect(form.computed('age')).toHaveText('36');
      await form.next();
      await form.fillStep(3, CONSUMER);
      await form.next();

      await expect(form.computed('totalIncome')).toHaveText('0');
      await expect(form.computed('paymentToIncomeRatio')).toHaveText('0');
      await form.fillStep(4, CONSUMER);
      await expect(form.computed('totalIncome')).toHaveText('150000');
      await expect(form.computed('paymentToIncomeRatio')).toHaveText('16');
      await form.type('additionalIncome', '50000');
      await expect(form.computed('totalIncome')).toHaveText('200000');
      await expect(form.computed('paymentToIncomeRatio')).toHaveText('12');
      await form.type('additionalIncomeSource', 'Rent');
      await form.next();
      await form.expectAtStep(5);

      await expect(form.computed('coBorrowersIncome')).toHaveCount(0);
      await form.set('hasCoBorrower', true);
      await expect(form.computed('coBorrowersIncome')).toHaveText('0');
      await form.type('coBorrowers.0.monthlyIncome', '30000', { clear: true });
      await expect(form.computed('coBorrowersIncome')).toHaveText('30000');
      await form.add('coBorrowers');
      await form.type('coBorrowers.1.monthlyIncome', '45000', { clear: true });
      await expect(form.computed('coBorrowersIncome')).toHaveText('75000');
      await form.remove('coBorrowers', 0);
      await expect(form.computed('coBorrowersIncome')).toHaveText('45000');

      // Имущество (флаг и строка) снижает ставку на 0.5 — видно на шаге 1.
      await form.set('hasProperty', true);
      for (let s = 5; s > 1; s--) await form.prev();
      await form.expectAtStep(1);
      await expect(form.computed('interestRate')).toHaveText('15');
      await expect(form.computed('monthlyPayment')).toHaveText('24243');
    });

    test('массивы: флаг добавляет одну пустую строку, добавление и удаление, выключение очищает', async () => {
      await form.goto();
      await form.goToStep(5, CONSUMER);
      for (const a of ['properties', 'existingLoans', 'coBorrowers'] as const) {
        await expect(form.rows(a)).toHaveCount(0);
        await expect(form.addButton(a)).toHaveCount(0);
      }

      await form.set('hasProperty', true);
      await expect(form.rows('properties')).toHaveCount(1);
      await form.expectValue('properties.0.type', 'apartment');
      await form.expectValue('properties.0.description', '');
      await form.expectValue('properties.0.estimatedValue', 0);
      await form.expectValue('properties.0.hasEncumbrance', false);
      await form.type('properties.0.description', 'First item');
      await form.add('properties');
      await expect(form.rows('properties')).toHaveCount(2);
      await form.expectValue('properties.1.description', '');
      await form.type('properties.1.description', 'Second item');
      await form.set('properties.1.type', 'land');
      await form.remove('properties', 0);
      await expect(form.rows('properties')).toHaveCount(1);
      await form.expectValue('properties.0.description', 'Second item');
      await form.expectValue('properties.0.type', 'land');
      await form.set('hasProperty', false);
      await expect(form.rows('properties')).toHaveCount(0);
      await form.set('hasProperty', true);
      await expect(form.rows('properties')).toHaveCount(1);
      await form.expectValue('properties.0.description', '');
      await form.expectValue('properties.0.type', 'apartment');

      await form.set('hasExistingLoans', true);
      await expect(form.rows('existingLoans')).toHaveCount(1);
      for (const [f, v] of Object.entries({
        bank: '',
        type: '',
        amount: 0,
        remainingAmount: 0,
        monthlyPayment: 0,
        maturityDate: '',
      })) {
        await form.expectValue(`existingLoans.0.${f}`, v);
      }
      await form.set('hasCoBorrower', true);
      await expect(form.rows('coBorrowers')).toHaveCount(1);
      await form.expectValue('coBorrowers.0.personalData.lastName', '');
      await form.expectValue('coBorrowers.0.monthlyIncome', 0);
      await form.set('hasExistingLoans', false);
      await form.set('hasCoBorrower', false);
      await expect(form.rows('existingLoans')).toHaveCount(0);
      await expect(form.rows('coBorrowers')).toHaveCount(0);
    });

    test('кредиты: остаток ≤ суммы в строке, перепроверка при смене суммы', async () => {
      await form.goto();
      await form.goToStep(5, CONSUMER);
      await form.set('hasExistingLoans', true);
      await form.type('existingLoans.0.bank', 'Sberbank');
      await form.type('existingLoans.0.type', 'Consumer');
      await form.type('existingLoans.0.amount', '100000', { clear: true });
      await form.type('existingLoans.0.remainingAmount', '200000', { clear: true });
      await form.set('existingLoans.0.maturityDate', '2028-12-31');
      await form.next();
      await form.expectAtStep(5);
      expect(await form.errors()).toEqual(
        errorsOf({ 'existingLoans.0.remainingAmount': 'maxAmount' })
      );
      await form.type('existingLoans.0.amount', '300000', { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual({});
      await form.next();
      await form.expectAtStep(6);
    });

    test('значения шагов сохраняются при «Назад»/«Далее» (ипотека в Москве: ставка +0.5)', async () => {
      await form.goto();
      await form.goToStep(4, MORTGAGE);
      for (let s = 4; s > 1; s--) await form.prev();
      await form.expectStep(1, MORTGAGE);
      await expect(form.computed('initialPayment')).toHaveText('1200000');
      await expect(form.computed('interestRate')).toHaveText('9');
      await expect(form.computed('monthlyPayment')).toHaveText('35989');
      await form.next();
      await form.expectStep(2, MORTGAGE);
      await expect(form.computed('fullName')).toHaveText('Smirnova Anna Sergeevna');
      await expect(form.computed('age')).toHaveText('37');
      await form.next();
      await form.expectStep(3, MORTGAGE);
      // Москва (регистрация) и Казань (проживание); возвраты на шаг кэш не обходят.
      expect((await form.calls()).cities).toBe(2);
      await form.next();
      await form.expectAtStep(4);
      expect(await form.errors()).toEqual({});
    });

    test('код из СМС: проверка на «сервере» только после синхронных правил', async () => {
      await form.goto();
      await form.goToStep(6, CONSUMER);
      await form.fillStep(6, { ...CONSUMER, electronicSignature: '' });
      await form.type('electronicSignature', '11111');
      await form.blur();
      await form.idle();
      expect(await form.errors()).toEqual({});

      await form.submit();
      expect(await form.errors()).toEqual(errorsOf({ electronicSignature: 'pattern' }));
      expect((await form.calls())['sms-verify'] ?? 0).toBe(0);

      await form.type('electronicSignature', '111111', { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual(errorsOf({ electronicSignature: 'invalid' }));
      expect((await form.calls())['sms-verify']).toBe(1);
      await form.submit();
      expect(await form.submissions()).toHaveLength(0);

      await form.type('electronicSignature', SMS_VALID_CODE, { clear: true });
      await form.idle();
      expect(await form.errors()).toEqual({});
      expect((await form.calls())['sms-verify']).toBe(2);
      await form.submit();
      expect(await form.submissions()).toHaveLength(1);
      await expect(form.result).toContainText(CREDIT_SUBMIT_MESSAGE);
    });

    for (const [name, data, literals] of [
      [
        'потребительский',
        CONSUMER,
        {
          interestRate: 15.5,
          monthlyPayment: 24362,
          initialPayment: null,
          paymentToIncomeRatio: 16,
          residenceAddress: CONSUMER.registrationAddress,
        },
      ],
      [
        'ипотека',
        MORTGAGE,
        {
          interestRate: 8.5,
          monthlyPayment: 34713,
          initialPayment: 1200000,
          totalIncome: 220000,
          paymentToIncomeRatio: 16,
          coBorrowersIncome: 125000,
          fullName: 'Smirnova Anna Sergeevna',
          age: 37,
          emailAdditional: MORTGAGE.email,
        },
      ],
    ] as const) {
      test(`успешная отправка (${name}): ровно одна заявка, канонический payload`, async () => {
        await form.goto();
        await form.goToStep(6, data);
        await form.fillStep(6, data);
        await form.submit();
        await expect(form.result).toContainText(CREDIT_SUBMIT_MESSAGE);
        expect(await form.errors()).toEqual({});
        const submissions = await form.submissions();
        expect(submissions).toEqual([toCreditPayload(data)]);
        expect(submissions[0]).toMatchObject(literals);
        expect((await form.calls())['submit-application']).toBe(1);
        // Значения остаются на экране.
        await form.expectValue('electronicSignature', SMS_VALID_CODE);
      });
    }

    test('«Отправить» проверяет все шаги: устаревшее правило шага 4 → переход на шаг 4', async () => {
      // BENCH-CONTRACT §8 «Отправка». Доля платежа (шаг 4) зависит от ставки, а ставка — от
      // имущества (шаг 5, скидка 0.5 п.п.). Шаг 4 проходит при отмеченном имуществе, потом имущество
      // снимают на шаге 5: «Далее» шага 5 правило шага 4 не перепроверяет, отправка обязана.
      const data = MORTGAGE;
      const rate = (withProperty: boolean) =>
        computeInterestRate(data.loanType, data.registrationAddress.region, withProperty, 1);
      const payWith = computeMonthlyPayment(data.loanAmount, data.loanTerm, rate(true));
      const payWithout = computeMonthlyPayment(data.loanAmount, data.loanTerm, rate(false));
      let total = Math.ceil(payWith / 0.505);
      while (computePaymentToIncomeRatio(payWith, total) > 50) total++;
      expect(computePaymentToIncomeRatio(payWithout, total)).toBeGreaterThan(50);
      const monthlyIncome = total - (data.additionalIncome ?? 0);

      await form.goto();
      await form.goToStep(4, data);
      await form.fillStep(4, data);
      await form.next();
      await form.expectAtStep(5);
      await form.fillStep(5, data);
      await form.prev();
      await form.expectAtStep(4);
      await form.set('monthlyIncome', monthlyIncome);
      await form.idle();
      await expect(form.error('monthlyIncome')).toHaveCount(0);
      await form.next();
      await form.expectAtStep(5);
      await form.set('hasProperty', false);
      await form.idle();
      await form.next();
      await form.expectAtStep(6);
      await form.fillStep(6, data);
      await form.submit();
      await form.idle();
      await form.expectAtStep(4);
      await expect(form.error('monthlyIncome')).toHaveText(msg('monthlyIncome.paymentRatio'));
      expect(await form.submissions()).toHaveLength(0);
    });

    test('?application=1: данные заявки — исходное состояние всех шагов', async () => {
      const app = CREDIT_APPLICATION_1;
      await form.goto({ application: '1' });
      await form.expectStep(1, app);
      await expect(form.computed('interestRate')).toHaveText('15.5');
      await expect(form.computed('monthlyPayment')).toHaveText('24362');
      const calls = await form.calls();
      expect([calls.application, calls.dictionaries, calls.regions]).toEqual([1, 1, 1]);
      expect(calls['submit-application']).toBeUndefined();

      await form.next();
      await form.expectStep(2, app);
      await expect(form.computed('fullName')).toHaveText('Иванов Иван Иванович');
      await expect(form.computed('age')).toHaveText('41');
      await form.next();
      await form.expectStep(3, app);
      expect((await form.calls()).cities).toBe(1);
      await form.next();
      await form.expectStep(4, app);
      await expect(form.computed('totalIncome')).toHaveText('150000');
      await expect(form.computed('paymentToIncomeRatio')).toHaveText('16');
      await form.next();
      await form.expectStep(5, app);
      await form.next();
      await form.expectStep(6, app);
      expect(await form.errors()).toEqual({});
    });
  });
}
