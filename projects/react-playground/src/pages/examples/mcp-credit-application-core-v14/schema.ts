import {
  createForm,
  type FormSchema,
  type FormProxy,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
  type FieldConfig,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email,
  applyWhen,
} from '@reformer/core/validators';
import { computeFrom } from '@reformer/core/behaviors';
import {
  Input,
  Textarea,
  Select,
  RadioGroup,
  Checkbox,
} from '@reformer/ui-kit';

// ---------------- Types ----------------

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business';
export type Gender = 'male' | 'female';
export type EmploymentStatus =
  | 'employed'
  | 'selfEmployed'
  | 'unemployed'
  | 'retired'
  | 'student';
export type Education =
  | 'secondary'
  | 'specialized'
  | 'higher'
  | 'postgraduate';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

export type ExistingLoan = {
  bank: string;
  amount: number | null;
  remainingAmount: number | null;
};

export type CreditApplicationForm = {
  // Step 1 — кредит
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number | null;
  loanPurpose: string;
  propertyValue: number | null;
  monthlyPayment: number | null; // computed (annuity)

  // Step 2 — личные данные
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
  fullName: string; // computed

  // Step 3 — контакты
  email: string;
  phoneMain: string;
  city: string;
  street: string;

  // Step 4 — работа
  employmentStatus: EmploymentStatus;
  companyName: string;
  monthlyIncome: number | null;

  // Step 5 — доп. инфо
  maritalStatus: MaritalStatus;
  education: Education;
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];

  // Step 6 — подтверждение
  agreePersonalData: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  smsCode: string;
};

// ---------------- Options ----------------

const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / Самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_OPTIONS = [
  { value: 'single', label: 'Холост / Не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец / Вдова' },
];

const EDUCATION_OPTIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

// ---------------- Schema ----------------

const formSchema: FormSchema<CreditApplicationForm> = {
  // Step 1
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPE_OPTIONS,
    },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      type: 'number',
      placeholder: 'Введите сумму',
      min: 0,
      step: 10000,
    },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: {
      label: 'Срок кредита (месяцев)',
      type: 'number',
      placeholder: 'Введите срок',
      min: 0,
    },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      rows: 3,
      maxLength: 500,
    },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость недвижимости (₽)',
      type: 'number',
      placeholder: 'Введите стоимость',
      min: 0,
    },
  },
  monthlyPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж (₽, расчёт)',
      type: 'number',
      disabled: true,
    },
  },

  // Step 2
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
    componentProps: { label: 'Пол', options: GENDER_OPTIONS },
  } satisfies FieldConfig<Gender>,
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя (расчёт)', disabled: true },
  },

  // Step 3
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
  },
  phoneMain: {
    value: '',
    component: Input,
    componentProps: { label: 'Основной телефон', type: 'tel', placeholder: '+7 999 999-99-99' },
  },
  city: {
    value: '',
    component: Input,
    componentProps: { label: 'Город', placeholder: 'Введите город' },
  },
  street: {
    value: '',
    component: Input,
    componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
  },

  // Step 4
  employmentStatus: {
    value: 'employed',
    component: Select,
    componentProps: {
      label: 'Статус занятости',
      placeholder: 'Выберите статус',
      options: EMPLOYMENT_OPTIONS,
    },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
  },

  // Step 5
  maritalStatus: {
    value: 'single',
    component: Select,
    componentProps: {
      label: 'Семейное положение',
      placeholder: 'Выберите статус',
      options: MARITAL_OPTIONS,
    },
  } satisfies FieldConfig<MaritalStatus>,
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень образования',
      options: EDUCATION_OPTIONS,
    },
  } satisfies FieldConfig<Education>,
  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть другие кредиты' },
  },
  existingLoans: [
    {
      bank: {
        value: '',
        component: Input,
        componentProps: { label: 'Банк', placeholder: 'Название банка' },
      },
      amount: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Сумма кредита (₽)',
          type: 'number',
          min: 0,
        },
      },
      remainingAmount: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Остаток задолженности (₽)',
          type: 'number',
          min: 0,
        },
      },
    },
  ],

  // Step 6
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на обработку персональных данных' },
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
  smsCode: {
    value: '',
    component: Input,
    componentProps: { label: 'Код подтверждения из СМС', placeholder: '123456' },
  },
};

// ---------------- Step validations ----------------

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму кредита' });
  min(path.loanAmount, 50_000, { message: 'Минимум 50 000 ₽' });
  max(path.loanAmount, 10_000_000, { message: 'Максимум 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Введите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  // Conditional: mortgage section
  applyWhen(
    path.loanType,
    (value) => value === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.propertyValue, 1_000_000, { message: 'Минимум 1 000 000 ₽' });
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.lastName, { message: 'Введите фамилию' });
  required(path.firstName, { message: 'Введите имя' });
  required(path.middleName, { message: 'Введите отчество' });
  required(path.birthDate, { message: 'Введите дату рождения' });
  required(path.gender, { message: 'Выберите пол' });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Некорректный email' });
  required(path.phoneMain, { message: 'Введите телефон' });
  required(path.city, { message: 'Введите город' });
  required(path.street, { message: 'Введите улицу' });
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Выберите статус занятости' });
  required(path.monthlyIncome, { message: 'Введите доход' });
  min(path.monthlyIncome, 10_000, { message: 'Минимум 10 000 ₽' });

  applyWhen(
    path.employmentStatus,
    (value) => value === 'employed',
    (p) => {
      required(p.companyName, { message: 'Введите название компании' });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Выберите семейное положение' });
  required(path.education, { message: 'Выберите образование' });
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, { message: 'Необходимо согласие' });
  required(path.agreeTerms, { message: 'Необходимо согласие' });
  required(path.confirmAccuracy, { message: 'Необходимо подтверждение' });
  required(path.smsCode, { message: 'Введите СМС-код' });
  minLength(path.smsCode, 4, { message: 'Минимум 4 символа' });
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

export const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

// ---------------- Behavior — computed ----------------

const annuityMonthly = (amount: number, termMonths: number, annualRate: number): number => {
  if (!amount || !termMonths || !annualRate) return 0;
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return amount / termMonths;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return Math.round((amount * monthlyRate * factor) / (factor - 1));
};

const formBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 — fullName = lastName + firstName + middleName
  computeFrom(
    [path.lastName, path.firstName, path.middleName],
    path.fullName,
    ({ lastName, firstName, middleName }: CreditApplicationForm) =>
      [lastName, firstName, middleName].filter(Boolean).join(' ')
  );

  // C.2 — monthlyPayment = annuity(loanAmount, loanTerm, fixedRate=12%)
  computeFrom(
    [path.loanAmount, path.loanTerm],
    path.monthlyPayment,
    ({ loanAmount, loanTerm }: CreditApplicationForm) =>
      annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, 12)
  );
};

// ---------------- Form factory ----------------

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation: fullValidation,
    behavior: formBehavior,
  });
}
