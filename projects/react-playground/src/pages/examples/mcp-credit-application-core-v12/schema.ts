// MCP-only sandbox iter-12 / target=core
// Schema + types + validation + behavior for credit application form (6 steps)
// Spec: docs/specs/credit-application-form.md
//
// Imports — Recipe 1: types from @reformer/core, functions from submodules.
import {
  createForm,
  type FieldConfig,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email,
  applyWhen,
  validate,
  validateItems,
} from '@reformer/core/validators';
import {
  computeFrom,
  copyFrom,
  watchField,
} from '@reformer/core/behaviors';
import {
  Input,
  InputMask,
  Select,
  Checkbox,
  Textarea,
  RadioGroup,
} from '@reformer/ui-kit';

// ---------- Types (Recipe 2: type aliases, not interface) ----------

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'car';

export type PersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
  birthPlace: string;
};

export type PassportData = {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
};

export type Address = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

export type PropertyItem = {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
};

export type ExistingLoan = {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
};

export type CoBorrower = {
  fullName: string;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

export type CreditForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | null;
  carBrand: string;
  carModel: string;
  carYear: number | null;
  carPrice: number | null;
  // Step 2
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;
  // Step 3
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
  // Step 4
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string;
  businessType: string;
  businessInn: string;
  businessActivity: string;
  // Step 5
  maritalStatus: MaritalStatus;
  dependents: number;
  education: Education;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
  // Step 6
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
  // Computed
  fullName: string;
  totalIncome: number;
  interestRate: number;
  monthlyPayment: number;
};

// ---------- Templates for array items (PLAIN leaves only — Recipe arrays) ----------

export const propertyTemplate = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const existingLoanTemplate = (): ExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const coBorrowerTemplate = (): CoBorrower => ({
  fullName: '',
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

// ---------- Item sub-schemas (FieldConfig templates for arrays) ----------

const propertyItemSchema = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      options: [
        { value: 'apartment', label: 'Квартира' },
        { value: 'house', label: 'Дом' },
        { value: 'land', label: 'Земельный участок' },
        { value: 'car', label: 'Автомобиль' },
      ],
    },
  } satisfies FieldConfig<PropertyType>,
  description: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Описание', rows: 2 },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: { label: 'Оценочная стоимость', type: 'number' },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
} satisfies FormSchema<PropertyItem>;

const existingLoanItemSchema = {
  bank: {
    value: '',
    component: Input,
    componentProps: { label: 'Банк', placeholder: 'Название банка' },
  },
  type: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип кредита', placeholder: 'Тип кредита' },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Сумма кредита', type: 'number' },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Остаток задолженности', type: 'number' },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж', type: 'number' },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'text', placeholder: 'YYYY-MM-DD' },
  },
} satisfies FormSchema<ExistingLoan>;

const coBorrowerItemSchema = {
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'ФИО созаемщика', placeholder: 'Иванов Иван Иванович' },
  },
  phone: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
  relationship: {
    value: '',
    component: Input,
    componentProps: { label: 'Родство', placeholder: 'Супруг(а), родитель, и т.д.' },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный доход', type: 'number' },
  },
} satisfies FormSchema<CoBorrower>;

// ---------- Form schema (extracted as typed local — Recipe common-mistakes) ----------

const formSchema: FormSchema<CreditForm> = {
  // ----- Step 1: Кредит -----
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
        { value: 'business', label: 'Бизнес' },
        { value: 'refinance', label: 'Рефинансирование' },
      ],
    },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', type: 'number', placeholder: 'Введите сумму' },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', placeholder: 'От 6 до 240' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Цель кредита', rows: 3, placeholder: 'Опишите цель' },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость недвижимости (₽)', type: 'number' },
  },
  carBrand: {
    value: '',
    component: Input,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
  },
  carModel: {
    value: '',
    component: Input,
    componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number', placeholder: '2020' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость автомобиля (₽)', type: 'number' },
  },

  // ----- Step 2: Личные данные -----
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Введите имя' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'text', placeholder: 'YYYY-MM-DD' },
    },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: {
        options: [
          { value: 'male', label: 'Мужской' },
          { value: 'female', label: 'Женский' },
        ],
      },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения' },
    },
  },
  passportData: {
    series: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Серия паспорта', mask: '99 99' },
    },
    number: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Номер паспорта', mask: '999999' },
    },
    issueDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата выдачи', type: 'text', placeholder: 'YYYY-MM-DD' },
    },
    issuedBy: {
      value: '',
      component: Input,
      componentProps: { label: 'Кем выдан' },
    },
    departmentCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Код подразделения', mask: '999-999' },
    },
  },
  inn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН', mask: '999999999999' },
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: { label: 'СНИЛС', mask: '999-999-999 99' },
  },

  // ----- Step 3: Контакты -----
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Основной телефон', mask: '+7 (999) 999-99-99' },
  },
  phoneAdditional: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Дополнительный телефон', mask: '+7 (999) 999-99-99' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
  },
  emailAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Дополнительный email', type: 'email' },
  },
  registrationAddress: {
    region: { value: '', component: Input, componentProps: { label: 'Регион' } },
    city: { value: '', component: Input, componentProps: { label: 'Город' } },
    street: { value: '', component: Input, componentProps: { label: 'Улица' } },
    house: { value: '', component: Input, componentProps: { label: 'Дом' } },
    apartment: { value: '', component: Input, componentProps: { label: 'Квартира' } },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999' },
    },
  },
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: {
    region: { value: '', component: Input, componentProps: { label: 'Регион' } },
    city: { value: '', component: Input, componentProps: { label: 'Город' } },
    street: { value: '', component: Input, componentProps: { label: 'Улица' } },
    house: { value: '', component: Input, componentProps: { label: 'Дом' } },
    apartment: { value: '', component: Input, componentProps: { label: 'Квартира' } },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999' },
    },
  },

  // ----- Step 4: Работа -----
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      options: [
        { value: 'employed', label: 'Работаю по найму' },
        { value: 'selfEmployed', label: 'ИП / самозанятый' },
        { value: 'unemployed', label: 'Не работаю' },
        { value: 'retired', label: 'Пенсионер' },
        { value: 'student', label: 'Студент' },
      ],
    },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: { value: '', component: Input, componentProps: { label: 'Название компании' } },
  companyInn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН компании', mask: '9999999999' },
  },
  companyPhone: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Телефон компании', mask: '+7 (999) 999-99-99' },
  },
  companyAddress: { value: '', component: Input, componentProps: { label: 'Адрес компании' } },
  position: { value: '', component: Input, componentProps: { label: 'Должность' } },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий стаж работы (месяцев)', type: 'number' },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'Стаж на текущем месте (месяцев)', type: 'number' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход (₽)', type: 'number' },
  },
  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: { label: 'Источник дополнительного дохода' },
  },
  businessType: { value: '', component: Input, componentProps: { label: 'Тип бизнеса' } },
  businessInn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН ИП', mask: '999999999999' },
  },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Вид деятельности', rows: 2 },
  },

  // ----- Step 5: Дополнительно -----
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      options: [
        { value: 'single', label: 'Холост / не замужем' },
        { value: 'married', label: 'В браке' },
        { value: 'divorced', label: 'В разводе' },
        { value: 'widowed', label: 'Вдовец / вдова' },
      ],
    },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      options: [
        { value: 'secondary', label: 'Среднее' },
        { value: 'specialized', label: 'Среднее специальное' },
        { value: 'higher', label: 'Высшее' },
        { value: 'postgraduate', label: 'Послевузовское' },
      ],
    },
  } satisfies FieldConfig<Education>,
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  properties: [propertyItemSchema],
  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть другие кредиты' },
  },
  existingLoans: [existingLoanItemSchema],
  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Добавить созаемщика' },
  },
  coBorrowers: [coBorrowerItemSchema],

  // ----- Step 6: Подтверждение -----
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на обработку персональных данных' },
  },
  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на проверку кредитной истории' },
  },
  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на получение маркетинговых материалов' },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие с условиями кредитования' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Подтверждаю точность введенных данных' },
  },
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подтверждения из СМС', mask: '999999' },
  },

  // ----- Computed (readonly) -----
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя (вычисляется)' },
    disabled: true,
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход (₽)', type: 'number' },
    disabled: true,
  },
  interestRate: {
    value: 15,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', type: 'number' },
    disabled: true,
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж (₽)', type: 'number' },
    disabled: true,
  },
};

// ---------- Step-by-step validation (Recipe multi-step) ----------

const step1Validation: ValidationSchemaFn<CreditForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимум 50 000 ₽' });
  max(path.loanAmount, 10_000_000, { message: 'Максимум 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Введите срок кредита' });
  min(path.loanTerm, 6);
  max(path.loanTerm, 240);
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10);
  maxLength(path.loanPurpose, 500);

  applyWhen(
    path.loanType,
    (v) => v === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.propertyValue, 1_000_000);
    },
  );

  applyWhen(
    path.loanType,
    (v) => v === 'car',
    (p) => {
      required(p.carBrand, { message: 'Введите марку автомобиля' });
      minLength(p.carBrand, 2);
      required(p.carModel, { message: 'Введите модель автомобиля' });
      required(p.carYear, { message: 'Введите год выпуска' });
      min(p.carYear, 2000);
      required(p.carPrice, { message: 'Введите стоимость автомобиля' });
      min(p.carPrice, 300_000);
    },
  );
};

const step2Validation: ValidationSchemaFn<CreditForm> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Введите дату рождения' });
  required(path.personalData.gender);
  required(path.personalData.birthPlace, { message: 'Введите место рождения' });
  required(path.passportData.series, { message: 'Введите серию' });
  required(path.passportData.number, { message: 'Введите номер' });
  required(path.passportData.issueDate, { message: 'Введите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Введите кем выдан' });
  required(path.passportData.departmentCode, { message: 'Введите код подразделения' });
  required(path.inn, { message: 'Введите ИНН' });
  minLength(path.inn, 12);
  required(path.snils, { message: 'Введите СНИЛС' });
};

const step3Validation: ValidationSchemaFn<CreditForm> = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.registrationAddress.region, { message: 'Введите регион' });
  required(path.registrationAddress.city, { message: 'Введите город' });
  required(path.registrationAddress.street, { message: 'Введите улицу' });
  required(path.registrationAddress.house, { message: 'Введите дом' });
  required(path.registrationAddress.postalCode, { message: 'Введите индекс' });

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      required(p.residenceAddress.region);
      required(p.residenceAddress.city);
      required(p.residenceAddress.street);
      required(p.residenceAddress.house);
      required(p.residenceAddress.postalCode);
    },
  );
};

const step4Validation: ValidationSchemaFn<CreditForm> = (path) => {
  required(path.employmentStatus);
  required(path.workExperienceTotal, { message: 'Введите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Введите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0);
  required(path.monthlyIncome, { message: 'Введите ежемесячный доход' });
  min(path.monthlyIncome, 10_000);

  // Кросс-валидация: workExperienceCurrent <= workExperienceTotal
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value as number | null;
    if (total != null && value != null && value > total) {
      return { code: 'experience-mismatch', message: 'Текущий стаж не может превышать общий' };
    }
    return null;
  });

  applyWhen(
    path.employmentStatus,
    (v) => v === 'employed',
    (p) => {
      required(p.companyName, { message: 'Введите название компании' });
      required(p.companyInn, { message: 'Введите ИНН компании' });
      required(p.position, { message: 'Введите должность' });
    },
  );

  applyWhen(
    path.employmentStatus,
    (v) => v === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Введите тип бизнеса' });
      required(p.businessInn, { message: 'Введите ИНН ИП' });
    },
  );
};

const step5Validation: ValidationSchemaFn<CreditForm> = (path) => {
  required(path.maritalStatus);
  required(path.dependents);
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education);

  applyWhen(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      validateItems(p.properties, (itemPath) => {
        required(itemPath.type);
        required(itemPath.description, { message: 'Опишите имущество' });
        min(itemPath.estimatedValue, 0);
      });
    },
  );

  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      validateItems(p.existingLoans, (itemPath) => {
        required(itemPath.bank, { message: 'Введите банк' });
        required(itemPath.type, { message: 'Введите тип кредита' });
        min(itemPath.amount, 0);
        min(itemPath.remainingAmount, 0);
        min(itemPath.monthlyPayment, 0);
        required(itemPath.maturityDate, { message: 'Введите дату погашения' });
      });
    },
  );

  applyWhen(
    path.hasCoBorrower,
    (v) => v === true,
    (p) => {
      validateItems(p.coBorrowers, (itemPath) => {
        required(itemPath.fullName, { message: 'Введите ФИО созаемщика' });
        required(itemPath.phone, { message: 'Введите телефон' });
        required(itemPath.email, { message: 'Введите email' });
        email(itemPath.email);
        required(itemPath.relationship, { message: 'Укажите родство' });
        min(itemPath.monthlyIncome, 0);
      });
    },
  );
};

const step6Validation: ValidationSchemaFn<CreditForm> = (path) => {
  validate(path.agreePersonalData, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' },
  );
  validate(path.agreeCreditHistory, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' },
  );
  validate(path.agreeTerms, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' },
  );
  validate(path.confirmAccuracy, (v) =>
    v === true ? null : { code: 'must-confirm', message: 'Подтвердите точность данных' },
  );
  required(path.electronicSignature, { message: 'Введите код из СМС' });
  minLength(path.electronicSignature, 6);
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

export const fullValidation: ValidationSchemaFn<CreditForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

// ---------- Behavior (computed + copy + array cleanup) ----------

const RATE_BY_LOAN_TYPE: Record<LoanType, number> = {
  consumer: 15,
  mortgage: 8,
  car: 12,
  business: 18,
  refinance: 10,
};

function annuity(amount: number, term: number, ratePct: number): number {
  if (!amount || !term || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  const n = term;
  return Math.round((amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

const behavior: BehaviorSchemaFn<CreditForm> = (path) => {
  // C.4 fullName — group-node subscription (Recipe 4)
  computeFrom([path.personalData], path.fullName, ({ personalData }: CreditForm) =>
    [personalData.lastName, personalData.firstName, personalData.middleName]
      .filter(Boolean)
      .join(' '),
  );

  // C.6 totalIncome — same level
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0),
  );

  // C.1 interestRate — base rate by loanType
  computeFrom(
    [path.loanType],
    path.interestRate,
    ({ loanType }: CreditForm) => RATE_BY_LOAN_TYPE[loanType],
  );

  // C.2 monthlyPayment — annuity. Multiple watchField per trigger (Recipe compute-vs-watch)
  const recompute = (ctx: { form: FormProxy<CreditForm> }) => {
    const a = ctx.form.loanAmount.value.value as number | null;
    const t = ctx.form.loanTerm.value.value as number | null;
    const r = ctx.form.interestRate.value.value as number;
    const next = annuity(a ?? 0, t ?? 0, r ?? 0);
    const prev = ctx.form.monthlyPayment.value.value as number;
    if (Math.abs((prev ?? 0) - next) > 0.5) {
      ctx.form.monthlyPayment.setValue(next);
    }
  };
  watchField(path.loanAmount, (_v, ctx) => recompute(ctx), { immediate: false });
  watchField(path.loanTerm, (_v, ctx) => recompute(ctx), { immediate: false });
  watchField(path.interestRate, (_v, ctx) => recompute(ctx), { immediate: false });

  // copyFrom registrationAddress → residenceAddress (Recipe copy-from)
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form: CreditForm) => form.sameAsRegistration === true,
  });

  // Array cleanup (Recipe array-cleanup)
  watchField(
    path.hasProperty,
    (v, ctx) => {
      if (!v) {
        ctx.form.properties.clear();
      }
    },
    { immediate: false },
  );
  watchField(
    path.hasExistingLoans,
    (v, ctx) => {
      if (!v) {
        ctx.form.existingLoans.clear();
      }
    },
    { immediate: false },
  );
  watchField(
    path.hasCoBorrower,
    (v, ctx) => {
      if (!v) {
        ctx.form.coBorrowers.clear();
      }
    },
    { immediate: false },
  );
};

// ---------- Factory ----------

export function createCreditForm(): FormProxy<CreditForm> {
  return createForm<CreditForm>({
    form: formSchema,
    validation: fullValidation,
    behavior,
  });
}
