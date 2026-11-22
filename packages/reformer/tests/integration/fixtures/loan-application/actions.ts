/**
 * Помощники сценариев заявки: заполнить шаг данными, которые проходят все правила, добавить
 * созаёмщика, пройти визард до нужного шага.
 *
 * Помощники пишут значения в модель — как это делает пользователь через поля — и не зависят от
 * часов: отложенные записи поведения (`defer`, `runOutsideEffect`) идут на микротасках, их
 * дожидается {@link flushBehaviors}; задержки `onChange` (города региона) сценарий ждёт сам.
 * Даты считаются от «сегодня» в момент вызова, поэтому подходят и для фейковых часов.
 */

import type { DeepPartial, FlowTransition, FormBundle, FormModel } from '../../../../src/index';
import { flushMicrotasks } from '../../../test-utils/async';
import { LOAN_STEP_IDS, type LoanStepId } from './flow';
import type { Applicant, CoBorrower, Employment, LoanApplication, LoanTerms } from './model';

/** ИНН, который проходит и формат, и проверку сервера (заглушка его «находит»). */
export const VALID_INN = '500100732259';

/** Дата `YYYY-MM-DD` по местному времени — в таком виде её отдаёт поле даты. */
function isoDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Дата `years` лет назад. */
export function yearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return isoDate(date);
}

/** Дата через `days` дней. */
export function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/** Документ заданного размера. */
export function documentFile(name: string, size: number, type = 'application/pdf'): File {
  return new File([new Uint8Array(size)], name, { type });
}

/** Дождаться отложенных записей поведения: копий, синхронизаций, преобразований, сбросов. */
export async function flushBehaviors(): Promise<void> {
  await flushMicrotasks(10);
}

/** Шаг «Кредит»: потребительский кредит, платёж далеко от предела нагрузки. */
export function fillLoanStep(
  model: FormModel<LoanApplication>,
  overrides: DeepPartial<LoanTerms> = {}
): void {
  model.loan.patch({
    type: 'consumer',
    amount: 500_000,
    term: 36,
    purpose: 'Ремонт квартиры',
    firstPaymentDate: daysFromToday(30),
    promoCode: 'SPRING24',
    ...overrides,
  });
}

/** Шаг «Заёмщик». */
export function fillApplicantStep(
  model: FormModel<LoanApplication>,
  overrides: DeepPartial<Applicant> = {}
): void {
  model.applicant.patch({
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: yearsAgo(35),
    inn: VALID_INN,
    passport: {
      series: '4510',
      number: '123456',
      issueDate: yearsAgo(10),
      issuedBy: 'ОВД района Арбат города Москвы',
    },
    ...overrides,
  });
}

/** Шаг «Контакты»: проживание — по адресу регистрации. */
export function fillContactsStep(model: FormModel<LoanApplication>): void {
  model.patch({
    phone: '+7 (900) 123-45-67',
    email: 'ivanov@example.ru',
    registrationAddress: {
      region: 'Москва',
      city: 'Москва',
      street: 'ул. Тверская, д. 7',
      postalCode: '125009',
    },
    sameAsRegistration: true,
  });
}

/** Шаг «Работа»: работает по найму, одно прежнее место работы. */
export function fillEmploymentStep(
  model: FormModel<LoanApplication>,
  overrides: DeepPartial<Omit<Employment, 'previousJobs'>> = {}
): void {
  model.employment.patch({
    status: 'employed',
    companyName: 'ООО «Ромашка»',
    position: 'Инженер',
    companySite: 'romashka.ru',
    monthlyIncome: 150_000,
    ...overrides,
  });
  if (model.employment.previousJobs.length === 0) {
    model.employment.previousJobs.push({ company: 'АО «Лютик»', years: 3 });
  }
}

/** Данные созаёмщика, с которыми строка проходит правила. */
const VALID_CO_BORROWER: Omit<CoBorrower, 'address' | 'phones'> = {
  fullName: 'Иванова Мария Петровна',
  relation: 'spouse',
  monthlyIncome: 80_000,
  share: 100,
  isPrimaryContact: false,
  livesWithApplicant: true,
};

/**
 * Добавить созаёмщика, как это делает пользователь: «Добавить» (строка по шаблону модели),
 * ввод данных ({@link VALID_CO_BORROWER} с правками) и один телефон — тоже «Добавить» во вложенном
 * массиве, по его шаблону. Отметка «есть созаёмщики» ставится заодно.
 *
 * @returns Под-модель новой строки.
 */
export function addCoBorrower(
  model: FormModel<LoanApplication>,
  overrides: DeepPartial<Omit<CoBorrower, 'phones'>> = {}
): FormModel<CoBorrower> {
  model.hasCoBorrowers = true;
  model.coBorrowers.push();
  const row = model.coBorrowers.at(model.coBorrowers.length - 1);
  row.patch({ ...VALID_CO_BORROWER, ...overrides });
  row.phones.push();
  row.phones.at(0).number = '+7 (900) 765-43-21';
  return row;
}

/** Шаг «Семья и созаёмщики»: один иждивенец и `coBorrowers` созаёмщиков. */
function fillCoBorrowersStep(model: FormModel<LoanApplication>, coBorrowers = 1): void {
  model.dependents = 1;
  for (let index = 0; index < coBorrowers; index++) addCoBorrower(model);
}

/** Шаг «Документы и согласия»: паспорт и справка, одна рекомендация, согласия. */
function fillDocumentsStep(model: FormModel<LoanApplication>): void {
  model.$.documents.value = [
    documentFile('passport.pdf', 200 * 1024),
    documentFile('income.jpg', 300 * 1024, 'image/jpeg'),
  ];
  model.$.interests.value = ['card'];
  if (model.references.length === 0) {
    model.references.push({ name: 'Петров Пётр', phone: '+7 (900) 111-22-33' });
  }
  model.consent.patch({ personalData: true, creditBureau: true });
}

/** Заполнить шаг заявки. Шаг проверки только показывает данные — заполнять нечего. */
const fillStep: Readonly<Record<LoanStepId, (model: FormModel<LoanApplication>) => void>> = {
  loan: (model) => fillLoanStep(model),
  applicant: (model) => fillApplicantStep(model),
  contacts: fillContactsStep,
  employment: (model) => fillEmploymentStep(model),
  'co-borrowers': (model) => fillCoBorrowersStep(model),
  documents: fillDocumentsStep,
  review: () => {},
};

/** Коды замечаний прогона по путям полей — для понятного сообщения о непройденном шаге. */
function describeStay(transition: FlowTransition): string {
  if (transition.status === 'moved') return 'перешёл';
  const issues = [...(transition.validation?.issues ?? [])]
    .filter(([, list]) => list.length > 0)
    .map(([handle, list]) => `${handle.__path}: ${list.map((issue) => issue.code).join(', ')}`);
  return `${transition.reason}${issues.length > 0 ? ` — ${issues.join('; ')}` : ''}`;
}

/**
 * Пройти визард до шага `target`: каждый шаг перед ним заполнить и подтвердить (`flow.next()`).
 * Шаг, который не пропустил дальше, — исключение с кодами его замечаний.
 *
 * @returns Переходы по порядку.
 */
export async function passWizardTo(
  bundle: FormBundle<LoanApplication>,
  target: LoanStepId
): Promise<FlowTransition[]> {
  const { flow } = bundle;
  if (flow === undefined) throw new Error('[loan-actions] у сборки нет потока шагов');
  if (!LOAN_STEP_IDS.includes(target)) throw new Error(`[loan-actions] нет шага «${target}»`);
  const transitions: FlowTransition[] = [];
  while (flow.current.peek() !== target) {
    const step = flow.current.peek() as LoanStepId;
    fillStep[step](bundle.model);
    await flushBehaviors();
    const transition = await flow.next();
    if (transition.status !== 'moved') {
      throw new Error(`[loan-actions] шаг «${step}» не пройден: ${describeStay(transition)}`);
    }
    transitions.push(transition);
  }
  return transitions;
}

/**
 * Заполнить заявку целиком верными данными — все шаги разом, без потока: одностраничный вариант
 * (`rules: 'all'`) или загрузка перед отправкой. Отложенные записи поведения дожидается сценарий.
 */
export function fillLoanApplication(model: FormModel<LoanApplication>): void {
  for (const step of LOAN_STEP_IDS) fillStep[step](model);
}
