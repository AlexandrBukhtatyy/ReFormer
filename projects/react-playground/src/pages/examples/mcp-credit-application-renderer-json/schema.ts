import { createForm } from '@reformer/core';
import type { FormProxy, ValidationSchemaFn } from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email,
  pattern,
  validate,
  applyWhen,
  validateItems,
} from '@reformer/core/validators';
import { enableWhen, copyFrom, watchField } from '@reformer/core/behaviors';
import { Input, Textarea, Select, Checkbox } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';

// Noop placeholder — real component binding happens via the JSON registry.
// We still need a valid component reference to satisfy FieldConfig.
const Noop = Input;

// ── Address sub-schema factory ─────────────────────────────────────────────────

const addressSchema = () => ({
  region: { value: '', component: Input },
  city: { value: '', component: Input },
  street: { value: '', component: Input },
  house: { value: '', component: Input },
  apartment: { value: '', component: Input },
  postalCode: { value: '', component: Input },
});

// ── PersonalData sub-schema factory ───────────────────────────────────────────

const personalDataSchema = () => ({
  lastName: { value: '', component: Input },
  firstName: { value: '', component: Input },
  middleName: { value: '', component: Input },
  birthDate: { value: '', component: Input },
  gender: { value: 'male', component: Select },
  birthPlace: { value: '', component: Input },
});

// ── Property array item template ──────────────────────────────────────────────

const propertyItemSchema = {
  type: { value: 'apartment', component: Select },
  description: { value: '', component: Textarea },
  estimatedValue: { value: 0, component: Input },
  hasEncumbrance: { value: false, component: Checkbox },
};

// ── ExistingLoan array item template ──────────────────────────────────────────

const existingLoanItemSchema = {
  bank: { value: '', component: Input },
  type: { value: '', component: Input },
  amount: { value: 0, component: Input },
  remainingAmount: { value: 0, component: Input },
  monthlyPayment: { value: 0, component: Input },
  maturityDate: { value: '', component: Input },
};

// ── CoBorrower array item template ────────────────────────────────────────────

const coBorrowerItemSchema = {
  personalData: personalDataSchema(),
  phone: { value: '', component: Input },
  email: { value: '', component: Input },
  relationship: { value: '', component: Input },
  monthlyIncome: { value: 0, component: Input },
};

// ── Per-step validation functions ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step1.loanType, { message: 'Выберите тип кредита' });
  required(path.step1.loanAmount, { message: 'Введите сумму кредита' });
  min(path.step1.loanAmount, 50000, { message: 'Минимальная сумма — 50 000 ₽' });
  max(path.step1.loanAmount, 10000000, { message: 'Максимальная сумма — 10 000 000 ₽' });
  required(path.step1.loanTerm, { message: 'Введите срок кредита' });
  min(path.step1.loanTerm, 6, { message: 'Минимальный срок — 6 месяцев' });
  max(path.step1.loanTerm, 240, { message: 'Максимальный срок — 240 месяцев' });
  required(path.step1.loanPurpose, { message: 'Укажите цель кредита' });
  minLength(path.step1.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.step1.loanPurpose, 500, { message: 'Максимум 500 символов' });

  // applyWhen #1 — Mortgage fields
  applyWhen(
    path.step1.loanType,
    (type: string) => type === 'mortgage',
    (p: typeof path) => {
      required(p.step1.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.step1.propertyValue, 1000000, { message: 'Минимальная стоимость — 1 000 000 ₽' });
      required(p.step1.initialPayment, { message: 'Введите первоначальный взнос' });
      validate(p.step1.initialPayment, (value, ctx) => {
        const propVal = ctx.form.step1.propertyValue.value.value as number | null;
        if (propVal != null && value != null) {
          const minPayment = propVal * 0.2;
          if ((value as number) < minPayment) {
            return {
              code: 'initial-payment-too-low',
              message: `Первоначальный взнос должен быть не менее 20% от стоимости (${minPayment.toLocaleString('ru-RU')} ₽)`,
            };
          }
        }
        return null;
      });
    }
  );

  // applyWhen #2 — Car fields
  applyWhen(
    path.step1.loanType,
    (type: string) => type === 'car',
    (p: typeof path) => {
      required(p.step1.carBrand, { message: 'Укажите марку автомобиля' });
      minLength(p.step1.carBrand, 2, { message: 'Минимум 2 символа' });
      maxLength(p.step1.carBrand, 50, { message: 'Максимум 50 символов' });
      required(p.step1.carModel, { message: 'Укажите модель автомобиля' });
      minLength(p.step1.carModel, 1, { message: 'Минимум 1 символ' });
      maxLength(p.step1.carModel, 50, { message: 'Максимум 50 символов' });
      required(p.step1.carYear, { message: 'Укажите год выпуска' });
      min(p.step1.carYear, 2000, { message: 'Год не ранее 2000' });
      max(p.step1.carYear, new Date().getFullYear() + 1, {
        message: `Год не позднее ${new Date().getFullYear() + 1}`,
      });
      required(p.step1.carPrice, { message: 'Введите стоимость автомобиля' });
      min(p.step1.carPrice, 300000, { message: 'Минимальная стоимость — 300 000 ₽' });
      max(p.step1.carPrice, 10000000, { message: 'Максимальная стоимость — 10 000 000 ₽' });
    }
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step2.personalData.lastName, { message: 'Введите фамилию' });
  required(path.step2.personalData.firstName, { message: 'Введите имя' });
  required(path.step2.personalData.middleName, { message: 'Введите отчество' });
  required(path.step2.personalData.birthDate, { message: 'Введите дату рождения' });
  required(path.step2.personalData.gender, { message: 'Выберите пол' });
  required(path.step2.personalData.birthPlace, { message: 'Введите место рождения' });

  required(path.step2.passportData.series, { message: 'Введите серию паспорта' });
  required(path.step2.passportData.number, { message: 'Введите номер паспорта' });
  required(path.step2.passportData.issueDate, { message: 'Введите дату выдачи' });
  required(path.step2.passportData.issuedBy, { message: 'Введите кем выдан' });
  required(path.step2.passportData.departmentCode, { message: 'Введите код подразделения' });

  required(path.step2.inn, { message: 'Введите ИНН' });
  pattern(path.step2.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
  // INN-12 checksum validation
  validate(path.step2.inn, (value) => {
    if (!value || typeof value !== 'string') return null;
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 12) return null;
    const d = digits.split('').map(Number);
    const n11 =
      ((7 * d[0] +
        2 * d[1] +
        4 * d[2] +
        10 * d[3] +
        3 * d[4] +
        5 * d[5] +
        9 * d[6] +
        4 * d[7] +
        6 * d[8] +
        8 * d[9]) %
        11) %
      10;
    const n12 =
      ((3 * d[0] +
        7 * d[1] +
        2 * d[2] +
        4 * d[3] +
        10 * d[4] +
        3 * d[5] +
        5 * d[6] +
        9 * d[7] +
        4 * d[8] +
        6 * d[9] +
        8 * d[10]) %
        11) %
      10;
    if (d[10] !== n11 || d[11] !== n12) {
      return { code: 'inn-checksum', message: 'Неверная контрольная сумма ИНН' };
    }
    return null;
  });

  required(path.step2.snils, { message: 'Введите СНИЛС' });
  pattern(path.step2.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, {
    message: 'СНИЛС должен быть в формате 123-456-789 00',
  });
  // SNILS checksum validation
  validate(path.step2.snils, (value) => {
    if (!value || typeof value !== 'string') return null;
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 11) return null;
    const num = parseInt(digits.slice(0, 9), 10);
    if (num <= 1001998) return null; // special cases not validated
    const d = digits.slice(0, 9).split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += d[i] * (9 - i);
    }
    const checksum = (sum % 101) % 100;
    const controlDigits = parseInt(digits.slice(9), 10);
    if (checksum !== controlDigits) {
      return { code: 'snils-checksum', message: 'Неверная контрольная сумма СНИЛС' };
    }
    return null;
  });

  // Age cross-check: 18–70 years
  validate(path.step2.personalData.birthDate, (value) => {
    if (!value || typeof value !== 'string') return null;
    const birth = new Date(value);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    const age =
      now.getFullYear() -
      birth.getFullYear() -
      (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    if (age < 18) {
      return { code: 'age-too-young', message: 'Заемщик должен быть не моложе 18 лет' };
    }
    if (age > 70) {
      return { code: 'age-too-old', message: 'Заемщик должен быть не старше 70 лет' };
    }
    return null;
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step3.phoneMain, { message: 'Введите основной телефон' });
  required(path.step3.email, { message: 'Введите email' });
  email(path.step3.email, { message: 'Введите корректный email' });

  required(path.step3.registrationAddress.region, { message: 'Введите регион' });
  required(path.step3.registrationAddress.city, { message: 'Введите город' });
  required(path.step3.registrationAddress.street, { message: 'Введите улицу' });
  required(path.step3.registrationAddress.house, { message: 'Введите номер дома' });
  required(path.step3.registrationAddress.postalCode, { message: 'Введите почтовый индекс' });
  pattern(path.step3.registrationAddress.postalCode, /^\d{6}$/, {
    message: 'Индекс должен содержать 6 цифр',
  });

  // applyWhen #3 — Residence address (when different from registration)
  applyWhen(
    path.step3.sameAsRegistration,
    (same: boolean) => same === false,
    (p: typeof path) => {
      required(p.step3.residenceAddress.region, { message: 'Введите регион проживания' });
      required(p.step3.residenceAddress.city, { message: 'Введите город проживания' });
      required(p.step3.residenceAddress.street, { message: 'Введите улицу проживания' });
      required(p.step3.residenceAddress.house, { message: 'Введите номер дома проживания' });
      required(p.step3.residenceAddress.postalCode, {
        message: 'Введите индекс адреса проживания',
      });
      pattern(p.step3.residenceAddress.postalCode, /^\d{6}$/, {
        message: 'Индекс должен содержать 6 цифр',
      });
    }
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step4.employmentStatus, { message: 'Выберите статус занятости' });
  required(path.step4.workExperienceTotal, { message: 'Введите общий стаж' });
  min(path.step4.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.step4.workExperienceCurrent, { message: 'Введите стаж на текущем месте' });
  min(path.step4.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });

  // Work experience consistency cross-check
  validate(path.step4.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.step4.workExperienceTotal.value.value as number | null;
    if (total != null && value != null && (value as number) > total) {
      return {
        code: 'experience-mismatch',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      };
    }
    return null;
  });

  required(path.step4.monthlyIncome, { message: 'Введите ежемесячный доход' });
  min(path.step4.monthlyIncome, 10000, { message: 'Минимальный доход — 10 000 ₽' });

  // applyWhen #4 — Employed fields
  applyWhen(
    path.step4.employmentStatus,
    (status: string) => status === 'employed',
    (p: typeof path) => {
      required(p.step4.companyName, { message: 'Введите название компании' });
      required(p.step4.companyInn, { message: 'Введите ИНН компании' });
      pattern(p.step4.companyInn, /^\d{10}$/, {
        message: 'ИНН компании должен содержать 10 цифр',
      });
      required(p.step4.companyPhone, { message: 'Введите телефон компании' });
      required(p.step4.companyAddress, { message: 'Введите адрес компании' });
      required(p.step4.position, { message: 'Введите должность' });
    }
  );

  // applyWhen #5 — Self-employed fields
  applyWhen(
    path.step4.employmentStatus,
    (status: string) => status === 'selfEmployed',
    (p: typeof path) => {
      required(p.step4.businessType, { message: 'Укажите тип бизнеса' });
      required(p.step4.businessInn, { message: 'Введите ИНН ИП' });
      pattern(p.step4.businessInn, /^\d{12}$/, { message: 'ИНН ИП должен содержать 12 цифр' });
      required(p.step4.businessActivity, { message: 'Опишите вид деятельности' });
    }
  );

  // applyWhen #6 — Additional income source required when income > 0
  applyWhen(
    path.step4.additionalIncome,
    (income: number | null) => income != null && (income as number) > 0,
    (p: typeof path) => {
      required(p.step4.additionalIncomeSource, {
        message: 'Укажите источник дополнительного дохода',
      });
    }
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  required(path.step5.maritalStatus, { message: 'Выберите семейное положение' });
  required(path.step5.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.step5.dependents, 0, { message: 'Количество иждивенцев не может быть отрицательным' });
  max(path.step5.dependents, 10, { message: 'Максимум 10 иждивенцев' });
  required(path.step5.education, { message: 'Выберите уровень образования' });

  // validateItems #1 — properties array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateItems(path.step5.properties, (itemPath: any) => {
    required(itemPath.type, { message: 'Выберите тип имущества' });
    required(itemPath.description, { message: 'Опишите имущество' });
    required(itemPath.estimatedValue, { message: 'Введите оценочную стоимость' });
    min(itemPath.estimatedValue, 0, { message: 'Стоимость не может быть отрицательной' });
  });

  // validateItems #2 — existingLoans array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateItems(path.step5.existingLoans, (itemPath: any) => {
    required(itemPath.bank, { message: 'Введите название банка' });
    required(itemPath.type, { message: 'Введите тип кредита' });
    required(itemPath.amount, { message: 'Введите сумму кредита' });
    min(itemPath.amount, 0, { message: 'Сумма не может быть отрицательной' });
    required(itemPath.remainingAmount, { message: 'Введите остаток задолженности' });
    min(itemPath.remainingAmount, 0, { message: 'Остаток не может быть отрицательным' });
    // remaining <= amount cross-check
    validate(itemPath.remainingAmount, (value, ctx) => {
      const amount = ctx.form.amount?.value?.value as number | undefined;
      if (amount != null && value != null && (value as number) > amount) {
        return {
          code: 'remaining-exceeds-amount',
          message: 'Остаток задолженности не может превышать сумму кредита',
        };
      }
      return null;
    });
    required(itemPath.monthlyPayment, { message: 'Введите ежемесячный платеж' });
    min(itemPath.monthlyPayment, 0, { message: 'Платеж не может быть отрицательным' });
    required(itemPath.maturityDate, { message: 'Введите дату погашения' });
  });

  // validateItems #3 — coBorrowers array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateItems(path.step5.coBorrowers, (itemPath: any) => {
    required(itemPath.personalData.lastName, { message: 'Введите фамилию созаемщика' });
    required(itemPath.personalData.firstName, { message: 'Введите имя созаемщика' });
    required(itemPath.personalData.middleName, { message: 'Введите отчество созаемщика' });
    required(itemPath.personalData.birthDate, { message: 'Введите дату рождения созаемщика' });
    required(itemPath.personalData.gender, { message: 'Выберите пол созаемщика' });
    required(itemPath.personalData.birthPlace, { message: 'Введите место рождения созаемщика' });
    required(itemPath.phone, { message: 'Введите телефон созаемщика' });
    required(itemPath.email, { message: 'Введите email созаемщика' });
    email(itemPath.email, { message: 'Введите корректный email созаемщика' });
    required(itemPath.relationship, { message: 'Укажите степень родства' });
    required(itemPath.monthlyIncome, { message: 'Введите ежемесячный доход созаемщика' });
    min(itemPath.monthlyIncome, 0, { message: 'Доход не может быть отрицательным' });
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  validate(path.step6.agreePersonalData, (value) => {
    if (value !== true) {
      return {
        code: 'agreement-required',
        message: 'Необходимо согласие на обработку персональных данных',
      };
    }
    return null;
  });

  validate(path.step6.agreeCreditHistory, (value) => {
    if (value !== true) {
      return {
        code: 'agreement-required',
        message: 'Необходимо согласие на проверку кредитной истории',
      };
    }
    return null;
  });

  validate(path.step6.agreeTerms, (value) => {
    if (value !== true) {
      return {
        code: 'agreement-required',
        message: 'Необходимо согласие с условиями кредитования',
      };
    }
    return null;
  });

  validate(path.step6.confirmAccuracy, (value) => {
    if (value !== true) {
      return {
        code: 'agreement-required',
        message: 'Необходимо подтвердить точность введенных данных',
      };
    }
    return null;
  });

  required(path.step6.electronicSignature, { message: 'Введите код подтверждения из СМС' });
  pattern(path.step6.electronicSignature, /^\d{6}$/, {
    message: 'Код подтверждения должен содержать 6 цифр',
  });
};

// ── Full validation (all steps chained) ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path: any) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

// ── Per-step validation map ───────────────────────────────────────────────────

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

// ── Root form schema ──────────────────────────────────────────────────────────
// Cast pattern to avoid TS2589 (type instantiation excessively deep) on deeply
// nested schemas.

export const creditApplicationForm: FormProxy<CreditApplicationForm> = (
  createForm as (config: {
    form: unknown;
    validation: unknown;
    behavior: unknown;
  }) => FormProxy<CreditApplicationForm>
)({
  form: {
    // ── Root-level computed fields (Сводка) ──────────────────────────────────
    interestRate: { value: 0, component: Noop, disabled: true },
    monthlyPayment: { value: 0, component: Noop, disabled: true },
    totalIncome: { value: 0, component: Noop, disabled: true },
    paymentToIncomeRatio: { value: 0, component: Noop, disabled: true },
    age: { value: 0, component: Noop, disabled: true },
    fullName: { value: '', component: Noop, disabled: true },

    step1: {
      loanType: { value: 'consumer', component: Select },
      loanAmount: { value: null, component: Input },
      loanTerm: { value: 12, component: Input },
      loanPurpose: { value: '', component: Textarea },
      propertyValue: { value: null, component: Input },
      initialPayment: { value: null, component: Noop, disabled: true },
      carBrand: { value: null, component: Input },
      carModel: { value: null, component: Input },
      carYear: { value: null, component: Input },
      carPrice: { value: null, component: Input },
      interestRate: { value: null, component: Noop, disabled: true },
      monthlyPayment: { value: null, component: Noop, disabled: true },
    },
    step2: {
      personalData: personalDataSchema(),
      passportData: {
        series: { value: '', component: Input },
        number: { value: '', component: Input },
        issueDate: { value: '', component: Input },
        issuedBy: { value: '', component: Input },
        departmentCode: { value: '', component: Input },
      },
      inn: { value: '', component: Input },
      snils: { value: '', component: Input },
      fullName: { value: '', component: Noop, disabled: true },
      age: { value: null, component: Noop, disabled: true },
    },
    step3: {
      phoneMain: { value: '', component: Input },
      phoneAdditional: { value: null, component: Input },
      email: { value: '', component: Input },
      emailAdditional: { value: null, component: Input },
      registrationAddress: addressSchema(),
      sameAsRegistration: { value: true, component: Checkbox },
      residenceAddress: addressSchema(),
    },
    step4: {
      employmentStatus: { value: 'employed', component: Select },
      companyName: { value: null, component: Input },
      companyInn: { value: null, component: Input },
      companyPhone: { value: null, component: Input },
      companyAddress: { value: null, component: Input },
      position: { value: null, component: Input },
      workExperienceTotal: { value: null, component: Input },
      workExperienceCurrent: { value: null, component: Input },
      monthlyIncome: { value: null, component: Input },
      additionalIncome: { value: null, component: Input },
      additionalIncomeSource: { value: null, component: Input },
      businessType: { value: null, component: Input },
      businessInn: { value: null, component: Input },
      businessActivity: { value: null, component: Textarea },
      totalIncome: { value: null, component: Noop, disabled: true },
      paymentToIncomeRatio: { value: null, component: Noop, disabled: true },
    },
    step5: {
      maritalStatus: { value: 'single', component: Select },
      dependents: { value: 0, component: Input },
      education: { value: 'higher', component: Select },
      hasProperty: { value: false, component: Checkbox },
      properties: [propertyItemSchema],
      hasExistingLoans: { value: false, component: Checkbox },
      existingLoans: [existingLoanItemSchema],
      hasCoBorrower: { value: false, component: Checkbox },
      coBorrowers: [coBorrowerItemSchema],
      coBorrowersIncome: { value: null, component: Noop, disabled: true },
    },
    step6: {
      agreePersonalData: { value: false, component: Checkbox },
      agreeCreditHistory: { value: false, component: Checkbox },
      agreeMarketing: { value: false, component: Checkbox },
      agreeTerms: { value: false, component: Checkbox },
      confirmAccuracy: { value: false, component: Checkbox },
      electronicSignature: { value: '', component: Input },
    },
  },

  validation: fullValidation,

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  behavior: (path: any) => {
    // ── Step 1: enableWhen for mortgage-specific fields ──────────────────────
    enableWhen(
      path.step1.propertyValue,
      (form: CreditApplicationForm) => form.step1.loanType === 'mortgage',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step1.initialPayment,
      (form: CreditApplicationForm) => form.step1.loanType === 'mortgage',
      { resetOnDisable: true }
    );

    // ── Step 1: enableWhen for car-specific fields ───────────────────────────
    enableWhen(
      path.step1.carBrand,
      (form: CreditApplicationForm) => form.step1.loanType === 'car',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step1.carModel,
      (form: CreditApplicationForm) => form.step1.loanType === 'car',
      { resetOnDisable: true }
    );
    enableWhen(path.step1.carYear, (form: CreditApplicationForm) => form.step1.loanType === 'car', {
      resetOnDisable: true,
    });
    enableWhen(
      path.step1.carPrice,
      (form: CreditApplicationForm) => form.step1.loanType === 'car',
      { resetOnDisable: true }
    );

    // ── Step 4: enableWhen for employed-specific fields ──────────────────────
    enableWhen(
      path.step4.companyName,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.companyInn,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.companyPhone,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.companyAddress,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.position,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.workExperienceTotal,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.workExperienceCurrent,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.monthlyIncome,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'employed',
      { resetOnDisable: true }
    );

    // ── Step 4: enableWhen for selfEmployed-specific fields ──────────────────
    enableWhen(
      path.step4.businessType,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'selfEmployed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.businessInn,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'selfEmployed',
      { resetOnDisable: true }
    );
    enableWhen(
      path.step4.businessActivity,
      (form: CreditApplicationForm) => form.step4.employmentStatus === 'selfEmployed',
      { resetOnDisable: true }
    );

    // ── Step 4: enableWhen for additionalIncomeSource ────────────────────────
    enableWhen(
      path.step4.additionalIncomeSource,
      (form: CreditApplicationForm) =>
        form.step4.additionalIncome != null && (form.step4.additionalIncome as number) > 0,
      { resetOnDisable: true }
    );

    // ── Step 3: enableWhen + copyFrom for residenceAddress (sameAsRegistration) ──
    // Rule #8: NO enableWhen on ArrayNode — residenceAddress is a GroupNode, safe.
    enableWhen(
      path.step3.residenceAddress.region,
      (form: CreditApplicationForm) => form.step3.sameAsRegistration === false,
      { resetOnDisable: true }
    );
    enableWhen(
      path.step3.residenceAddress.city,
      (form: CreditApplicationForm) => form.step3.sameAsRegistration === false,
      { resetOnDisable: true }
    );
    enableWhen(
      path.step3.residenceAddress.street,
      (form: CreditApplicationForm) => form.step3.sameAsRegistration === false,
      { resetOnDisable: true }
    );
    enableWhen(
      path.step3.residenceAddress.house,
      (form: CreditApplicationForm) => form.step3.sameAsRegistration === false,
      { resetOnDisable: true }
    );
    enableWhen(
      path.step3.residenceAddress.apartment,
      (form: CreditApplicationForm) => form.step3.sameAsRegistration === false,
      { resetOnDisable: true }
    );
    enableWhen(
      path.step3.residenceAddress.postalCode,
      (form: CreditApplicationForm) => form.step3.sameAsRegistration === false,
      { resetOnDisable: true }
    );

    // copyFrom: registrationAddress → residenceAddress when sameAsRegistration=true
    copyFrom(path.step3.registrationAddress.region, path.step3.residenceAddress.region, {
      when: (form: CreditApplicationForm) => form.step3.sameAsRegistration === true,
    });
    copyFrom(path.step3.registrationAddress.city, path.step3.residenceAddress.city, {
      when: (form: CreditApplicationForm) => form.step3.sameAsRegistration === true,
    });
    copyFrom(path.step3.registrationAddress.street, path.step3.residenceAddress.street, {
      when: (form: CreditApplicationForm) => form.step3.sameAsRegistration === true,
    });
    copyFrom(path.step3.registrationAddress.house, path.step3.residenceAddress.house, {
      when: (form: CreditApplicationForm) => form.step3.sameAsRegistration === true,
    });
    copyFrom(path.step3.registrationAddress.apartment, path.step3.residenceAddress.apartment, {
      when: (form: CreditApplicationForm) => form.step3.sameAsRegistration === true,
    });
    copyFrom(path.step3.registrationAddress.postalCode, path.step3.residenceAddress.postalCode, {
      when: (form: CreditApplicationForm) => form.step3.sameAsRegistration === true,
    });

    // ── Stage 3b: computed root-level fields via watchField cascade ──────────

    // Shared compute function 1: interestRate + monthlyPayment + paymentToIncomeRatio
    const recomputeRateAndPayment = (ctx: { form: ReturnType<typeof creditApplicationForm> }) => {
      const loanType = ctx.form.step1.loanType.value.value as string;
      const loanAmount = (ctx.form.step1.loanAmount.value.value as number | null) ?? 0;
      const loanTerm = (ctx.form.step1.loanTerm.value.value as number) ?? 1;

      const rateMap: Record<string, number> = {
        mortgage: 8.5,
        car: 11,
        business: 14,
        refinancing: 9,
        consumer: 16,
      };
      const newRate = rateMap[loanType] ?? 16;

      // Annuity formula: P * i * (1+i)^n / ((1+i)^n - 1)
      const i = newRate / 100 / 12;
      const n = loanTerm > 0 ? loanTerm : 1;
      const newPayment =
        loanAmount > 0 && i > 0
          ? Math.round((loanAmount * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1))
          : 0;

      const curRate = ctx.form.interestRate.value.value as number;
      if (Math.abs(curRate - newRate) > 0.0001) {
        ctx.form.interestRate.setValue(newRate);
      }

      const curPayment = ctx.form.monthlyPayment.value.value as number;
      if (Math.abs(curPayment - newPayment) > 0.0001) {
        ctx.form.monthlyPayment.setValue(newPayment);
      }

      const totalInc = (ctx.form.totalIncome.value.value as number) ?? 0;
      const newRatio = totalInc > 0 ? Math.round((newPayment / totalInc) * 100 * 100) / 100 : 0;
      const curRatio = ctx.form.paymentToIncomeRatio.value.value as number;
      if (Math.abs(curRatio - newRatio) > 0.0001) {
        ctx.form.paymentToIncomeRatio.setValue(newRatio);
      }
    };

    // Shared compute function 2: totalIncome + paymentToIncomeRatio
    const recomputeIncomeAndPayment = (ctx: { form: ReturnType<typeof creditApplicationForm> }) => {
      const monthly = (ctx.form.step4.monthlyIncome.value.value as number | null) ?? 0;
      const additional = (ctx.form.step4.additionalIncome.value.value as number | null) ?? 0;
      const newTotal = monthly + additional;

      const curTotal = ctx.form.totalIncome.value.value as number;
      if (Math.abs(curTotal - newTotal) > 0.0001) {
        ctx.form.totalIncome.setValue(newTotal);
      }

      const payment = (ctx.form.monthlyPayment.value.value as number) ?? 0;
      const newRatio = newTotal > 0 ? Math.round((payment / newTotal) * 100 * 100) / 100 : 0;
      const curRatio = ctx.form.paymentToIncomeRatio.value.value as number;
      if (Math.abs(curRatio - newRatio) > 0.0001) {
        ctx.form.paymentToIncomeRatio.setValue(newRatio);
      }
    };

    // Shared compute function 3: age from birthDate
    const recomputeAge = (ctx: { form: ReturnType<typeof creditApplicationForm> }) => {
      const birthDate = ctx.form.step2.personalData.birthDate.value.value as string;
      if (!birthDate) return;
      const birth = new Date(birthDate);
      if (isNaN(birth.getTime())) return;
      const now = new Date();
      const newAge =
        now.getFullYear() -
        birth.getFullYear() -
        (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
      const curAge = ctx.form.age.value.value as number;
      if (curAge !== newAge) {
        ctx.form.age.setValue(newAge);
      }
    };

    // Shared compute function 4: fullName from last+first+middle
    const recomputeFullName = (ctx: { form: ReturnType<typeof creditApplicationForm> }) => {
      const last = ((ctx.form.step2.personalData.lastName.value.value as string) ?? '').trim();
      const first = ((ctx.form.step2.personalData.firstName.value.value as string) ?? '').trim();
      const middle = ((ctx.form.step2.personalData.middleName.value.value as string) ?? '').trim();
      const newFullName = [last, first, middle].filter(Boolean).join(' ');
      const curFullName = ctx.form.fullName.value.value as string;
      if (curFullName !== newFullName) {
        ctx.form.fullName.setValue(newFullName);
      }
    };

    // 9 watchField triggers (one per path, { immediate: false })
    // Triggers for recomputeRateAndPayment
    watchField(
      path.step1.loanType,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) =>
        recomputeRateAndPayment(ctx),
      { immediate: false }
    );
    watchField(
      path.step1.loanAmount,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) =>
        recomputeRateAndPayment(ctx),
      { immediate: false }
    );
    watchField(
      path.step1.loanTerm,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) =>
        recomputeRateAndPayment(ctx),
      { immediate: false }
    );

    // Triggers for recomputeIncomeAndPayment
    watchField(
      path.step4.monthlyIncome,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) =>
        recomputeIncomeAndPayment(ctx),
      { immediate: false }
    );
    watchField(
      path.step4.additionalIncome,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) =>
        recomputeIncomeAndPayment(ctx),
      { immediate: false }
    );

    // Trigger for recomputeAge
    watchField(
      path.step2.personalData.birthDate,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) => recomputeAge(ctx),
      { immediate: false }
    );

    // Triggers for recomputeFullName
    watchField(
      path.step2.personalData.lastName,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) =>
        recomputeFullName(ctx),
      { immediate: false }
    );
    watchField(
      path.step2.personalData.firstName,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) =>
        recomputeFullName(ctx),
      { immediate: false }
    );
    watchField(
      path.step2.personalData.middleName,
      (_: unknown, ctx: { form: ReturnType<typeof creditApplicationForm> }) =>
        recomputeFullName(ctx),
      { immediate: false }
    );
  },
});
