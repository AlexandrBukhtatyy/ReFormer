/**
 * Credit Application Form — clean baseline implementation (target=renderer-json).
 *
 * Composition:
 * - createForm<T> builds the runtime form (FieldConfig schema, behavior, validation).
 * - schema.json describes the layout with FormWizard as root render-node.
 * - JsonFormApp wraps closure-pattern boilerplate (FormRoot + createRenderSchemaFromJson).
 *
 * Source: @reformer/renderer-json cookbook recipe `json-form-app`.
 */

import { useMemo, type ComponentType, type ReactNode } from 'react';
import {
  createForm,
  type FormProxy,
  type FormSchema,
  type FieldConfig,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email as emailValidator,
  applyWhen,
} from '@reformer/core/validators';
import { computeFrom, copyFrom, enableWhen } from '@reformer/core/behaviors';
import {
  Input,
  InputMask,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  Box,
  Section,
  FormField,
  Button,
} from '@reformer/ui-kit';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import {
  FormRenderer,
  RenderNodeComponent,
  createRenderSchema,
  type RenderNode,
} from '@reformer/renderer-react';
import {
  defineRegistry,
  createRenderSchemaFromJson,
  FIELD_WRAPPER,
  type RegistryBuilder,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import jsonSchemaRaw from './schema.json';

// ---------------------------------------------------------------------------
// Types — `type`, not `interface`, so they satisfy FormFields constraint.
// ---------------------------------------------------------------------------

type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
type Gender = 'male' | 'female';
type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
type PropertyType = 'apartment' | 'house' | 'land' | 'car' | 'other';

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

type Address = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

type Property = {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
};

type ExistingLoan = {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
};

type CoBorrower = {
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

type CreditApplicationForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number | null;
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
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
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
  education: Education;
  hasProperty: boolean;
  properties: Property[];
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
  interestRate: number | null;
  monthlyPayment: number | null;
  fullName: string;
  age: number | null;
  totalIncome: number | null;
  paymentToIncomeRatio: number | null;
  coBorrowersIncome: number | null;
};

// ---------------------------------------------------------------------------
// Constants (option lists)
// ---------------------------------------------------------------------------

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
  { value: 'selfEmployed', label: 'Самозанятый / ИП' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_STATUSES = [
  { value: 'single', label: 'Не женат / не замужем' },
  { value: 'married', label: 'Женат / замужем' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

const EDUCATIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Учёная степень' },
];

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Другое' },
];

// ---------------------------------------------------------------------------
// Form schema (FieldConfig per field)
// ---------------------------------------------------------------------------

function makePersonalData(): FormSchema<PersonalData> {
  return {
    lastName: { value: '', component: Input, componentProps: { testId: 'personalData-lastName' } },
    firstName: {
      value: '',
      component: Input,
      componentProps: { testId: 'personalData-firstName' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { testId: 'personalData-middleName' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { type: 'date', testId: 'personalData-birthDate' },
    },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: { options: GENDERS, testId: 'personalData-gender' },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { testId: 'personalData-birthPlace' },
    },
  };
}

function makeAddress(prefix: string): FormSchema<Address> {
  return {
    region: { value: '', component: Input, componentProps: { testId: `${prefix}-region` } },
    city: { value: '', component: Input, componentProps: { testId: `${prefix}-city` } },
    street: { value: '', component: Input, componentProps: { testId: `${prefix}-street` } },
    house: { value: '', component: Input, componentProps: { testId: `${prefix}-house` } },
    apartment: { value: '', component: Input, componentProps: { testId: `${prefix}-apartment` } },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { mask: '999999', testId: `${prefix}-postalCode` },
    },
  };
}

function createCreditApplicationForm() {
  const schema: FormSchema<CreditApplicationForm> = {
    // Step 1
    loanType: {
      value: 'consumer',
      component: Select,
      componentProps: { options: LOAN_TYPES, testId: 'loanType' },
    } satisfies FieldConfig<LoanType>,
    loanAmount: {
      value: null,
      component: Input,
      componentProps: { type: 'number', testId: 'loanAmount' },
    },
    loanTerm: {
      value: 12,
      component: Input,
      componentProps: { type: 'number', testId: 'loanTerm' },
    },
    loanPurpose: { value: '', component: Textarea, componentProps: { testId: 'loanPurpose' } },
    propertyValue: {
      value: null,
      component: Input,
      componentProps: { type: 'number', testId: 'propertyValue' },
    },
    initialPayment: {
      value: null,
      component: Input,
      componentProps: { type: 'number', disabled: true, testId: 'initialPayment' },
    },
    carBrand: { value: null, component: Input, componentProps: { testId: 'carBrand' } },
    carModel: { value: null, component: Input, componentProps: { testId: 'carModel' } },
    carYear: {
      value: null,
      component: Input,
      componentProps: { type: 'number', testId: 'carYear' },
    },
    carPrice: {
      value: null,
      component: Input,
      componentProps: { type: 'number', testId: 'carPrice' },
    },
    // Step 2
    personalData: makePersonalData(),
    passportData: {
      series: {
        value: '',
        component: InputMask,
        componentProps: { mask: '99 99', testId: 'passportData-series' },
      },
      number: {
        value: '',
        component: InputMask,
        componentProps: { mask: '999999', testId: 'passportData-number' },
      },
      issueDate: {
        value: '',
        component: Input,
        componentProps: { type: 'date', testId: 'passportData-issueDate' },
      },
      issuedBy: {
        value: '',
        component: Input,
        componentProps: { testId: 'passportData-issuedBy' },
      },
      departmentCode: {
        value: '',
        component: InputMask,
        componentProps: { mask: '999-999', testId: 'passportData-departmentCode' },
      },
    },
    inn: {
      value: '',
      component: InputMask,
      componentProps: { mask: '999999999999', testId: 'inn' },
    },
    snils: {
      value: '',
      component: InputMask,
      componentProps: { mask: '999-999-999 99', testId: 'snils' },
    },
    // Step 3
    phoneMain: {
      value: '',
      component: InputMask,
      componentProps: { mask: '+7 (999) 999-99-99', testId: 'phoneMain' },
    },
    phoneAdditional: {
      value: null,
      component: InputMask,
      componentProps: { mask: '+7 (999) 999-99-99', testId: 'phoneAdditional' },
    },
    email: { value: '', component: Input, componentProps: { type: 'email', testId: 'email' } },
    emailAdditional: {
      value: null,
      component: Input,
      componentProps: { type: 'email', testId: 'emailAdditional' },
    },
    registrationAddress: makeAddress('registrationAddress'),
    sameAsRegistration: {
      value: true,
      component: Checkbox,
      componentProps: { testId: 'sameAsRegistration' },
    },
    residenceAddress: makeAddress('residenceAddress'),
    // Step 4
    employmentStatus: {
      value: 'employed',
      component: RadioGroup,
      componentProps: { options: EMPLOYMENT_STATUSES, testId: 'employmentStatus' },
    } satisfies FieldConfig<EmploymentStatus>,
    companyName: { value: null, component: Input, componentProps: { testId: 'companyName' } },
    companyInn: {
      value: null,
      component: InputMask,
      componentProps: { mask: '9999999999', testId: 'companyInn' },
    },
    companyPhone: {
      value: null,
      component: InputMask,
      componentProps: { mask: '+7 (999) 999-99-99', testId: 'companyPhone' },
    },
    companyAddress: {
      value: null,
      component: Input,
      componentProps: { testId: 'companyAddress' },
    },
    position: { value: null, component: Input, componentProps: { testId: 'position' } },
    workExperienceTotal: {
      value: null,
      component: Input,
      componentProps: { type: 'number', testId: 'workExperienceTotal' },
    },
    workExperienceCurrent: {
      value: null,
      component: Input,
      componentProps: { type: 'number', testId: 'workExperienceCurrent' },
    },
    monthlyIncome: {
      value: null,
      component: Input,
      componentProps: { type: 'number', testId: 'monthlyIncome' },
    },
    additionalIncome: {
      value: null,
      component: Input,
      componentProps: { type: 'number', testId: 'additionalIncome' },
    },
    additionalIncomeSource: {
      value: null,
      component: Input,
      componentProps: { testId: 'additionalIncomeSource' },
    },
    businessType: { value: null, component: Input, componentProps: { testId: 'businessType' } },
    businessInn: {
      value: null,
      component: InputMask,
      componentProps: { mask: '999999999999', testId: 'businessInn' },
    },
    businessActivity: {
      value: null,
      component: Textarea,
      componentProps: { testId: 'businessActivity' },
    },
    // Step 5
    maritalStatus: {
      value: 'single',
      component: RadioGroup,
      componentProps: { options: MARITAL_STATUSES, testId: 'maritalStatus' },
    } satisfies FieldConfig<MaritalStatus>,
    dependents: {
      value: 0,
      component: Input,
      componentProps: { type: 'number', testId: 'dependents' },
    },
    education: {
      value: 'higher',
      component: Select,
      componentProps: { options: EDUCATIONS, testId: 'education' },
    } satisfies FieldConfig<Education>,
    hasProperty: { value: false, component: Checkbox, componentProps: { testId: 'hasProperty' } },
    properties: [
      {
        type: {
          value: 'apartment',
          component: Select,
          componentProps: { options: PROPERTY_TYPES, testId: 'type' },
        } satisfies FieldConfig<PropertyType>,
        description: { value: '', component: Textarea, componentProps: { testId: 'description' } },
        estimatedValue: {
          value: 0,
          component: Input,
          componentProps: { type: 'number', testId: 'estimatedValue' },
        },
        hasEncumbrance: {
          value: false,
          component: Checkbox,
          componentProps: { testId: 'hasEncumbrance' },
        },
      },
    ],
    hasExistingLoans: {
      value: false,
      component: Checkbox,
      componentProps: { testId: 'hasExistingLoans' },
    },
    existingLoans: [
      {
        bank: { value: '', component: Input, componentProps: { testId: 'bank' } },
        type: { value: '', component: Input, componentProps: { testId: 'type' } },
        amount: {
          value: 0,
          component: Input,
          componentProps: { type: 'number', testId: 'amount' },
        },
        remainingAmount: {
          value: 0,
          component: Input,
          componentProps: { type: 'number', testId: 'remainingAmount' },
        },
        monthlyPayment: {
          value: 0,
          component: Input,
          componentProps: { type: 'number', testId: 'monthlyPayment' },
        },
        maturityDate: {
          value: '',
          component: Input,
          componentProps: { type: 'date', testId: 'maturityDate' },
        },
      },
    ],
    hasCoBorrower: {
      value: false,
      component: Checkbox,
      componentProps: { testId: 'hasCoBorrower' },
    },
    coBorrowers: [
      {
        personalData: makePersonalData(),
        phone: {
          value: '',
          component: InputMask,
          componentProps: { mask: '+7 (999) 999-99-99', testId: 'phone' },
        },
        email: { value: '', component: Input, componentProps: { type: 'email', testId: 'email' } },
        relationship: { value: '', component: Input, componentProps: { testId: 'relationship' } },
        monthlyIncome: {
          value: 0,
          component: Input,
          componentProps: { type: 'number', testId: 'monthlyIncome' },
        },
      },
    ],
    // Step 6
    agreePersonalData: {
      value: false,
      component: Checkbox,
      componentProps: { testId: 'agreePersonalData' },
    },
    agreeCreditHistory: {
      value: false,
      component: Checkbox,
      componentProps: { testId: 'agreeCreditHistory' },
    },
    agreeMarketing: {
      value: false,
      component: Checkbox,
      componentProps: { testId: 'agreeMarketing' },
    },
    agreeTerms: { value: false, component: Checkbox, componentProps: { testId: 'agreeTerms' } },
    confirmAccuracy: {
      value: false,
      component: Checkbox,
      componentProps: { testId: 'confirmAccuracy' },
    },
    electronicSignature: {
      value: '',
      component: InputMask,
      componentProps: { mask: '999999', testId: 'electronicSignature' },
    },
    // Computed
    interestRate: {
      value: null,
      component: Input,
      componentProps: { type: 'number', disabled: true, testId: 'interestRate' },
    },
    monthlyPayment: {
      value: null,
      component: Input,
      componentProps: { type: 'number', disabled: true, testId: 'monthlyPayment' },
    },
    fullName: {
      value: '',
      component: Input,
      componentProps: { disabled: true, testId: 'fullName' },
    },
    age: {
      value: null,
      component: Input,
      componentProps: { type: 'number', disabled: true, testId: 'age' },
    },
    totalIncome: {
      value: null,
      component: Input,
      componentProps: { type: 'number', disabled: true, testId: 'totalIncome' },
    },
    paymentToIncomeRatio: {
      value: null,
      component: Input,
      componentProps: { type: 'number', disabled: true, testId: 'paymentToIncomeRatio' },
    },
    coBorrowersIncome: {
      value: null,
      component: Input,
      componentProps: { type: 'number', disabled: true, testId: 'coBorrowersIncome' },
    },
  };

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
    required(path.loanType);
    required(path.loanAmount);
    min(path.loanAmount, 50000);
    max(path.loanAmount, 10000000);
    required(path.loanTerm);
    min(path.loanTerm, 6);
    max(path.loanTerm, 240);
    required(path.loanPurpose);
    minLength(path.loanPurpose, 10);
    maxLength(path.loanPurpose, 500);

    applyWhen(
      path.loanType,
      (loanType) => loanType === 'mortgage',
      (p) => {
        required(p.propertyValue);
        min(p.propertyValue, 1000000);
      }
    );

    applyWhen(
      path.loanType,
      (loanType) => loanType === 'car',
      (p) => {
        required(p.carBrand);
        minLength(p.carBrand, 2);
        maxLength(p.carBrand, 50);
        required(p.carModel);
        minLength(p.carModel, 1);
        maxLength(p.carModel, 50);
        required(p.carYear);
        min(p.carYear, 2000);
        max(p.carYear, new Date().getFullYear() + 1);
        required(p.carPrice);
        min(p.carPrice, 300000);
        max(p.carPrice, 10000000);
      }
    );
  };

  const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
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
    required(path.snils);
  };

  const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
    required(path.phoneMain);
    required(path.email);
    emailValidator(path.email);
    required(path.registrationAddress.region);
    required(path.registrationAddress.city);
    required(path.registrationAddress.street);
    required(path.registrationAddress.house);
    required(path.registrationAddress.postalCode);
  };

  const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
    required(path.workExperienceTotal);
    min(path.workExperienceTotal, 0);
    required(path.workExperienceCurrent);
    min(path.workExperienceCurrent, 0);
    required(path.monthlyIncome);
    min(path.monthlyIncome, 10000);

    applyWhen(
      path.employmentStatus,
      (status) => status === 'employed',
      (p) => {
        required(p.companyName);
        required(p.companyInn);
        required(p.position);
      }
    );

    applyWhen(
      path.employmentStatus,
      (status) => status === 'selfEmployed',
      (p) => {
        required(p.businessType);
        required(p.businessInn);
      }
    );
  };

  const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
    required(path.maritalStatus);
    required(path.dependents);
    min(path.dependents, 0);
    max(path.dependents, 10);
    required(path.education);
  };

  const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
    required(path.agreePersonalData, { message: 'Необходимо согласие на обработку данных' });
    required(path.agreeCreditHistory, {
      message: 'Необходимо согласие на проверку кредитной истории',
    });
    required(path.agreeTerms, { message: 'Необходимо согласие с условиями кредитования' });
    required(path.confirmAccuracy, { message: 'Необходимо подтвердить точность данных' });
    required(path.electronicSignature);
    minLength(path.electronicSignature, 6);
  };

  const stepValidations: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
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

  // -------------------------------------------------------------------------
  // Behavior — computed fields, conditional enable, copy logic
  // -------------------------------------------------------------------------

  const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
    // Conditional fields per loanType
    enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
      resetOnDisable: true,
    });
    enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
      resetOnDisable: true,
    });
    enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
    enableWhen(path.carModel, (form) => form.loanType === 'car', { resetOnDisable: true });
    enableWhen(path.carYear, (form) => form.loanType === 'car', { resetOnDisable: true });
    enableWhen(path.carPrice, (form) => form.loanType === 'car', { resetOnDisable: true });

    // Conditional fields per employmentStatus
    enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
      resetOnDisable: true,
    });
    enableWhen(path.companyInn, (form) => form.employmentStatus === 'employed', {
      resetOnDisable: true,
    });
    enableWhen(path.companyPhone, (form) => form.employmentStatus === 'employed', {
      resetOnDisable: true,
    });
    enableWhen(path.companyAddress, (form) => form.employmentStatus === 'employed', {
      resetOnDisable: true,
    });
    enableWhen(path.position, (form) => form.employmentStatus === 'employed', {
      resetOnDisable: true,
    });
    enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
      resetOnDisable: true,
    });
    enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
      resetOnDisable: true,
    });
    enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed', {
      resetOnDisable: true,
    });

    // Residence address: enabled when not equal to registration
    enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
      resetOnDisable: true,
    });

    // Copy registration → residence when checkbox is on
    copyFrom(path.registrationAddress, path.residenceAddress, {
      when: (form) => form.sameAsRegistration === true,
    });

    // Computed: full name
    computeFrom([path.personalData], path.fullName, ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' ')
    );

    // Computed: age from birth date
    computeFrom([path.personalData], path.age, ({ personalData }: CreditApplicationForm) => {
      const birth = personalData.birthDate;
      if (!birth) return null;
      const dob = new Date(birth);
      if (Number.isNaN(dob.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      return age;
    });

    // Computed: total income
    computeFrom(
      [path.monthlyIncome, path.additionalIncome],
      path.totalIncome,
      ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
        (monthlyIncome ?? 0) + (additionalIncome ?? 0)
    );

    // Computed: interest rate (depends on loanType, region, hasProperty)
    computeFrom(
      [path.loanType, path.registrationAddress, path.hasProperty],
      path.interestRate,
      ({ loanType, hasProperty }: CreditApplicationForm) => {
        const baseRates: Record<LoanType, number> = {
          consumer: 14,
          mortgage: 8,
          car: 10,
          business: 13,
          refinance: 11,
        };
        let rate = baseRates[loanType] ?? 14;
        if (hasProperty) rate -= 0.5;
        return rate;
      }
    );

    // Computed: monthly payment (annuity)
    computeFrom(
      [path.loanAmount, path.loanTerm, path.interestRate],
      path.monthlyPayment,
      ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) => {
        if (!loanAmount || !loanTerm || !interestRate) return null;
        const r = interestRate / 100 / 12;
        const n = loanTerm;
        return Math.round((loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
      }
    );

    // Computed: initial payment for mortgage = 20% of property value
    computeFrom(
      [path.propertyValue],
      path.initialPayment,
      ({ propertyValue }: CreditApplicationForm) =>
        propertyValue ? Math.round(propertyValue * 0.2) : null
    );

    // Computed: payment to income ratio
    computeFrom(
      [path.monthlyPayment, path.totalIncome],
      path.paymentToIncomeRatio,
      ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
        if (!monthlyPayment || !totalIncome) return null;
        return Math.round((monthlyPayment / totalIncome) * 100);
      }
    );

    // Computed: co-borrowers income (sum)
    computeFrom(
      [path.coBorrowers],
      path.coBorrowersIncome,
      ({ coBorrowers }: CreditApplicationForm) =>
        coBorrowers.reduce((acc, b) => acc + (b.monthlyIncome ?? 0), 0)
    );
  };

  const form = createForm<CreditApplicationForm>({
    form: schema,
    validation: fullValidation,
    behavior,
  });

  return { form, stepValidations, fullValidation };
}

// ---------------------------------------------------------------------------
// Closure-pattern wrapper (per cookbook recipe `json-form-app`)
// ---------------------------------------------------------------------------

function FormRoot<T>({
  form,
  children,
}: {
  form: FormProxy<T>;
  children?: RenderNode<T>[];
}): ReactNode {
  return (
    <>
      {children?.map((node, i) => (
        <RenderNodeComponent key={i} node={node} form={form} />
      ))}
    </>
  );
}
(FormRoot as unknown as { __selfManagedChildren: boolean }).__selfManagedChildren = true;

// ---------------------------------------------------------------------------
// Initial-value templates for FormArraySection.AddButton
// ---------------------------------------------------------------------------

const propertyInitial = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

const existingLoanInitial = (): ExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

const coBorrowerInitial = (): CoBorrower => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

// ---------------------------------------------------------------------------
// Wizard step shape (declared at module scope — used by registry source)
// ---------------------------------------------------------------------------

const STEPS_TEMPLATE: FormWizardStep<CreditApplicationForm>[] = []; // populated lazily per render

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const MOCK_DATA: Partial<CreditApplicationForm> = {
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры',
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-05-15',
    gender: 'male',
    birthPlace: 'г. Москва',
  },
  passportData: {
    series: '4509',
    number: '123456',
    issueDate: '2010-06-20',
    issuedBy: 'ОУФМС России по г. Москве',
    departmentCode: '770-001',
  },
  inn: '770401234567',
  snils: '12345678901',
  phoneMain: '+7 (901) 123-45-67',
  phoneAdditional: '',
  email: 'ivanov@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '12',
    apartment: '34',
    postalCode: '125009',
  },
  sameAsRegistration: true,
  employmentStatus: 'employed',
  companyName: 'ООО Тестовая Компания',
  companyInn: '7704567890',
  companyPhone: '+7 (495) 123-45-67',
  companyAddress: 'г. Москва, ул. Ленина, 1',
  position: 'Старший разработчик',
  workExperienceTotal: 8,
  workExperienceCurrent: 3,
  monthlyIncome: 150000,
  additionalIncome: 0,
  additionalIncomeSource: '',
  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  hasProperty: false,
  hasExistingLoans: false,
  hasCoBorrower: false,
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: false,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: 'Иванов И.И.',
};

export default function CreditApplicationFormRendererJsonClean() {
  const { form, stepValidations, fullValidation } = useMemo(() => {
    const created = createCreditApplicationForm();
    created.form.patchValue(MOCK_DATA);
    return created;
  }, []);

  const handleSubmit = async () => {
    form.markAsTouched();
    await form.validate();
    if (!form.valid.value) return;
    const payload = form.getValue();
    // eslint-disable-next-line no-alert
    alert('Заявка отправлена.\n\n' + JSON.stringify(payload, null, 2).slice(0, 1500));
  };

  const wizardConfig = useMemo(
    () => ({ stepValidations, fullValidation }),
    [stepValidations, fullValidation]
  );

  const buildRegistry = (reg: RegistryBuilder) => {
    // ui-kit fields
    reg.field('Input', Input);
    reg.field('InputMask', InputMask);
    reg.field('Textarea', Textarea);
    reg.field('Select', Select);
    reg.field('Checkbox', Checkbox);
    reg.field('RadioGroup', RadioGroup);

    // ui-kit containers
    reg.container('Box', Box);
    reg.container('Section', Section);
    reg.container('Button', Button);
    reg.container(FIELD_WRAPPER, FormField);

    // FormArraySection (handles control: string → ArrayNode and $template → FC)
    reg.container('FormArraySection', FormArraySection as unknown as ComponentType<unknown>);

    // FormWizard (root render-node)
    reg.container('FormWizard', FormWizard as unknown as ComponentType<unknown>);

    // Form-root closure container
    reg.container('FormRoot', FormRoot as ComponentType<unknown>);

    // Sources (option lists, computed values)
    reg.source('LOAN_TYPES', LOAN_TYPES);
    reg.source('GENDERS', GENDERS);
    reg.source('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.source('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.source('EDUCATIONS', EDUCATIONS);
    reg.source('PROPERTY_TYPES', PROPERTY_TYPES);
    reg.source('CURRENT_YEAR_PLUS_ONE', new Date().getFullYear() + 1);

    // Wizard config + handlers
    reg.source('WIZARD_CONFIG', wizardConfig);
    reg.source('WIZARD_SUBMIT', handleSubmit);

    // Form proxy (for FormRoot.componentProps.form)
    reg.source('FORM', form);

    // Initial-value templates for FormArraySection
    reg.source('PROPERTY_INITIAL', propertyInitial());
    reg.source('EXISTING_LOAN_INITIAL', existingLoanInitial());
    reg.source('CO_BORROWER_INITIAL', coBorrowerInitial());
  };

  const registry = useMemo(
    () => defineRegistry(buildRegistry),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const renderSchema = useMemo(() => {
    const fn = createRenderSchemaFromJson<CreditApplicationForm>(
      jsonSchemaRaw as JsonFormSchema,
      registry
    );
    return createRenderSchema<CreditApplicationForm>(fn);
  }, [registry]);

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Заявка на кредит (renderer-json — clean)</h2>
      <FormRenderer render={renderSchema} settings={{ fieldWrapper: FormField }} />
      <p className="hidden">{STEPS_TEMPLATE.length}</p>
    </div>
  );
}
