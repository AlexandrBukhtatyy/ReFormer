/**
 * Модель заявки на кредит — данные синтетической «сложной формы» сквозных тестов ядра.
 *
 * Форма данных собрана так, чтобы в одной заявке встретились все виды узлов модели:
 * - вложенные группы — `loan`, `applicant` и его `passport`;
 * - две группы одной формы — адреса регистрации и проживания (их подключает одна подформа схемы);
 * - массив объектов внутри группы — `employment.previousJobs`;
 * - массив строк с группой и вложенным массивом — `coBorrowers[].address`, `coBorrowers[].phones`;
 * - поле-массив целиком — `interests` (мультивыбор) и поле файлов из начального `null` — `documents`;
 * - массив без шаблона в модели — `references`: шаблон строки задаёт узел схемы (`initialValue`);
 * - производные поля — цели `compute` / `computeFrom` поведения (`loan.interestRate`,
 *   `loan.monthlyPayment`, `applicant.fullName`, `totalIncome`, `paymentToIncomeRatio`);
 * - поле, которым владеет сервер, — `applicationNumber`: помечено `markDerived` явно.
 *
 * Значения создаёт фабрика {@link createLoanInitial}: шаблоны `arrayOf` привязаны к самим массивам
 * и при копировании готовой константы потерялись бы.
 */

import { arrayOf, createModel, markDerived, type FormModel } from '../../../../src/model/index';

/** Вид кредита. */
export type LoanType = 'consumer' | 'mortgage' | 'car';

/** Занятость заёмщика. */
type EmploymentStatus = 'employed' | 'self-employed' | 'unemployed';

/** Кем созаёмщик приходится заёмщику. */
type CoBorrowerRelation = 'spouse' | 'parent' | 'child' | 'other';

/** Продукты банка, которые интересны заёмщику (мультивыбор). */
type Interest = 'deposit' | 'card' | 'insurance' | 'investments';

/** Условия кредита — шаг «Кредит». */
export interface LoanTerms {
  type: LoanType;
  /** Сумма, ₽. */
  amount: number | null;
  /** Срок, месяцев. */
  term: number | null;
  purpose: string;
  /** Дата первого платежа, `YYYY-MM-DD`. */
  firstPaymentDate: string;
  promoCode: string;
  /** Стоимость залога, ₽ — только ипотека. */
  propertyValue: number | null;
  /** Первоначальный взнос, ₽ — только ипотека. */
  initialPayment: number | null;
  /** Ставка, % годовых — производное поле (`computeFrom` по виду и сроку). */
  interestRate: number;
  /** Ежемесячный платёж, ₽ — производное поле (`compute`). */
  monthlyPayment: number;
}

/** Паспорт заёмщика — вложенная группа `applicant`. */
export interface Passport {
  series: string;
  number: string;
  /** Дата выдачи, `YYYY-MM-DD`. */
  issueDate: string;
  issuedBy: string;
}

/** Заёмщик — шаг «Заёмщик». */
export interface Applicant {
  lastName: string;
  firstName: string;
  middleName: string;
  /** Полное имя — производное поле (`compute`). */
  fullName: string;
  /** Дата рождения, `YYYY-MM-DD`. */
  birthDate: string;
  /** ИНН физического лица — 12 цифр; наличие в реестре проверяет сервер. */
  inn: string;
  passport: Passport;
}

/** Адрес: у заёмщика их два (регистрация и проживание), у созаёмщика — один. */
export interface Address {
  region: string;
  city: string;
  street: string;
  postalCode: string;
}

/** Прежнее место работы — строка массива внутри группы `employment`. */
export interface PreviousJob {
  company: string;
  /** Стаж, лет. */
  years: number | null;
}

/** Занятость — шаг «Работа», подключён подформой схемы. */
export interface Employment {
  status: EmploymentStatus;
  companyName: string;
  position: string;
  companySite: string;
  /** Ежемесячный доход, ₽. */
  monthlyIncome: number | null;
  previousJobs: PreviousJob[];
}

/** Телефон созаёмщика — строка вложенного массива. */
export interface Phone {
  number: string;
}

/** Созаёмщик — строка массива с группой адреса и вложенным массивом телефонов. */
export interface CoBorrower {
  fullName: string;
  relation: CoBorrowerRelation | null;
  /** Ежемесячный доход, ₽. */
  monthlyIncome: number | null;
  /** Доля ответственности по кредиту, %: у последнего созаёмщика её досчитывает форма. */
  share: number;
  /** Основной контакт — не больше одного на заявку. */
  isPrimaryContact: boolean;
  /** Живёт с заёмщиком: тогда свой адрес не нужен. */
  livesWithApplicant: boolean;
  address: Address;
  phones: Phone[];
}

/** Контакт поручителя по рекомендации — строка массива без шаблона в модели. */
export interface Reference {
  name: string;
  phone: string;
}

/** Согласия и способ подписания — шаг «Документы и согласия». */
interface Consent {
  personalData: boolean;
  creditBureau: boolean;
  /** Телефон для кода подписи — синхронизирован с контактным. */
  smsPhone: string;
  notifyByEmail: boolean;
  /** Почта для уведомлений — копия контактной в нижнем регистре. */
  notificationEmail: string;
}

/** Заявка на кредит целиком. */
export interface LoanApplication {
  /** Номер заявки: присваивает сервер, форма только показывает. */
  applicationNumber: string;
  loan: LoanTerms;
  applicant: Applicant;
  phone: string;
  email: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
  employment: Employment;
  /** Иждивенцев. */
  dependents: number | null;
  hasCoBorrowers: boolean;
  coBorrowers: CoBorrower[];
  /** Доход семьи, ₽ — производное поле: доход заёмщика и созаёмщиков. */
  totalIncome: number;
  /** Платёж к доходу, % — производное поле. */
  paymentToIncomeRatio: number;
  documents: File[] | null;
  interests: Interest[];
  references: Reference[];
  consent: Consent;
}

/** Пределы суммы по виду кредита, ₽: их показывает поле суммы и проверяют правила. */
export const LOAN_LIMITS: Readonly<
  Record<LoanType, { readonly min: number; readonly max: number }>
> = {
  consumer: { min: 30_000, max: 5_000_000 },
  mortgage: { min: 500_000, max: 30_000_000 },
  car: { min: 100_000, max: 10_000_000 },
};

/** Документы, которые принимает банк: изображения и PDF (формат `accept` поля файлов). */
export const DOCUMENT_ACCEPT = 'image/*,.pdf';

/** Пустой адрес. */
export const blankAddress = (): Address => ({ region: '', city: '', street: '', postalCode: '' });

/** Новый телефон созаёмщика. */
const blankPhone = (): Phone => ({ number: '' });

/** Новое прежнее место работы. */
const blankPreviousJob = (): PreviousJob => ({ company: '', years: null });

/** Новый созаёмщик: шаблон строки объявлен в модели, вложенный массив — со своим шаблоном. */
const blankCoBorrower = (): CoBorrower => ({
  fullName: '',
  relation: null,
  monthlyIncome: null,
  share: 0,
  isPrimaryContact: false,
  livesWithApplicant: false,
  address: blankAddress(),
  phones: arrayOf(blankPhone),
});

/** Начальные значения новой заявки. */
export function createLoanInitial(): LoanApplication {
  return {
    applicationNumber: '',
    loan: {
      type: 'consumer',
      amount: null,
      term: null,
      purpose: '',
      firstPaymentDate: '',
      promoCode: '',
      propertyValue: null,
      initialPayment: null,
      interestRate: 0,
      monthlyPayment: 0,
    },
    applicant: {
      lastName: '',
      firstName: '',
      middleName: '',
      fullName: '',
      birthDate: '',
      inn: '',
      passport: { series: '', number: '', issueDate: '', issuedBy: '' },
    },
    phone: '',
    email: '',
    registrationAddress: blankAddress(),
    sameAsRegistration: true,
    residenceAddress: blankAddress(),
    employment: {
      status: 'employed',
      companyName: '',
      position: '',
      companySite: '',
      monthlyIncome: null,
      previousJobs: arrayOf(blankPreviousJob),
    },
    dependents: 0,
    hasCoBorrowers: false,
    coBorrowers: arrayOf(blankCoBorrower),
    totalIncome: 0,
    paymentToIncomeRatio: 0,
    documents: null,
    interests: [],
    // Шаблона в модели нет намеренно: строку по кнопке «Добавить» даёт `initialValue` узла схемы.
    references: [],
    consent: {
      personalData: false,
      creditBureau: false,
      smsPhone: '',
      notifyByEmail: false,
      notificationEmail: '',
    },
  };
}

/**
 * Отдать серверу поля, которыми он владеет: номер заявки приходит с сервера, и загрузка черновика
 * (`patch` / `set` модели) его не затирает. Пометка та же, что ставит `compute`, но поставлена
 * явно — поле не вычисляется, им распоряжается внешний источник.
 */
export function markServerOwned(model: FormModel<LoanApplication>): void {
  markDerived(model.$.applicationNumber);
}

/** Модель заявки с полями сервера. */
export function createLoanModel(
  initial: LoanApplication = createLoanInitial()
): FormModel<LoanApplication> {
  const model = createModel<LoanApplication>(initial);
  markServerOwned(model);
  return model;
}
