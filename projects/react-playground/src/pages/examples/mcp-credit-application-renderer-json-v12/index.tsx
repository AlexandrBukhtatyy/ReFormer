/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import {
  createForm,
  type FieldConfig,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
  validateForm,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email as emailValidator,
  applyWhen,
  apply,
} from '@reformer/core/validators';
import { computeFrom } from '@reformer/core/behaviors';
import {
  Box,
  Button,
  Checkbox,
  FormField,
  Input,
  Section,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import {
  FormRenderer,
  RenderNodeComponent,
  createRenderSchema,
  type RenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import {
  defineRegistry,
  FIELD_WRAPPER,
  createRenderSchemaFromJson,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import jsonSchemaRaw from './schema.json';

// =====================================================================
// Form types (Recipe 2 — type aliases, not interfaces)
// =====================================================================

type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
type EmploymentStatus =
  | 'employed'
  | 'selfEmployed'
  | 'unemployed'
  | 'retired'
  | 'student';
type Gender = 'male' | 'female';
type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

type PersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
  birthPlace: string;
};

type PassportData = {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
};

type AddressData = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

type CreditApplicationForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | null;
  initialPayment: number | null;
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carPrice: number | null;

  // Step 2
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  registrationAddress: AddressData;
  sameAsRegistration: boolean;
  residenceAddress: AddressData;

  // Step 4
  employmentStatus: EmploymentStatus;
  companyName: string | null;
  companyInn: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  position: string | null;
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string | null;
  businessType: string | null;
  businessInn: string | null;
  businessActivity: string | null;

  // Step 5
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  hasExistingLoans: boolean;
  hasCoBorrower: boolean;

  // Step 6
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Computed
  fullName: string;
  age: number | null;
  totalIncome: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  paymentToIncomeRatio: number | null;
};

// =====================================================================
// Source values (registered into registry)
// =====================================================================

const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];
const GENDERS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];
const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / Самозанятый' },
  { value: 'unemployed', label: 'Безработный' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];
const MARITAL_STATUSES = [
  { value: 'single', label: 'Холост / Не замужем' },
  { value: 'married', label: 'Женат / Замужем' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / Вдова' },
];
const EDUCATION_LEVELS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

// =====================================================================
// Form schema (literal -> typed local to surface real errors per Recipe in 05-common-mistakes)
// =====================================================================

const formSchema: FormSchema<CreditApplicationForm> = {
  // Step 1
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: { label: 'Тип кредита', options: LOAN_TYPES },
  } satisfies FieldConfig<LoanType>,
  loanAmount: { value: null, component: Input, componentProps: { label: 'Сумма', type: 'number' } },
  loanTerm: { value: 12, component: Input, componentProps: { label: 'Срок (мес)', type: 'number' } },
  loanPurpose: { value: '', component: Textarea, componentProps: { label: 'Цель кредита' } },
  propertyValue: { value: null, component: Input, componentProps: { label: 'Стоимость недвижимости', type: 'number' } },
  initialPayment: { value: null, component: Input, componentProps: { label: 'Первоначальный взнос', type: 'number' } },
  carBrand: { value: null, component: Input, componentProps: { label: 'Марка авто' } },
  carModel: { value: null, component: Input, componentProps: { label: 'Модель авто' } },
  carYear: { value: null, component: Input, componentProps: { label: 'Год выпуска', type: 'number' } },
  carPrice: { value: null, component: Input, componentProps: { label: 'Стоимость авто', type: 'number' } },

  // Step 2
  personalData: {
    lastName: { value: '', component: Input, componentProps: { label: 'Фамилия' } },
    firstName: { value: '', component: Input, componentProps: { label: 'Имя' } },
    middleName: { value: '', component: Input, componentProps: { label: 'Отчество' } },
    birthDate: { value: '', component: Input, componentProps: { label: 'Дата рождения', type: 'date' } },
    gender: {
      value: 'male',
      component: Select,
      componentProps: { label: 'Пол', options: GENDERS },
    } satisfies FieldConfig<Gender>,
    birthPlace: { value: '', component: Input, componentProps: { label: 'Место рождения' } },
  },
  passportData: {
    series: { value: '', component: Input, componentProps: { label: 'Серия' } },
    number: { value: '', component: Input, componentProps: { label: 'Номер' } },
    issueDate: { value: '', component: Input, componentProps: { label: 'Дата выдачи', type: 'date' } },
    issuedBy: { value: '', component: Input, componentProps: { label: 'Кем выдан' } },
    departmentCode: { value: '', component: Input, componentProps: { label: 'Код подразделения' } },
  },
  inn: { value: '', component: Input, componentProps: { label: 'ИНН' } },
  snils: { value: '', component: Input, componentProps: { label: 'СНИЛС' } },

  // Step 3
  phoneMain: { value: '', component: Input, componentProps: { label: 'Основной телефон' } },
  phoneAdditional: { value: null, component: Input, componentProps: { label: 'Доп. телефон' } },
  email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } },
  emailAdditional: { value: null, component: Input, componentProps: { label: 'Доп. email', type: 'email' } },
  registrationAddress: {
    region: { value: '', component: Input, componentProps: { label: 'Регион' } },
    city: { value: '', component: Input, componentProps: { label: 'Город' } },
    street: { value: '', component: Input, componentProps: { label: 'Улица' } },
    house: { value: '', component: Input, componentProps: { label: 'Дом' } },
    apartment: { value: '', component: Input, componentProps: { label: 'Квартира' } },
    postalCode: { value: '', component: Input, componentProps: { label: 'Индекс' } },
  },
  sameAsRegistration: { value: true, component: Checkbox, componentProps: { label: 'Адрес проживания совпадает' } },
  residenceAddress: {
    region: { value: '', component: Input, componentProps: { label: 'Регион' } },
    city: { value: '', component: Input, componentProps: { label: 'Город' } },
    street: { value: '', component: Input, componentProps: { label: 'Улица' } },
    house: { value: '', component: Input, componentProps: { label: 'Дом' } },
    apartment: { value: '', component: Input, componentProps: { label: 'Квартира' } },
    postalCode: { value: '', component: Input, componentProps: { label: 'Индекс' } },
  },

  // Step 4
  employmentStatus: {
    value: 'employed',
    component: Select,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUSES },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: { value: null, component: Input, componentProps: { label: 'Компания' } },
  companyInn: { value: null, component: Input, componentProps: { label: 'ИНН компании' } },
  companyPhone: { value: null, component: Input, componentProps: { label: 'Телефон компании' } },
  companyAddress: { value: null, component: Input, componentProps: { label: 'Адрес компании' } },
  position: { value: null, component: Input, componentProps: { label: 'Должность' } },
  workExperienceTotal: { value: null, component: Input, componentProps: { label: 'Общий стаж', type: 'number' } },
  workExperienceCurrent: { value: null, component: Input, componentProps: { label: 'Стаж на текущем', type: 'number' } },
  monthlyIncome: { value: null, component: Input, componentProps: { label: 'Доход', type: 'number' } },
  additionalIncome: { value: null, component: Input, componentProps: { label: 'Доп. доход', type: 'number' } },
  additionalIncomeSource: { value: null, component: Input, componentProps: { label: 'Источник доп. дохода' } },
  businessType: { value: null, component: Input, componentProps: { label: 'Тип бизнеса' } },
  businessInn: { value: null, component: Input, componentProps: { label: 'ИНН ИП' } },
  businessActivity: { value: null, component: Textarea, componentProps: { label: 'Вид деятельности' } },

  // Step 5
  maritalStatus: {
    value: 'single',
    component: Select,
    componentProps: { label: 'Семейное положение', options: MARITAL_STATUSES },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: { value: 0, component: Input, componentProps: { label: 'Иждивенцы', type: 'number' } },
  education: {
    value: 'higher',
    component: Select,
    componentProps: { label: 'Образование', options: EDUCATION_LEVELS },
  } satisfies FieldConfig<EducationLevel>,
  hasProperty: { value: false, component: Checkbox, componentProps: { label: 'Есть имущество' } },
  hasExistingLoans: { value: false, component: Checkbox, componentProps: { label: 'Есть другие кредиты' } },
  hasCoBorrower: { value: false, component: Checkbox, componentProps: { label: 'Есть созаемщик' } },

  // Step 6
  agreePersonalData: { value: false, component: Checkbox, componentProps: { label: 'Согласие на обработку персональных данных' } },
  agreeCreditHistory: { value: false, component: Checkbox, componentProps: { label: 'Согласие на проверку кредитной истории' } },
  agreeMarketing: { value: false, component: Checkbox, componentProps: { label: 'Согласие на получение маркетинговых материалов' } },
  agreeTerms: { value: false, component: Checkbox, componentProps: { label: 'Согласие с условиями кредитования' } },
  confirmAccuracy: { value: false, component: Checkbox, componentProps: { label: 'Подтверждаю точность введённых данных' } },
  electronicSignature: { value: '', component: Input, componentProps: { label: 'Код из СМС', placeholder: '123456' } },

  // Computed
  fullName: { value: '', component: Input, componentProps: { label: 'Полное имя', readOnly: true } },
  age: { value: null, component: Input, componentProps: { label: 'Возраст', type: 'number', readOnly: true } },
  totalIncome: { value: null, component: Input, componentProps: { label: 'Общий доход', type: 'number', readOnly: true } },
  interestRate: { value: null, component: Input, componentProps: { label: 'Ставка', type: 'number', readOnly: true } },
  monthlyPayment: { value: null, component: Input, componentProps: { label: 'Платёж', type: 'number', readOnly: true } },
  paymentToIncomeRatio: { value: null, component: Input, componentProps: { label: 'PTI', type: 'number', readOnly: true } },
};

// =====================================================================
// Validation
// =====================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму' });
  min(path.loanAmount, 50000);
  max(path.loanAmount, 10000000);
  required(path.loanTerm, { message: 'Введите срок' });
  min(path.loanTerm, 6);
  max(path.loanTerm, 240);
  required(path.loanPurpose, { message: 'Опишите цель' });
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
      required(p.carBrand, { message: 'Введите марку' });
      required(p.carModel, { message: 'Введите модель' });
      required(p.carYear, { message: 'Введите год' });
      min(p.carYear, 2000);
      required(p.carPrice, { message: 'Введите стоимость' });
      min(p.carPrice, 300000);
      max(p.carPrice, 10000000);
    }
  );
};

const personalDataValidation: ValidationSchemaFn<PersonalData> = (path) => {
  required(path.lastName, { message: 'Введите фамилию' });
  required(path.firstName, { message: 'Введите имя' });
  required(path.middleName, { message: 'Введите отчество' });
  required(path.birthDate, { message: 'Введите дату рождения' });
  required(path.gender);
  required(path.birthPlace, { message: 'Введите место рождения' });
};

const passportDataValidation: ValidationSchemaFn<PassportData> = (path) => {
  required(path.series, { message: 'Серия' });
  required(path.number, { message: 'Номер' });
  required(path.issueDate, { message: 'Дата выдачи' });
  required(path.issuedBy, { message: 'Кем выдан' });
  required(path.departmentCode, { message: 'Код подразделения' });
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  apply(path.personalData, personalDataValidation);
  apply(path.passportData, passportDataValidation);
  required(path.inn, { message: 'ИНН' });
  required(path.snils, { message: 'СНИЛС' });
};

const addressValidation: ValidationSchemaFn<AddressData> = (path) => {
  required(path.region);
  required(path.city);
  required(path.street);
  required(path.house);
  required(path.postalCode);
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите телефон' });
  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Некорректный email' });
  apply(path.registrationAddress, addressValidation);
  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      apply(p.residenceAddress, addressValidation);
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus);
  required(path.workExperienceTotal);
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent);
  min(path.workExperienceCurrent, 0);
  required(path.monthlyIncome, { message: 'Введите доход' });
  min(path.monthlyIncome, 10000);

  applyWhen(
    path.employmentStatus,
    (v) => v === 'employed',
    (p) => {
      required(p.companyName, { message: 'Введите компанию' });
      required(p.companyInn, { message: 'Введите ИНН' });
      required(p.position, { message: 'Введите должность' });
    }
  );
  applyWhen(
    path.employmentStatus,
    (v) => v === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Тип бизнеса' });
      required(p.businessInn, { message: 'ИНН ИП' });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus);
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education);
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, { message: 'Необходимо согласие на ПД' });
  required(path.agreeCreditHistory, { message: 'Необходимо согласие на КИ' });
  required(path.agreeTerms, { message: 'Необходимо согласие с условиями' });
  required(path.confirmAccuracy, { message: 'Необходимо подтвердить точность' });
  required(path.electronicSignature, { message: 'Введите код из СМС' });
};

const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

// =====================================================================
// Behavior — computed fields
// =====================================================================

function annuityMonthly(principal: number, months: number, ratePct: number): number {
  if (!principal || !months || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  return Math.round((principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
}

function baseRateForLoan(loanType: LoanType): number {
  switch (loanType) {
    case 'mortgage':
      return 9.5;
    case 'car':
      return 12;
    case 'consumer':
      return 18;
    case 'business':
      return 14;
    case 'refinance':
      return 10;
    default:
      return 15;
  }
}

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' ')
  );

  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => {
      if (!personalData.birthDate) return null;
      const d = new Date(personalData.birthDate);
      if (Number.isNaN(d.getTime())) return null;
      const now = new Date();
      let years = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
      return years;
    }
  );

  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  computeFrom(
    [path.loanType, path.hasProperty],
    path.interestRate,
    ({ loanType, hasProperty }: CreditApplicationForm) => {
      let rate = baseRateForLoan(loanType);
      if (hasProperty) rate -= 0.5;
      return rate;
    }
  );

  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0)
  );

  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!totalIncome || totalIncome <= 0) return 0;
      return Math.round(((monthlyPayment ?? 0) / totalIncome) * 100);
    }
  );

  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue ? Math.round(propertyValue * 0.2) : null
  );
};

// =====================================================================
// FormRoot — closure-injected via componentProps
// =====================================================================

interface FormRootProps {
  form: FormProxy<CreditApplicationForm>;
  activeStep: number;
  children: RenderNode<CreditApplicationForm>[];
}

function FormRoot({ form, activeStep, children }: FormRootProps) {
  // The schema's children are step containers in order; we render only the active one.
  const idx = activeStep - 1;
  const node = children[idx];
  if (!node) return null;
  return <RenderNodeComponent node={node} form={form} />;
}
(FormRoot as any).__selfManagedChildren = true;

// =====================================================================
// Registry
// =====================================================================

const registry = defineRegistry((reg) => {
  reg.field('Input', Input);
  reg.field('Select', Select);
  reg.field('Textarea', Textarea);
  reg.field('Checkbox', Checkbox);
  reg.container('Section', Section);
  reg.container('Box', Box);
  reg.container('FormRoot', FormRoot as any);
  reg.container(FIELD_WRAPPER, FormField);
  reg.source('LOAN_TYPES', LOAN_TYPES);
  reg.source('GENDERS', GENDERS);
  reg.source('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
  reg.source('MARITAL_STATUSES', MARITAL_STATUSES);
  reg.source('EDUCATION_LEVELS', EDUCATION_LEVELS);
});

const jsonSchema = jsonSchemaRaw as JsonFormSchema;

// =====================================================================
// Page
// =====================================================================

const TOTAL_STEPS = 6;

export default function MccaRendererJsonV12Page() {
  const form = useMemo(
    () =>
      createForm<CreditApplicationForm>({
        form: formSchema,
        validation: fullValidation,
        behavior,
      }),
    []
  );

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<CreditApplicationForm | null>(null);

  // Build RenderSchemaFn that injects form + step into FormRoot's componentProps.
  const renderSchema = useMemo(() => {
    const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(
      jsonSchema,
      registry
    );
    const factory: RenderSchemaFn<CreditApplicationForm> = (path) => {
      const baseRoot = baseFn(path);
      return {
        ...baseRoot,
        componentProps: {
          ...((baseRoot as any).componentProps ?? {}),
          form,
          activeStep: step,
        },
      };
    };
    return createRenderSchema<CreditApplicationForm>(factory);
  }, [form, step]);

  // Hide/unhide conditional sub-blocks based on values.
  useEffect(() => {
    const update = () => {
      const loanType = form.loanType.value.value;
      const employmentStatus = form.employmentStatus.value.value;
      const sameAsReg = form.sameAsRegistration.value.value;
      try {
        renderSchema.node('mortgage-block').setHidden(loanType !== 'mortgage');
      } catch {
        /* node may not exist on early renders */
      }
      try {
        renderSchema.node('car-block').setHidden(loanType !== 'car');
      } catch {
        /* noop */
      }
      try {
        renderSchema.node('employed-block').setHidden(employmentStatus !== 'employed');
      } catch {
        /* noop */
      }
      try {
        renderSchema
          .node('self-employed-block')
          .setHidden(employmentStatus !== 'selfEmployed');
      } catch {
        /* noop */
      }
      try {
        renderSchema.node('residence-block').setHidden(sameAsReg === true);
      } catch {
        /* noop */
      }
    };
    update();
    const unsubLoan = form.loanType.value.subscribe(update);
    const unsubEmp = form.employmentStatus.value.subscribe(update);
    const unsubSame = form.sameAsRegistration.value.subscribe(update);
    return () => {
      unsubLoan?.();
      unsubEmp?.();
      unsubSame?.();
    };
  }, [renderSchema, form]);

  const handleNext = async () => {
    const v = STEP_VALIDATIONS[step];
    const ok = await validateForm(form, v);
    if (!ok) {
      form.markAsTouched();
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    form.markAsTouched();
    await form.validate();
    if (!form.valid.value) return;
    const data = form.getValue();
    setSubmittedData(data);
    setSubmitted(true);
    console.log('Credit application submitted', data);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6" data-testid="success-screen">
        <h1 className="text-2xl font-bold">Заявка отправлена</h1>
        <p className="text-gray-600">
          Спасибо! Ваша заявка принята в обработку.
        </p>
        <pre className="overflow-auto rounded bg-gray-100 p-4 text-xs" data-testid="submitted-json">
          {JSON.stringify(submittedData, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">
        Заявка на кредит — renderer-json (v12)
      </h1>
      <div className="text-sm text-gray-500" data-testid="step-indicator">
        Шаг {step} из {TOTAL_STEPS}
      </div>
      <FormRenderer
        render={renderSchema}
        settings={{ fieldWrapper: FormField as any }}
      />
      <div className="flex gap-2 border-t pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={handleBack}
          disabled={step === 1}
          data-testid="prev-button"
        >
          Назад
        </Button>
        {step < TOTAL_STEPS ? (
          <Button type="button" onClick={handleNext} data-testid="next-button">
            Далее
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} data-testid="submit-button">
            Отправить
          </Button>
        )}
      </div>
    </div>
  );
}

