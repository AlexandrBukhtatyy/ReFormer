// createForm<CreditApplicationForm> — schema, validation, behavior.
// Schema-driven UI: component + componentProps decl per field; testId always present.

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
  pattern,
  applyWhen,
  validate,
  validateItems,
} from '@reformer/core/validators';
import {
  computeFrom,
  watchField,
  copyFrom,
} from '@reformer/core/behaviors';
import {
  Input,
  InputMask,
  Select,
  Textarea,
  Checkbox,
  RadioGroup,
} from '@reformer/ui-kit';
import type {
  CreditApplicationForm,
  LoanType,
  Gender,
  EmploymentStatus,
  MaritalStatus,
  EducationLevel,
  PropertyType,
} from './types';
import {
  LOAN_TYPES,
  GENDER_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  EDUCATION_OPTIONS,
  PROPERTY_TYPES,
} from './sources';

const CURRENT_YEAR_PLUS_ONE = new Date().getFullYear() + 1;

// Annuity formula
function annuity(amount: number, term: number, rate: number): number {
  if (!amount || !term || !rate) return 0;
  const i = rate / 100 / 12;
  const n = term;
  if (i === 0) return amount / n;
  return amount * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

function calcInterestRate(loanType: LoanType, hasProperty: boolean): number {
  let base = 14;
  switch (loanType) {
    case 'mortgage':
      base = 8;
      break;
    case 'car':
      base = 10;
      break;
    case 'business':
      base = 13;
      break;
    case 'refinance':
      base = 11;
      break;
    default:
      base = 14;
  }
  if (hasProperty) base -= 1;
  return base;
}

function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const dt = new Date(birthDate);
  if (isNaN(dt.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dt.getFullYear();
  const m = now.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) age--;
  return age;
}

const formSchema: FormSchema<CreditApplicationForm> = {
  // Step 1
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: { label: 'Тип кредита', options: LOAN_TYPES, testId: 'loanType' },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', type: 'number', testId: 'loanAmount' },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', testId: 'loanTerm' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Цель кредита', testId: 'loanPurpose' },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость недвижимости (₽)', type: 'number', testId: 'propertyValue' },
  },
  carBrand: {
    value: '',
    component: Input,
    componentProps: { label: 'Марка автомобиля', testId: 'carBrand' },
  },
  carModel: {
    value: '',
    component: Input,
    componentProps: { label: 'Модель автомобиля', testId: 'carModel' },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number', testId: 'carYear' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость автомобиля (₽)', type: 'number', testId: 'carPrice' },
  },
  // Step 2 — personal
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', testId: 'personalData-firstName' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество', testId: 'personalData-middleName' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date', testId: 'personalData-birthDate' },
    },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: { label: 'Пол', options: GENDER_OPTIONS, testId: 'personalData-gender' },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения', testId: 'personalData-birthPlace' },
    },
  },
  passportData: {
    series: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Серия паспорта', mask: '99 99', testId: 'passportData-series' },
    },
    number: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Номер паспорта', mask: '999999', testId: 'passportData-number' },
    },
    issueDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата выдачи', type: 'date', testId: 'passportData-issueDate' },
    },
    issuedBy: {
      value: '',
      component: Input,
      componentProps: { label: 'Кем выдан', testId: 'passportData-issuedBy' },
    },
    departmentCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Код подразделения', mask: '999-999', testId: 'passportData-departmentCode' },
    },
  },
  inn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН', mask: '999999999999', testId: 'inn' },
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: { label: 'СНИЛС', mask: '999-999-999 99', testId: 'snils' },
  },
  // Step 3 — contacts
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Основной телефон', mask: '+7 (999) 999-99-99', testId: 'phoneMain' },
  },
  phoneAdditional: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Дополнительный телефон', mask: '+7 (999) 999-99-99', testId: 'phoneAdditional' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', testId: 'email' },
    debounce: 500,
  },
  emailAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Дополнительный email', type: 'email', testId: 'emailAdditional' },
  },
  registrationAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Регион', testId: 'registrationAddress-region' },
    },
    city: {
      value: '',
      component: Input,
      componentProps: { label: 'Город', testId: 'registrationAddress-city' },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', testId: 'registrationAddress-street' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', testId: 'registrationAddress-house' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', testId: 'registrationAddress-apartment' },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999', testId: 'registrationAddress-postalCode' },
    },
  },
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации', testId: 'sameAsRegistration' },
  },
  residenceAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Регион', testId: 'residenceAddress-region' },
    },
    city: {
      value: '',
      component: Input,
      componentProps: { label: 'Город', testId: 'residenceAddress-city' },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', testId: 'residenceAddress-street' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', testId: 'residenceAddress-house' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', testId: 'residenceAddress-apartment' },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999', testId: 'residenceAddress-postalCode' },
    },
  },
  // Step 4 — employment
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: EMPLOYMENT_STATUS_OPTIONS,
      testId: 'employmentStatus',
    },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Название компании', testId: 'companyName' },
  },
  companyInn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН компании', mask: '9999999999', testId: 'companyInn' },
  },
  companyPhone: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Телефон компании', mask: '+7 (999) 999-99-99', testId: 'companyPhone' },
  },
  companyAddress: {
    value: '',
    component: Input,
    componentProps: { label: 'Адрес компании', testId: 'companyAddress' },
  },
  position: {
    value: '',
    component: Input,
    componentProps: { label: 'Должность', testId: 'position' },
  },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий стаж работы (месяцев)', type: 'number', testId: 'workExperienceTotal' },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'Стаж на текущем месте (месяцев)', type: 'number', testId: 'workExperienceCurrent' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', testId: 'monthlyIncome' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход (₽)', type: 'number', testId: 'additionalIncome' },
  },
  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: { label: 'Источник дополнительного дохода', testId: 'additionalIncomeSource' },
  },
  businessType: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип бизнеса', testId: 'businessType' },
  },
  businessInn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН ИП', mask: '999999999999', testId: 'businessInn' },
  },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Вид деятельности', testId: 'businessActivity' },
  },
  // Step 5 — extra
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Семейное положение',
      options: MARITAL_STATUS_OPTIONS,
      testId: 'maritalStatus',
    },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number', testId: 'dependents' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: { label: 'Образование', options: EDUCATION_OPTIONS, testId: 'education' },
  } satisfies FieldConfig<EducationLevel>,
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
  },
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: {
          label: 'Тип имущества',
          options: PROPERTY_TYPES,
          testId: 'type',
        },
      } satisfies FieldConfig<PropertyType>,
      description: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Описание', testId: 'description' },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Оценочная стоимость', type: 'number', testId: 'estimatedValue' },
      },
      hasEncumbrance: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Имеется обременение (залог)', testId: 'hasEncumbrance' },
      },
    },
  ],
  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' },
  },
  existingLoans: [
    {
      bank: {
        value: '',
        component: Input,
        componentProps: { label: 'Банк', testId: 'bank' },
      },
      type: {
        value: '',
        component: Input,
        componentProps: { label: 'Тип кредита', testId: 'type' },
      },
      amount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Сумма кредита', type: 'number', testId: 'amount' },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Остаток задолженности', type: 'number', testId: 'remainingAmount' },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный платеж', type: 'number', testId: 'monthlyPayment' },
      },
      maturityDate: {
        value: '',
        component: Input,
        componentProps: { label: 'Дата погашения', type: 'date', testId: 'maturityDate' },
      },
    },
  ],
  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Добавить созаемщика', testId: 'hasCoBorrower' },
  },
  coBorrowers: [
    {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'Имя', testId: 'personalData-firstName' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Отчество', testId: 'personalData-middleName' },
        },
        birthDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Дата рождения', type: 'date', testId: 'personalData-birthDate' },
        },
        gender: {
          value: 'male',
          component: RadioGroup,
          componentProps: { label: 'Пол', options: GENDER_OPTIONS, testId: 'personalData-gender' },
        } satisfies FieldConfig<Gender>,
        birthPlace: {
          value: '',
          component: Input,
          componentProps: { label: 'Место рождения', testId: 'personalData-birthPlace' },
        },
      },
      phone: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99', testId: 'phone' },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email', testId: 'email' },
      },
      relationship: {
        value: '',
        component: Input,
        componentProps: { label: 'Родство', testId: 'relationship' },
      },
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный доход', type: 'number', testId: 'monthlyIncome' },
      },
    },
  ],
  // Step 6 — confirmation
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на обработку персональных данных', testId: 'agreePersonalData' },
  },
  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на проверку кредитной истории', testId: 'agreeCreditHistory' },
  },
  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на получение маркетинговых материалов', testId: 'agreeMarketing' },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие с условиями кредитования', testId: 'agreeTerms' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Подтверждаю точность введенных данных', testId: 'confirmAccuracy' },
  },
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подтверждения из СМС', mask: '999999', testId: 'electronicSignature' },
  },
  // Computed (readonly)
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true, testId: 'fullName' },
  },
  age: {
    value: null,
    component: Input,
    componentProps: { label: 'Возраст (лет)', type: 'number', readOnly: true, testId: 'age' },
  },
  interestRate: {
    value: null,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', type: 'number', readOnly: true, testId: 'interestRate' },
  },
  monthlyPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж (₽)', type: 'number', readOnly: true, testId: 'monthlyPayment' },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Первоначальный взнос (₽)', type: 'number', readOnly: true, testId: 'initialPayment' },
  },
  totalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий доход (₽)', type: 'number', readOnly: true, testId: 'totalIncome' },
  },
  paymentToIncomeRatio: {
    value: null,
    component: Input,
    componentProps: { label: 'Процент платежа от дохода (%)', type: 'number', readOnly: true, testId: 'paymentToIncomeRatio' },
  },
  coBorrowersIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Доход созаемщиков (₽)', type: 'number', readOnly: true, testId: 'coBorrowersIncome' },
  },
};

const validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Step 1
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму' });
  min(path.loanAmount, 50000);
  max(path.loanAmount, 10000000);
  required(path.loanTerm, { message: 'Введите срок' });
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
      min(p.propertyValue, 1000000);
    }
  );
  applyWhen(
    path.loanType,
    (v) => v === 'car',
    (p) => {
      required(p.carBrand);
      minLength(p.carBrand, 2);
      maxLength(p.carBrand, 50);
      required(p.carModel);
      minLength(p.carModel, 1);
      maxLength(p.carModel, 50);
      required(p.carYear);
      min(p.carYear, 2000);
      max(p.carYear, CURRENT_YEAR_PLUS_ONE);
      required(p.carPrice);
      min(p.carPrice, 300000);
      max(p.carPrice, 10000000);
    }
  );

  // Step 2 — personal
  required(path.personalData.lastName);
  required(path.personalData.firstName);
  required(path.personalData.middleName);
  required(path.personalData.birthDate);
  required(path.personalData.gender);
  required(path.personalData.birthPlace);

  required(path.passportData.series);
  required(path.passportData.number);
  required(path.passportData.issueDate);
  required(path.passportData.issuedBy);
  required(path.passportData.departmentCode);

  required(path.inn);
  pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
  required(path.snils);

  // Step 3 — contacts
  required(path.phoneMain);
  required(path.email);
  email(path.email);

  required(path.registrationAddress.region);
  required(path.registrationAddress.city);
  required(path.registrationAddress.street);
  required(path.registrationAddress.house);
  required(path.registrationAddress.postalCode);

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      required(p.residenceAddress.region);
      required(p.residenceAddress.city);
      required(p.residenceAddress.street);
      required(p.residenceAddress.house);
      required(p.residenceAddress.postalCode);
    }
  );

  // Step 4 — employment
  required(path.employmentStatus);
  required(path.workExperienceTotal);
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent);
  min(path.workExperienceCurrent, 0);

  // Cross-field: workExperienceCurrent <= workExperienceTotal
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value;
    if (total != null && value != null && value > total) {
      return {
        code: 'experience-mismatch',
        message: 'Текущий стаж не может превышать общий',
      };
    }
    return null;
  });

  required(path.monthlyIncome);
  min(path.monthlyIncome, 10000);

  applyWhen(
    path.employmentStatus,
    (v) => v === 'employed',
    (p) => {
      required(p.companyName);
      required(p.companyInn);
      required(p.companyPhone);
      required(p.companyAddress);
      required(p.position);
    }
  );
  applyWhen(
    path.employmentStatus,
    (v) => v === 'selfEmployed',
    (p) => {
      required(p.businessType);
      required(p.businessInn);
      required(p.businessActivity);
    }
  );

  // Step 5
  required(path.maritalStatus);
  required(path.dependents);
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education);

  applyWhen(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      validateItems(p.properties, (item) => {
        required(item.type);
        required(item.description);
        required(item.estimatedValue);
        min(item.estimatedValue, 0);
      });
    }
  );

  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      validateItems(p.existingLoans, (item) => {
        required(item.bank);
        required(item.type);
        required(item.amount);
        min(item.amount, 0);
        required(item.remainingAmount);
        min(item.remainingAmount, 0);
        required(item.monthlyPayment);
        min(item.monthlyPayment, 0);
        required(item.maturityDate);
      });
    }
  );

  applyWhen(
    path.hasCoBorrower,
    (v) => v === true,
    (p) => {
      validateItems(p.coBorrowers, (item) => {
        required(item.personalData.lastName);
        required(item.personalData.firstName);
        required(item.phone);
        required(item.email);
        email(item.email);
        required(item.relationship);
        required(item.monthlyIncome);
        min(item.monthlyIncome, 0);
      });
    }
  );

  // Step 6
  validate(path.agreePersonalData, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' }
  );
  validate(path.agreeCreditHistory, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' }
  );
  validate(path.agreeTerms, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' }
  );
  validate(path.confirmAccuracy, (v) =>
    v === true ? null : { code: 'must-confirm', message: 'Необходимо подтверждение' }
  );
  required(path.electronicSignature);
  pattern(path.electronicSignature, /^\d{6}$/, { message: 'Код должен содержать 6 цифр' });
};

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 fullName — concat from personalData group
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' ')
  );

  // C.5 age from birthDate
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => calcAge(personalData.birthDate)
  );

  // C.3 initialPayment = 20% of propertyValue
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue != null ? Math.round(propertyValue * 0.2) : null
  );

  // C.6 totalIncome = monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // C.1 interestRate
  computeFrom(
    [path.loanType, path.hasProperty],
    path.interestRate,
    ({ loanType, hasProperty }: CreditApplicationForm) =>
      calcInterestRate(loanType, hasProperty)
  );

  // C.2 monthlyPayment via watchField — multi-trigger
  function recomputeMonthly(ctx: { form: FormProxy<CreditApplicationForm> }) {
    const amount = ctx.form.loanAmount.value.value as number | null;
    const term = ctx.form.loanTerm.value.value as number | null;
    const rate = ctx.form.interestRate.value.value as number | null;
    if (!amount || !term || !rate) {
      ctx.form.monthlyPayment.setValue(null);
      return;
    }
    const monthly = Math.round(annuity(amount, term, rate));
    const cur = ctx.form.monthlyPayment.value.value as number | null;
    if (cur !== monthly) {
      ctx.form.monthlyPayment.setValue(monthly);
    }
  }
  watchField(
    path.loanAmount,
    (_v, ctx) => recomputeMonthly(ctx as { form: FormProxy<CreditApplicationForm> }),
    { immediate: false }
  );
  watchField(
    path.loanTerm,
    (_v, ctx) => recomputeMonthly(ctx as { form: FormProxy<CreditApplicationForm> }),
    { immediate: false }
  );
  watchField(
    path.interestRate,
    (_v, ctx) => recomputeMonthly(ctx as { form: FormProxy<CreditApplicationForm> }),
    { immediate: false }
  );

  // C.7 paymentToIncomeRatio
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!monthlyPayment || !totalIncome) return null;
      return Math.round((monthlyPayment / totalIncome) * 100);
    }
  );

  // C.8 coBorrowersIncome — sum from coBorrowers[]
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      coBorrowers.reduce((acc, c) => acc + (c.monthlyIncome ?? 0), 0)
  );

  // sameAsRegistration → copy registrationAddress to residenceAddress
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // Reset carModel when carBrand changes
  watchField(
    path.carBrand,
    (_v, ctx) => {
      (ctx as { form: FormProxy<CreditApplicationForm> }).form.carModel.setValue('');
    },
    { immediate: false }
  );

  // Reset registrationAddress.city when region changes
  watchField(
    path.registrationAddress.region,
    (_v, ctx) => {
      (ctx as { form: FormProxy<CreditApplicationForm> }).form.registrationAddress.city.setValue('');
    },
    { immediate: false }
  );
};

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation,
    behavior,
  });
}
