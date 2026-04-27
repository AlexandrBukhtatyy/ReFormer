/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Credit application form schema (renderer-react v2 — page 2).
 *
 * Mirrors page 1 (mcp-credit-application-v2) but built independently per
 * sub-agent protocol. Form definition uses ui-kit components + Tailwind.
 *
 * `any` is required for validation/behavior callbacks (TS2589 workaround
 * documented in MCP add-validation/add-behavior preambles for deeply nested
 * step-grouped forms).
 *
 * NOTE on `createForm` cast: the generic of `createForm` is the *form fields*
 * type; for a deeply-nested form it's easiest to cast the function once and
 * then keep full type-safety on the returned `FormProxy<CreditApplicationForm>`.
 */
import { createForm, type FormProxy, type ValidationSchemaFn } from '@reformer/core';
import { copyFrom, enableWhen, watchField } from '@reformer/core/behaviors';
import {
  apply,
  applyWhen,
  email,
  max,
  maxLength,
  min,
  minLength,
  notEmpty,
  required,
  validateItems,
} from '@reformer/core/validators';
import { Checkbox, Input, InputMask, RadioGroup, Select, Textarea } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';

const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_OPTIONS = [
  { value: 'single', label: 'Не женат / не замужем' },
  { value: 'married', label: 'Женат / замужем' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

const EDUCATION_OPTIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Другое' },
];

/* -----------------------------------------------------------------
 * Helpers used by computed fields.
 * ----------------------------------------------------------------- */

const CURRENT_YEAR = new Date().getFullYear();

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const ts = Date.parse(birthDate);
  if (Number.isNaN(ts)) return null;
  const diff = Date.now() - ts;
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 0 ? years : null;
}

function calcMonthlyPayment(
  principal: number | null,
  termMonths: number | null,
  annualRatePct: number | null
): number | null {
  if (!principal || !termMonths || !annualRatePct || termMonths <= 0) return null;
  const i = annualRatePct / 100 / 12;
  if (i <= 0) return Math.round(principal / termMonths);
  const pow = Math.pow(1 + i, termMonths);
  return Math.round((principal * (i * pow)) / (pow - 1));
}

function calcInterestRate(loanType: string, hasProperty: boolean): number {
  const base: Record<string, number> = {
    consumer: 17,
    mortgage: 9,
    car: 12,
    business: 14,
    refinancing: 11,
  };
  let rate = base[loanType] ?? 17;
  if (hasProperty) rate -= 0.5;
  return Math.max(rate, 5);
}

/* -----------------------------------------------------------------
 * Per-step validation schemas (used by wizard for "next" gate).
 *
 * Each step's validation is a `ValidationSchemaFn<CreditApplicationForm>`.
 * The wizard calls `validateForm(form, STEP_VALIDATIONS[currentStep])`
 * and only advances when it resolves `true`.
 *
 * The full schema below in `validation:` simply composes all six.
 * ----------------------------------------------------------------- */

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step1.loanType);
  required(path.step1.loanAmount);
  min(path.step1.loanAmount, 50_000);
  max(path.step1.loanAmount, 10_000_000);
  required(path.step1.loanTerm);
  min(path.step1.loanTerm, 6);
  max(path.step1.loanTerm, 240);
  required(path.step1.loanPurpose);
  minLength(path.step1.loanPurpose, 10);
  maxLength(path.step1.loanPurpose, 500);

  applyWhen(
    path.step1.loanType,
    (v: string) => v === 'mortgage',
    (p: any) => {
      required(p.step1.propertyValue);
      min(p.step1.propertyValue, 1_000_000);
    }
  );
  applyWhen(
    path.step1.loanType,
    (v: string) => v === 'car',
    (p: any) => {
      required(p.step1.carBrand);
      minLength(p.step1.carBrand, 2);
      maxLength(p.step1.carBrand, 50);
      required(p.step1.carModel);
      minLength(p.step1.carModel, 1);
      maxLength(p.step1.carModel, 50);
      required(p.step1.carYear);
      min(p.step1.carYear, 2000);
      max(p.step1.carYear, CURRENT_YEAR + 1);
      required(p.step1.carPrice);
      min(p.step1.carPrice, 300_000);
      max(p.step1.carPrice, 10_000_000);
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step2.personalData.lastName);
  required(path.step2.personalData.firstName);
  required(path.step2.personalData.middleName);
  required(path.step2.personalData.birthDate);
  required(path.step2.personalData.gender);
  required(path.step2.personalData.birthPlace);
  required(path.step2.passportData.series);
  required(path.step2.passportData.number);
  required(path.step2.passportData.issueDate);
  required(path.step2.passportData.issuedBy);
  required(path.step2.passportData.departmentCode);
  required(path.step2.inn);
  required(path.step2.snils);
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step3.phoneMain);
  required(path.step3.email);
  email(path.step3.email);
  required(path.step3.registrationAddress.region);
  required(path.step3.registrationAddress.city);
  required(path.step3.registrationAddress.street);
  required(path.step3.registrationAddress.house);
  required(path.step3.registrationAddress.postalCode);
  applyWhen(
    path.step3.sameAsRegistration,
    (v: boolean) => v === false,
    (p: any) => {
      required(p.step3.residenceAddress.region);
      required(p.step3.residenceAddress.city);
      required(p.step3.residenceAddress.street);
      required(p.step3.residenceAddress.house);
      required(p.step3.residenceAddress.postalCode);
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step4.employmentStatus);
  required(path.step4.workExperienceTotal);
  min(path.step4.workExperienceTotal, 0);
  required(path.step4.workExperienceCurrent);
  min(path.step4.workExperienceCurrent, 0);
  required(path.step4.monthlyIncome);
  min(path.step4.monthlyIncome, 10_000);
  applyWhen(
    path.step4.employmentStatus,
    (v: string) => v === 'employed',
    (p: any) => {
      required(p.step4.companyName);
      required(p.step4.companyInn);
      required(p.step4.companyPhone);
      required(p.step4.companyAddress);
      required(p.step4.position);
    }
  );
  applyWhen(
    path.step4.employmentStatus,
    (v: string) => v === 'selfEmployed',
    (p: any) => {
      required(p.step4.businessType);
      required(p.step4.businessInn);
      required(p.step4.businessActivity);
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step5.maritalStatus);
  required(path.step5.dependents);
  min(path.step5.dependents, 0);
  max(path.step5.dependents, 10);
  required(path.step5.education);

  applyWhen(
    path.step5.hasProperty,
    (v: boolean) => v === true,
    (p: any) => {
      notEmpty(p.step5.properties, { message: 'Добавьте хотя бы один объект имущества' });
      validateItems(p.step5.properties, (ip: any) => {
        required(ip.type);
        required(ip.description);
        required(ip.estimatedValue);
        min(ip.estimatedValue, 0);
      });
    }
  );
  applyWhen(
    path.step5.hasExistingLoans,
    (v: boolean) => v === true,
    (p: any) => {
      notEmpty(p.step5.existingLoans, { message: 'Добавьте хотя бы один кредит' });
      validateItems(p.step5.existingLoans, (ip: any) => {
        required(ip.bank);
        required(ip.type);
        required(ip.amount);
        min(ip.amount, 0);
        required(ip.remainingAmount);
        min(ip.remainingAmount, 0);
        required(ip.monthlyPayment);
        min(ip.monthlyPayment, 0);
        required(ip.maturityDate);
      });
    }
  );
  applyWhen(
    path.step5.hasCoBorrower,
    (v: boolean) => v === true,
    (p: any) => {
      notEmpty(p.step5.coBorrowers, { message: 'Добавьте хотя бы одного созаемщика' });
      validateItems(p.step5.coBorrowers, (ip: any) => {
        required(ip.phone);
        required(ip.email);
        email(ip.email);
        required(ip.relationship);
        required(ip.monthlyIncome);
        min(ip.monthlyIncome, 0);
      });
    }
  );
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step6.agreePersonalData, { message: 'Необходимо согласие' });
  required(path.step6.agreeCreditHistory, { message: 'Необходимо согласие' });
  required(path.step6.agreeTerms, { message: 'Необходимо согласие' });
  required(path.step6.confirmAccuracy, { message: 'Необходимо подтвердить точность данных' });
  required(path.step6.electronicSignature);
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

/* -----------------------------------------------------------------
 * Array item template factories — used by FormArray.AddButton in
 * render-schema.tsx to push a new item with the correct shape.
 *
 * IMPORTANT: `array.push(value)` (the underlying op of `FormArray.AddButton`)
 * expects PLAIN VALUES, not FieldConfig objects. The schema (with `value`,
 * `component`, `componentProps`) was already declared once in
 * `creditApplicationForm.form.step5.{properties|existingLoans|coBorrowers}[0]`;
 * each new item inherits that schema and only needs the initial values for
 * its fields.
 * ----------------------------------------------------------------- */

export const propertyTemplate = () => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const existingLoanTemplate = () => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const coBorrowerTemplate = () => ({
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

/* -----------------------------------------------------------------
 * Form definition.
 * ----------------------------------------------------------------- */

export const creditApplicationForm: FormProxy<CreditApplicationForm> = (
  createForm as (config: {
    form: unknown;
    validation: unknown;
    behavior: unknown;
  }) => FormProxy<CreditApplicationForm>
)({
  form: {
    step1: {
      loanType: {
        value: 'consumer',
        component: Select,
        componentProps: {
          label: 'Тип кредита',
          placeholder: 'Выберите тип кредита',
          options: LOAN_TYPE_OPTIONS,
        },
      },
      loanAmount: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Сумма кредита (₽)',
          placeholder: 'Введите сумму',
          type: 'number',
          step: 10000,
          min: 0,
        },
      },
      loanTerm: {
        value: 12,
        component: Input,
        componentProps: {
          label: 'Срок кредита (месяцев)',
          placeholder: 'Введите срок',
          type: 'number',
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
          placeholder: 'Введите стоимость',
          type: 'number',
          min: 0,
        },
      },
      initialPayment: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Первоначальный взнос (₽)',
          placeholder: 'Авто-расчёт',
          type: 'number',
          min: 0,
          disabled: true,
        },
      },
      carBrand: {
        value: null,
        component: Input,
        componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
      },
      carModel: {
        value: null,
        component: Input,
        componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
      },
      carYear: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Год выпуска',
          placeholder: '2020',
          type: 'number',
          min: 0,
        },
      },
      carPrice: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Стоимость автомобиля (₽)',
          placeholder: 'Введите стоимость',
          type: 'number',
          min: 0,
        },
      },
      interestRate: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Процентная ставка (%)',
          placeholder: 'Авто-расчёт',
          type: 'number',
          disabled: true,
        },
      },
      monthlyPayment: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Ежемесячный платёж (₽)',
          placeholder: 'Авто-расчёт',
          type: 'number',
          disabled: true,
        },
      },
    },
    step2: {
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
          componentProps: { label: 'Пол', options: GENDER_OPTIONS, className: '!flex-row gap-6' },
        },
        birthPlace: {
          value: '',
          component: Input,
          componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
        },
      },
      passportData: {
        series: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Серия паспорта', mask: '99 99', placeholder: '12 34' },
        },
        number: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Номер паспорта', mask: '999999', placeholder: '123456' },
        },
        issueDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Дата выдачи', type: 'text', placeholder: 'YYYY-MM-DD' },
        },
        issuedBy: {
          value: '',
          component: Input,
          componentProps: { label: 'Кем выдан', placeholder: 'Введите название органа' },
        },
        departmentCode: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Код подразделения', mask: '999-999', placeholder: '123-456' },
        },
      },
      inn: {
        value: '',
        component: InputMask,
        componentProps: { label: 'ИНН', mask: '999999999999', placeholder: '123456789012' },
      },
      snils: {
        value: '',
        component: InputMask,
        componentProps: { label: 'СНИЛС', mask: '999-999-999 99', placeholder: '123-456-789 00' },
      },
      fullName: {
        value: '',
        component: Input,
        componentProps: { label: 'Полное имя', placeholder: 'Авто-расчёт', disabled: true },
      },
      age: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Возраст (лет)',
          placeholder: 'Авто-расчёт',
          type: 'number',
          disabled: true,
        },
      },
    },
    step3: {
      phoneMain: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Основной телефон',
          mask: '+7 (999) 999-99-99',
          placeholder: '+7 (___) ___-__-__',
        },
      },
      phoneAdditional: {
        value: null,
        component: InputMask,
        componentProps: {
          label: 'Дополнительный телефон',
          mask: '+7 (999) 999-99-99',
          placeholder: '+7 (___) ___-__-__',
        },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
      },
      emailAdditional: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Дополнительный email',
          type: 'email',
          placeholder: 'example@mail.com',
        },
      },
      registrationAddress: {
        region: {
          value: '',
          component: Input,
          componentProps: { label: 'Регион', placeholder: 'Введите регион' },
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
        house: {
          value: '',
          component: Input,
          componentProps: { label: 'Дом', placeholder: '№' },
        },
        apartment: {
          value: '',
          component: Input,
          componentProps: { label: 'Квартира', placeholder: '№' },
        },
        postalCode: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000' },
        },
      },
      sameAsRegistration: {
        value: true,
        component: Checkbox,
        componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
      },
      residenceAddress: {
        region: { value: '', component: Input, componentProps: { label: 'Регион (проживание)' } },
        city: { value: '', component: Input, componentProps: { label: 'Город (проживание)' } },
        street: { value: '', component: Input, componentProps: { label: 'Улица (проживание)' } },
        house: { value: '', component: Input, componentProps: { label: 'Дом (проживание)' } },
        apartment: {
          value: '',
          component: Input,
          componentProps: { label: 'Квартира (проживание)' },
        },
        postalCode: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Индекс (проживание)', mask: '999999', placeholder: '000000' },
        },
      },
    },
    step4: {
      employmentStatus: {
        value: 'employed',
        component: RadioGroup,
        componentProps: { label: 'Статус занятости', options: EMPLOYMENT_OPTIONS },
      },
      companyName: {
        value: null,
        component: Input,
        componentProps: { label: 'Название компании', placeholder: 'Введите название' },
      },
      companyInn: {
        value: null,
        component: InputMask,
        componentProps: { label: 'ИНН компании', mask: '9999999999', placeholder: '1234567890' },
      },
      companyPhone: {
        value: null,
        component: InputMask,
        componentProps: {
          label: 'Телефон компании',
          mask: '+7 (999) 999-99-99',
          placeholder: '+7 (___) ___-__-__',
        },
      },
      companyAddress: {
        value: null,
        component: Input,
        componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
      },
      position: {
        value: null,
        component: Input,
        componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
      },
      workExperienceTotal: {
        value: null,
        component: Input,
        componentProps: { label: 'Общий стаж (мес.)', type: 'number', min: 0, placeholder: '0' },
      },
      workExperienceCurrent: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Стаж на текущем месте (мес.)',
          type: 'number',
          min: 0,
          placeholder: '0',
        },
      },
      monthlyIncome: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Ежемесячный доход (₽)',
          type: 'number',
          min: 0,
          placeholder: '0',
        },
      },
      additionalIncome: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Дополнительный доход (₽)',
          type: 'number',
          min: 0,
          placeholder: '0',
        },
      },
      additionalIncomeSource: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Источник дополнительного дохода',
          placeholder: 'Опишите источник',
        },
      },
      businessType: {
        value: null,
        component: Input,
        componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
      },
      businessInn: {
        value: null,
        component: InputMask,
        componentProps: { label: 'ИНН ИП', mask: '999999999999', placeholder: '123456789012' },
      },
      businessActivity: {
        value: null,
        component: Textarea,
        componentProps: {
          label: 'Вид деятельности',
          placeholder: 'Опишите вид деятельности',
          rows: 3,
        },
      },
      totalIncome: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Общий доход (₽)',
          placeholder: 'Авто-расчёт',
          type: 'number',
          disabled: true,
        },
      },
      paymentToIncomeRatio: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Платёж к доходу (%)',
          placeholder: 'Авто-расчёт',
          type: 'number',
          disabled: true,
        },
      },
    },
    step5: {
      maritalStatus: {
        value: 'single',
        component: RadioGroup,
        componentProps: { label: 'Семейное положение', options: MARITAL_OPTIONS },
      },
      dependents: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Количество иждивенцев',
          type: 'number',
          min: 0,
          placeholder: '0',
        },
      },
      education: {
        value: 'higher',
        component: Select,
        componentProps: {
          label: 'Образование',
          placeholder: 'Выберите уровень образования',
          options: EDUCATION_OPTIONS,
        },
      },
      hasProperty: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'У меня есть имущество' },
      },
      properties: [
        {
          type: {
            value: 'apartment',
            component: Select,
            componentProps: {
              label: 'Тип имущества',
              placeholder: 'Выберите тип',
              options: PROPERTY_TYPE_OPTIONS,
            },
          },
          description: {
            value: '',
            component: Textarea,
            componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
          },
          estimatedValue: {
            value: 0,
            component: Input,
            componentProps: {
              label: 'Оценочная стоимость (₽)',
              type: 'number',
              min: 0,
              placeholder: '0',
            },
          },
          hasEncumbrance: {
            value: false,
            component: Checkbox,
            componentProps: { label: 'Имеется обременение (залог)' },
          },
        },
      ],
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
          type: {
            value: '',
            component: Input,
            componentProps: { label: 'Тип кредита', placeholder: 'Тип кредита' },
          },
          amount: {
            value: 0,
            component: Input,
            componentProps: { label: 'Сумма кредита', type: 'number', min: 0, placeholder: '0' },
          },
          remainingAmount: {
            value: 0,
            component: Input,
            componentProps: {
              label: 'Остаток задолженности',
              type: 'number',
              min: 0,
              placeholder: '0',
            },
          },
          monthlyPayment: {
            value: 0,
            component: Input,
            componentProps: {
              label: 'Ежемесячный платёж',
              type: 'number',
              min: 0,
              placeholder: '0',
            },
          },
          maturityDate: {
            value: '',
            component: Input,
            componentProps: { label: 'Дата погашения', type: 'text', placeholder: 'YYYY-MM-DD' },
          },
        },
      ],
      hasCoBorrower: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Добавить созаемщика' },
      },
      coBorrowers: [
        {
          personalData: {
            lastName: {
              value: '',
              component: Input,
              componentProps: { label: 'Фамилия' },
            },
            firstName: {
              value: '',
              component: Input,
              componentProps: { label: 'Имя' },
            },
            middleName: {
              value: '',
              component: Input,
              componentProps: { label: 'Отчество' },
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
                label: 'Пол',
                options: GENDER_OPTIONS,
                className: '!flex-row gap-6',
              },
            },
            birthPlace: {
              value: '',
              component: Input,
              componentProps: { label: 'Место рождения' },
            },
          },
          phone: {
            value: '',
            component: InputMask,
            componentProps: {
              label: 'Телефон',
              mask: '+7 (999) 999-99-99',
              placeholder: '+7 (___) ___-__-__',
            },
          },
          email: {
            value: '',
            component: Input,
            componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
          },
          relationship: {
            value: '',
            component: Input,
            componentProps: { label: 'Родство', placeholder: 'Укажите родство' },
          },
          monthlyIncome: {
            value: 0,
            component: Input,
            componentProps: {
              label: 'Ежемесячный доход',
              type: 'number',
              min: 0,
              placeholder: '0',
            },
          },
        },
      ],
      coBorrowersIncome: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Доход созаемщиков (₽)',
          placeholder: 'Авто-расчёт',
          type: 'number',
          disabled: true,
        },
      },
    },
    step6: {
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
        componentProps: { label: 'Подтверждаю точность введённых данных' },
      },
      electronicSignature: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Код подтверждения из СМС',
          mask: '999999',
          placeholder: '123456',
        },
      },
    },
  },

  /* -----------------------------------------------------------------
   * Validation.
   * ----------------------------------------------------------------- */

  validation: (path: any) => {
    // Compose all six per-step validators (extracted above as STEP_VALIDATIONS).
    step1Validation(path);
    step2Validation(path);
    step3Validation(path);
    step4Validation(path);
    step5Validation(path);
    step6Validation(path);
    void apply;
  },

  /* -----------------------------------------------------------------
   * Behavior.
   * ----------------------------------------------------------------- */

  behavior: (path: any) => {
    // Conditional fields — mortgage / car branches.
    enableWhen(
      path.step1.propertyValue,
      (form: CreditApplicationForm) => form.step1.loanType === 'mortgage',
      {
        resetOnDisable: true,
      }
    );
    enableWhen(
      path.step1.initialPayment,
      (form: CreditApplicationForm) => form.step1.loanType === 'mortgage',
      {
        resetOnDisable: true,
      }
    );
    enableWhen(
      path.step1.carBrand,
      (form: CreditApplicationForm) => form.step1.loanType === 'car',
      {
        resetOnDisable: true,
      }
    );
    enableWhen(
      path.step1.carModel,
      (form: CreditApplicationForm) => form.step1.loanType === 'car',
      {
        resetOnDisable: true,
      }
    );
    enableWhen(path.step1.carYear, (form: CreditApplicationForm) => form.step1.loanType === 'car', {
      resetOnDisable: true,
    });
    enableWhen(
      path.step1.carPrice,
      (form: CreditApplicationForm) => form.step1.loanType === 'car',
      {
        resetOnDisable: true,
      }
    );

    // Employment branches.
    const isEmployed = (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed';
    const isSelfEmployed = (form: CreditApplicationForm) =>
      form.step4.employmentStatus === 'selfEmployed';
    enableWhen(path.step4.companyName, isEmployed, { resetOnDisable: true });
    enableWhen(path.step4.companyInn, isEmployed, { resetOnDisable: true });
    enableWhen(path.step4.companyPhone, isEmployed, { resetOnDisable: true });
    enableWhen(path.step4.companyAddress, isEmployed, { resetOnDisable: true });
    enableWhen(path.step4.position, isEmployed, { resetOnDisable: true });
    enableWhen(path.step4.businessType, isSelfEmployed, { resetOnDisable: true });
    enableWhen(path.step4.businessInn, isSelfEmployed, { resetOnDisable: true });
    enableWhen(path.step4.businessActivity, isSelfEmployed, { resetOnDisable: true });

    // Residence address — copy when same, enable for editing when different.
    // NOTE: avoid resetOnDisable on a whole GroupNode if it would cascade — leave fields enabled,
    // copyFrom is the only mechanism.
    copyFrom(path.step3.registrationAddress, path.step3.residenceAddress, {
      when: (form: CreditApplicationForm) => form.step3.sameAsRegistration === true,
    });

    /* ---------- Computed: initialPayment = 20% of propertyValue (mortgage) ---------- */
    watchField(
      path.step1.propertyValue,
      (val: number | null, ctx: { form: FormProxy<CreditApplicationForm> }) => {
        if (ctx.form.step1.loanType.getValue() !== 'mortgage') return;
        const next = val == null ? null : Math.round(val * 0.2);
        if (ctx.form.step1.initialPayment.getValue() !== next) {
          ctx.form.step1.initialPayment.setValue(next);
        }
      },
      { immediate: false }
    );

    /* ---------- Computed: interestRate (loanType + hasProperty) ---------- */
    const recomputeInterestRate = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
      const loanType = ctx.form.step1.loanType.getValue();
      const hasProperty = ctx.form.step5.hasProperty.getValue();
      const next = calcInterestRate(loanType ?? 'consumer', !!hasProperty);
      if (ctx.form.step1.interestRate.getValue() !== next) {
        ctx.form.step1.interestRate.setValue(next);
      }
    };
    watchField(path.step1.loanType, (_v: unknown, ctx: any) => recomputeInterestRate(ctx), {
      immediate: false,
    });
    watchField(path.step5.hasProperty, (_v: unknown, ctx: any) => recomputeInterestRate(ctx), {
      immediate: false,
    });

    /* ---------- Computed: monthlyPayment from amount + term + rate ---------- */
    const recomputeMonthly = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
      const principal = ctx.form.step1.loanAmount.getValue();
      const term = ctx.form.step1.loanTerm.getValue();
      const rate = ctx.form.step1.interestRate.getValue();
      const next = calcMonthlyPayment(principal, term, rate);
      if (ctx.form.step1.monthlyPayment.getValue() !== next) {
        ctx.form.step1.monthlyPayment.setValue(next);
      }
    };
    watchField(path.step1.loanAmount, (_v: unknown, ctx: any) => recomputeMonthly(ctx), {
      immediate: false,
    });
    watchField(path.step1.loanTerm, (_v: unknown, ctx: any) => recomputeMonthly(ctx), {
      immediate: false,
    });
    watchField(path.step1.interestRate, (_v: unknown, ctx: any) => recomputeMonthly(ctx), {
      immediate: false,
    });

    /* ---------- Computed: fullName (FIO concat) ---------- */
    const recomputeFullName = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
      const ln = ctx.form.step2.personalData.lastName.getValue() ?? '';
      const fn = ctx.form.step2.personalData.firstName.getValue() ?? '';
      const mn = ctx.form.step2.personalData.middleName.getValue() ?? '';
      const next = [ln, fn, mn].filter(Boolean).join(' ');
      if (ctx.form.step2.fullName.getValue() !== next) {
        ctx.form.step2.fullName.setValue(next);
      }
    };
    watchField(
      path.step2.personalData.lastName,
      (_v: unknown, ctx: any) => recomputeFullName(ctx),
      {
        immediate: false,
      }
    );
    watchField(
      path.step2.personalData.firstName,
      (_v: unknown, ctx: any) => recomputeFullName(ctx),
      {
        immediate: false,
      }
    );
    watchField(
      path.step2.personalData.middleName,
      (_v: unknown, ctx: any) => recomputeFullName(ctx),
      {
        immediate: false,
      }
    );

    /* ---------- Computed: age from birthDate ---------- */
    watchField(
      path.step2.personalData.birthDate,
      (val: string | null, ctx: any) => {
        const next = calcAge(val);
        if (ctx.form.step2.age.getValue() !== next) {
          ctx.form.step2.age.setValue(next);
        }
      },
      { immediate: false }
    );

    /* ---------- Computed: totalIncome = monthly + additional ---------- */
    const recomputeTotalIncome = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
      const m = ctx.form.step4.monthlyIncome.getValue() ?? 0;
      const a = ctx.form.step4.additionalIncome.getValue() ?? 0;
      const next = (m ?? 0) + (a ?? 0);
      if (ctx.form.step4.totalIncome.getValue() !== next) {
        ctx.form.step4.totalIncome.setValue(next);
      }
    };
    watchField(path.step4.monthlyIncome, (_v: unknown, ctx: any) => recomputeTotalIncome(ctx), {
      immediate: false,
    });
    watchField(path.step4.additionalIncome, (_v: unknown, ctx: any) => recomputeTotalIncome(ctx), {
      immediate: false,
    });

    /* ---------- Computed: paymentToIncomeRatio ---------- */
    const recomputePtir = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
      const mp = ctx.form.step1.monthlyPayment.getValue();
      const ti = ctx.form.step4.totalIncome.getValue();
      let next: number | null = null;
      if (mp != null && ti != null && ti > 0) {
        next = Math.round((mp / ti) * 1000) / 10;
      }
      if (ctx.form.step4.paymentToIncomeRatio.getValue() !== next) {
        ctx.form.step4.paymentToIncomeRatio.setValue(next);
      }
    };
    watchField(path.step1.monthlyPayment, (_v: unknown, ctx: any) => recomputePtir(ctx), {
      immediate: false,
    });
    watchField(path.step4.totalIncome, (_v: unknown, ctx: any) => recomputePtir(ctx), {
      immediate: false,
    });

    /* ---------- Computed: coBorrowersIncome = sum(coBorrowers[].monthlyIncome) ---------- */
    watchField(
      path.step5.coBorrowers,
      (items: unknown, ctx: any) => {
        const arr = Array.isArray(items) ? (items as Array<{ monthlyIncome?: number | null }>) : [];
        const sum = arr.reduce((acc, b) => acc + (b?.monthlyIncome ?? 0), 0);
        const next = sum > 0 ? sum : null;
        if (ctx.form.step5.coBorrowersIncome.getValue() !== next) {
          ctx.form.step5.coBorrowersIncome.setValue(next);
        }
      },
      { immediate: false }
    );
  },
});
