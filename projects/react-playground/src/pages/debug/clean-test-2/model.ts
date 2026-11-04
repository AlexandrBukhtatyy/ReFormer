// @reformer-form-build cacbcaaec1ea9f85 собран из form.intent.json; правка руками отсоединит файл от сборки
/**
 * Модель формы «Заявка на кредит» — источник истины для всех остальных файлов.
 * Валидация, поведение и схема ссылаются на ЭТИ пути; менять их надо здесь.
 */
import { arrayOf, createModel } from '@reformer/core';

export type Property = {
  /** Тип имущества */
  type: string | null;
  /** Описание */
  description: string;
  /** Оценочная стоимость */
  estimatedValue: number;
  /** Имеется обременение (залог) */
  hasEncumbrance: boolean;
};

export type ExistingLoan = {
  /** Банк */
  bank: string;
  /** Тип кредита */
  type: string;
  /** Сумма кредита */
  amount: number;
  /** Остаток задолженности */
  remainingAmount: number;
  /** Ежемесячный платеж */
  monthlyPayment: number;
  /** Дата погашения */
  maturityDate: string;
};

export type CoBorrower = {
  /** Фамилия */
  lastName: string;
  /** Имя */
  firstName: string;
  /** Отчество */
  middleName: string;
  /** Дата рождения */
  birthDate: string;
  /** Телефон */
  phone: string;
  /** Email */
  email: string;
  /** Родство */
  relationship: string;
  /** Ежемесячный доход */
  monthlyIncome: number;
};

export type CreditApplication = {
  properties: Property[];
  existingLoans: ExistingLoan[];
  coBorrowers: CoBorrower[];
  /** Тип кредита */
  loanType: string;
  /** Сумма кредита (₽) */
  loanAmount: number | null;
  /** Срок кредита (месяцев) */
  loanTerm: number;
  /** Цель кредита */
  loanPurpose: string;
  /** Стоимость недвижимости (₽) */
  propertyValue: number | null;
  /** Первоначальный взнос (₽) */
  initialPayment: number | null;
  /** Марка автомобиля */
  carBrand: string | null;
  /** Модель автомобиля */
  carModel: string | null;
  /** Год выпуска */
  carYear: number | null;
  /** Стоимость автомобиля (₽) */
  carPrice: number | null;
  /** Процентная ставка (%) */
  interestRate: number | null;
  /** Ежемесячный платеж (₽) */
  monthlyPayment: number | null;
  personalData: {
    /** Фамилия */
    lastName: string;
    /** Имя */
    firstName: string;
    /** Отчество */
    middleName: string;
    /** Дата рождения */
    birthDate: string;
    /** Пол */
    gender: string;
    /** Место рождения */
    birthPlace: string;
  };
  passportData: {
    /** Серия паспорта */
    series: string;
    /** Номер паспорта */
    number: string;
    /** Дата выдачи */
    issueDate: string;
    /** Кем выдан */
    issuedBy: string;
    /** Код подразделения */
    departmentCode: string;
  };
  /** ИНН */
  inn: string;
  /** СНИЛС */
  snils: string;
  /** Полное имя */
  fullName: string | null;
  /** Возраст (лет) */
  age: number | null;
  /** Основной телефон */
  phoneMain: string;
  /** Дополнительный телефон */
  phoneAdditional: string | null;
  /** Email */
  email: string;
  /** Дополнительный email совпадает с основным */
  sameEmail: boolean;
  /** Дополнительный email */
  emailAdditional: string | null;
  registrationAddress: {
    /** Регион */
    region: string;
    /** Город */
    city: string;
    /** Улица */
    street: string;
    /** Дом */
    house: string;
    /** Квартира */
    apartment: string | null;
    /** Индекс */
    postalCode: string;
  };
  /** Адрес проживания совпадает с адресом регистрации */
  sameAsRegistration: boolean;
  residenceAddress: {
    /** Регион */
    region: string | null;
    /** Город */
    city: string | null;
    /** Улица */
    street: string | null;
    /** Дом */
    house: string | null;
    /** Квартира */
    apartment: string | null;
    /** Индекс */
    postalCode: string | null;
  };
  /** Статус занятости */
  employmentStatus: string;
  /** Название компании */
  companyName: string | null;
  /** ИНН компании */
  companyInn: string | null;
  /** Телефон компании */
  companyPhone: string | null;
  /** Адрес компании */
  companyAddress: string | null;
  /** Должность */
  position: string | null;
  /** Общий стаж работы (месяцев) */
  workExperienceTotal: number | null;
  /** Стаж на текущем месте (месяцев) */
  workExperienceCurrent: number | null;
  /** Ежемесячный доход (₽) */
  monthlyIncome: number | null;
  /** Дополнительный доход (₽) */
  additionalIncome: number | null;
  /** Источник дополнительного дохода */
  additionalIncomeSource: string | null;
  /** Тип бизнеса */
  businessType: string | null;
  /** ИНН ИП */
  businessInn: string | null;
  /** Вид деятельности */
  businessActivity: string | null;
  /** Общий доход (₽) */
  totalIncome: number | null;
  /** Процент платежа от дохода (%) */
  paymentToIncomeRatio: number | null;
  /** Семейное положение */
  maritalStatus: string;
  /** Количество иждивенцев */
  dependents: number;
  /** Образование */
  education: string;
  /** У меня есть имущество */
  hasProperty: boolean;
  /** У меня есть другие кредиты */
  hasExistingLoans: boolean;
  /** Добавить созаемщика */
  hasCoBorrower: boolean;
  /** Доход созаемщиков (₽) */
  coBorrowersIncome: number | null;
  /** Согласие на обработку персональных данных */
  agreePersonalData: boolean;
  /** Согласие на проверку кредитной истории */
  agreeCreditHistory: boolean;
  /** Согласие на получение маркетинговых материалов */
  agreeMarketing: boolean;
  /** Согласие с условиями кредитования */
  agreeTerms: boolean;
  /** Подтверждаю точность введенных данных */
  confirmAccuracy: boolean;
  /** Код подтверждения из СМС */
  electronicSignature: string;
};

/** Шаблон нового элемента массива `properties`. */
const blankProperty = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

/** Шаблон нового элемента массива `existingLoans`. */
const blankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

/** Шаблон нового элемента массива `coBorrowers`. */
const blankCoBorrower = (): CoBorrower => ({
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

/** Модель формы — по одной на сборку: `createForm({ model: createFormModel(), … })`. */
export const createFormModel = () =>
  createModel<CreditApplication>({
    properties: arrayOf(blankProperty),
    existingLoans: arrayOf(blankExistingLoan),
    coBorrowers: arrayOf(blankCoBorrower),
    loanType: 'consumer',
    loanAmount: null,
    loanTerm: 12,
    loanPurpose: '',
    propertyValue: null,
    initialPayment: null,
    carBrand: null,
    carModel: null,
    carYear: null,
    carPrice: null,
    interestRate: null,
    monthlyPayment: null,
    personalData: {
      lastName: '',
      firstName: '',
      middleName: '',
      birthDate: '',
      gender: 'male',
      birthPlace: '',
    },
    passportData: {
      series: '',
      number: '',
      issueDate: '',
      issuedBy: '',
      departmentCode: '',
    },
    inn: '',
    snils: '',
    fullName: '',
    age: null,
    phoneMain: '',
    phoneAdditional: null,
    email: '',
    sameEmail: false,
    emailAdditional: null,
    registrationAddress: {
      region: '',
      city: '',
      street: '',
      house: '',
      apartment: '',
      postalCode: '',
    },
    sameAsRegistration: true,
    residenceAddress: {
      region: '',
      city: '',
      street: '',
      house: '',
      apartment: '',
      postalCode: '',
    },
    employmentStatus: 'employed',
    companyName: null,
    companyInn: null,
    companyPhone: null,
    companyAddress: null,
    position: null,
    workExperienceTotal: null,
    workExperienceCurrent: null,
    monthlyIncome: null,
    additionalIncome: null,
    additionalIncomeSource: null,
    businessType: null,
    businessInn: null,
    businessActivity: null,
    totalIncome: null,
    paymentToIncomeRatio: null,
    maritalStatus: 'single',
    dependents: 0,
    education: 'higher',
    hasProperty: false,
    hasExistingLoans: false,
    hasCoBorrower: false,
    coBorrowersIncome: null,
    agreePersonalData: false,
    agreeCreditHistory: false,
    agreeMarketing: false,
    agreeTerms: false,
    confirmAccuracy: false,
    electronicSignature: '',
  });
