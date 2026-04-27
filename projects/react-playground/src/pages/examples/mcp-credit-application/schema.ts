import type React from 'react';
import { createForm } from '@reformer/core';
import type { FormProxy } from '@reformer/core';
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
import type { CreditApplicationForm } from './types';

// Stage-1 scaffold: use a no-op component placeholder so we don't need
// to import @reformer/ui-kit. Real component wiring happens in later stages.
const Noop: React.FC = () => null;
Noop.displayName = 'Noop';

// ─── Reusable field-group schemas ───────────────────────────────────────────

const personalDataSchema = {
  lastName: { value: '', component: Noop },
  firstName: { value: '', component: Noop },
  middleName: { value: '', component: Noop },
  birthDate: { value: '', component: Noop },
  gender: { value: 'male', component: Noop },
  birthPlace: { value: '', component: Noop },
};

const passportDataSchema = {
  series: { value: '', component: Noop },
  number: { value: '', component: Noop },
  issueDate: { value: '', component: Noop },
  issuedBy: { value: '', component: Noop },
  departmentCode: { value: '', component: Noop },
};

const addressSchema = {
  region: { value: '', component: Noop },
  city: { value: '', component: Noop },
  street: { value: '', component: Noop },
  house: { value: '', component: Noop },
  apartment: { value: '', component: Noop },
  postalCode: { value: '', component: Noop },
};

// ─── FormArray item templates ───────────────────────────────────────────────

const propertyItemSchema = {
  type: { value: 'apartment', component: Noop },
  description: { value: '', component: Noop },
  estimatedValue: { value: 0, component: Noop },
  hasEncumbrance: { value: false, component: Noop },
};

const existingLoanItemSchema = {
  bank: { value: '', component: Noop },
  type: { value: '', component: Noop },
  amount: { value: 0, component: Noop },
  remainingAmount: { value: 0, component: Noop },
  monthlyPayment: { value: 0, component: Noop },
  maturityDate: { value: '', component: Noop },
};

const coBorrowerItemSchema = {
  personalData: personalDataSchema,
  phone: { value: '', component: Noop },
  email: { value: '', component: Noop },
  relationship: { value: '', component: Noop },
  monthlyIncome: { value: 0, component: Noop },
};

// ─── INN checksum validator (12-digit personal INN) ─────────────────────────
// Russian INN (физического лица) — 12 digits, two check digits.
function validateInn12(value: string | null | undefined): { code: string; message: string } | null {
  if (!value) return null; // required() handles the empty case
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 12) {
    return { code: 'inn_length', message: 'ИНН должен содержать 12 цифр' };
  }
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
    return { code: 'inn_checksum', message: 'Неверная контрольная сумма ИНН' };
  }
  return null;
}

// ─── INN checksum validator (10-digit company INN) ──────────────────────────
function validateInn10(value: string | null | undefined): { code: string; message: string } | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) {
    return { code: 'inn_length', message: 'ИНН компании должен содержать 10 цифр' };
  }
  const d = digits.split('').map(Number);
  const n10 =
    ((2 * d[0] +
      4 * d[1] +
      10 * d[2] +
      3 * d[3] +
      5 * d[4] +
      9 * d[5] +
      4 * d[6] +
      6 * d[7] +
      8 * d[8]) %
      11) %
    10;
  if (d[9] !== n10) {
    return { code: 'inn_checksum', message: 'Неверная контрольная сумма ИНН компании' };
  }
  return null;
}

// ─── СНИЛС checksum validator ────────────────────────────────────────────────
function validateSnils(value: string | null | undefined): { code: string; message: string } | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) {
    return { code: 'snils_length', message: 'СНИЛС должен содержать 11 цифр' };
  }
  const d = digits.split('').map(Number);
  // Numbers ≤ 001-001-998 have no checksum check (historical).
  const number = parseInt(digits.slice(0, 9), 10);
  if (number <= 1001998) return null;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += d[i] * (9 - i);
  }
  let check = sum % 101;
  if (check === 100) check = 0;
  const providedCheck = d[9] * 10 + d[10];
  if (check !== providedCheck) {
    return { code: 'snils_checksum', message: 'Неверная контрольная сумма СНИЛС' };
  }
  return null;
}

// ─── Age-from-birthdate validator (18–70 years) ──────────────────────────────
function validateAge18to70(
  value: string | null | undefined
): { code: string; message: string } | null {
  if (!value) return null;
  const birth = new Date(value);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
  if (age < 18) return { code: 'age_min', message: 'Заёмщику должно быть не менее 18 лет' };
  if (age > 70) return { code: 'age_max', message: 'Заёмщику должно быть не более 70 лет' };
  return null;
}

// ─── passport issue date must not be in future ───────────────────────────────
function validatePassportIssueDate(
  value: string | null | undefined
): { code: string; message: string } | null {
  if (!value) return null;
  const issueDate = new Date(value);
  if (isNaN(issueDate.getTime())) return null;
  if (issueDate > new Date()) {
    return { code: 'issue_date_future', message: 'Дата выдачи паспорта не может быть в будущем' };
  }
  return null;
}

// ─── maturityDate must be in the future ──────────────────────────────────────
function validateFutureDate(
  value: string | null | undefined
): { code: string; message: string } | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  if (d <= new Date()) {
    return { code: 'date_past', message: 'Дата погашения должна быть в будущем' };
  }
  return null;
}

// ─── Russian phone pattern ───────────────────────────────────────────────────
const RU_PHONE = /^\+7\s?\(?\d{3}\)?\s?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/;

// ─── Root FormSchema ────────────────────────────────────────────────────────
// TS2589 ("type instantiation excessively deep") can occur when createForm<T>
// infers a very large recursive mapped type. The `as unknown as ...` cast
// breaks the deep inference chain while keeping the return type correct.

export const creditApplicationForm: FormProxy<CreditApplicationForm> = (
  createForm as (config: {
    form: unknown;
    validation: unknown;
    behavior: unknown;
  }) => FormProxy<CreditApplicationForm>
)({
  form: {
    // ── Step 1: Основная информация о кредите ──────────────────────────
    step1: {
      loanType: { value: 'consumer', component: Noop },
      loanAmount: { value: null, component: Noop },
      loanTerm: { value: 12, component: Noop },
      loanPurpose: { value: '', component: Noop },
      propertyValue: { value: null, component: Noop },
      initialPayment: { value: null, component: Noop },
      carBrand: { value: null, component: Noop },
      carModel: { value: null, component: Noop },
      carYear: { value: null, component: Noop },
      carPrice: { value: null, component: Noop },
    },

    // ── Step 2: Персональные данные ────────────────────────────────────
    step2: {
      personalData: personalDataSchema,
      passportData: passportDataSchema,
      inn: { value: '', component: Noop },
      snils: { value: '', component: Noop },
    },

    // ── Step 3: Контактная информация ──────────────────────────────────
    step3: {
      phoneMain: { value: '', component: Noop },
      phoneAdditional: { value: null, component: Noop },
      email: { value: '', component: Noop },
      emailAdditional: { value: null, component: Noop },
      registrationAddress: addressSchema,
      sameAsRegistration: { value: true, component: Noop },
      residenceAddress: addressSchema,
    },

    // ── Step 4: Информация о занятости ─────────────────────────────────
    step4: {
      employmentStatus: { value: 'employed', component: Noop },
      companyName: { value: null, component: Noop },
      companyInn: { value: null, component: Noop },
      companyPhone: { value: null, component: Noop },
      companyAddress: { value: null, component: Noop },
      position: { value: null, component: Noop },
      workExperienceTotal: { value: null, component: Noop },
      workExperienceCurrent: { value: null, component: Noop },
      monthlyIncome: { value: null, component: Noop },
      additionalIncome: { value: null, component: Noop },
      additionalIncomeSource: { value: null, component: Noop },
      businessType: { value: null, component: Noop },
      businessInn: { value: null, component: Noop },
      businessActivity: { value: null, component: Noop },
    },

    // ── Step 5: Дополнительная информация ─────────────────────────────
    step5: {
      maritalStatus: { value: 'single', component: Noop },
      dependents: { value: 0, component: Noop },
      education: { value: 'higher', component: Noop },
      hasProperty: { value: false, component: Noop },
      properties: [propertyItemSchema],
      hasExistingLoans: { value: false, component: Noop },
      existingLoans: [existingLoanItemSchema],
      hasCoBorrower: { value: false, component: Noop },
      coBorrowers: [coBorrowerItemSchema],
    },

    // ── Step 6: Подтверждение и согласия ──────────────────────────────
    step6: {
      agreePersonalData: { value: false, component: Noop },
      agreeCreditHistory: { value: false, component: Noop },
      agreeMarketing: { value: false, component: Noop },
      agreeTerms: { value: false, component: Noop },
      confirmAccuracy: { value: false, component: Noop },
      electronicSignature: { value: '', component: Noop },
    },

    // ── Stage 3b: computed root-level fields ──────────────────────────
    interestRate: { value: 0, component: Noop },
    monthlyPayment: { value: 0, component: Noop },
    totalIncome: { value: 0, component: Noop },
    paymentToIncomeRatio: { value: 0, component: Noop },
    age: { value: 0, component: Noop },
    fullName: { value: '', component: Noop },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 2: Validation block
  // ══════════════════════════════════════════════════════════════════════════
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validation: (path: any) => {
    // ── Step 1 ──────────────────────────────────────────────────────────────
    required(path.step1.loanType);
    required(path.step1.loanAmount);
    min(path.step1.loanAmount, 50000, { message: 'Минимальная сумма кредита — 50 000 ₽' });
    max(path.step1.loanAmount, 10000000, { message: 'Максимальная сумма кредита — 10 000 000 ₽' });
    required(path.step1.loanTerm);
    min(path.step1.loanTerm, 6, { message: 'Минимальный срок — 6 месяцев' });
    max(path.step1.loanTerm, 240, { message: 'Максимальный срок — 240 месяцев (20 лет)' });
    required(path.step1.loanPurpose);
    minLength(path.step1.loanPurpose, 10, {
      message: 'Опишите цель подробнее (минимум 10 символов)',
    });
    maxLength(path.step1.loanPurpose, 500, { message: 'Максимум 500 символов' });

    // Mortgage-only conditional fields
    applyWhen(
      path.step1.loanType,
      (type: unknown) => type === 'mortgage',
      (p: typeof path) => {
        required(p.step1.propertyValue, { message: 'Укажите стоимость недвижимости' });
        min(p.step1.propertyValue, 1000000, {
          message: 'Стоимость недвижимости не может быть менее 1 000 000 ₽',
        });
        required(p.step1.initialPayment, { message: 'Укажите первоначальный взнос' });
        // Cross-field: initialPayment >= 20% of propertyValue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validate(p.step1.initialPayment, (value: unknown, ctx: any) => {
          const payment = value as number | null;
          const propVal = ctx.form.step1.propertyValue.value.value as number | null;
          if (payment == null || propVal == null || propVal <= 0) return null;
          const minPayment = propVal * 0.2;
          if (payment < minPayment) {
            return {
              code: 'initial_payment_min',
              message: `Первоначальный взнос должен быть не менее 20% от стоимости недвижимости (${minPayment.toLocaleString('ru-RU')} ₽)`,
            };
          }
          return null;
        });
        // Cross-field: loanAmount <= propertyValue - initialPayment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validate(p.step1.loanAmount, (value: unknown, ctx: any) => {
          const loan = value as number | null;
          const propVal = ctx.form.step1.propertyValue.value.value as number | null;
          const initPay = ctx.form.step1.initialPayment.value.value as number | null;
          if (loan == null || propVal == null || initPay == null) return null;
          const maxLoan = propVal - initPay;
          if (loan > maxLoan) {
            return {
              code: 'loan_exceeds_property',
              message: `Сумма кредита не может превышать стоимость за вычетом взноса (${maxLoan.toLocaleString('ru-RU')} ₽)`,
            };
          }
          return null;
        });
      }
    );

    // Car-only conditional fields
    applyWhen(
      path.step1.loanType,
      (type: unknown) => type === 'car',
      (p: typeof path) => {
        required(p.step1.carBrand, { message: 'Укажите марку автомобиля' });
        minLength(p.step1.carBrand, 2, { message: 'Минимум 2 символа' });
        maxLength(p.step1.carBrand, 50, { message: 'Максимум 50 символов' });
        required(p.step1.carModel, { message: 'Укажите модель автомобиля' });
        minLength(p.step1.carModel, 1, { message: 'Минимум 1 символ' });
        maxLength(p.step1.carModel, 50, { message: 'Максимум 50 символов' });
        required(p.step1.carYear, { message: 'Укажите год выпуска' });
        min(p.step1.carYear, 2000, { message: 'Год выпуска не ранее 2000' });
        max(p.step1.carYear, new Date().getFullYear() + 1, {
          message: `Год выпуска не позднее ${new Date().getFullYear() + 1}`,
        });
        required(p.step1.carPrice, { message: 'Укажите стоимость автомобиля' });
        min(p.step1.carPrice, 300000, { message: 'Минимальная стоимость автомобиля — 300 000 ₽' });
        max(p.step1.carPrice, 10000000, {
          message: 'Максимальная стоимость автомобиля — 10 000 000 ₽',
        });
      }
    );

    // ── Step 2 ──────────────────────────────────────────────────────────────
    // Personal data
    required(path.step2.personalData.lastName, { message: 'Введите фамилию' });
    required(path.step2.personalData.firstName, { message: 'Введите имя' });
    required(path.step2.personalData.middleName, { message: 'Введите отчество' });
    required(path.step2.personalData.birthDate, { message: 'Введите дату рождения' });
    validate(path.step2.personalData.birthDate, (value: unknown) =>
      validateAge18to70(value as string | null | undefined)
    );
    required(path.step2.personalData.gender, { message: 'Выберите пол' });
    required(path.step2.personalData.birthPlace, { message: 'Введите место рождения' });

    // Passport data
    required(path.step2.passportData.series, { message: 'Введите серию паспорта' });
    pattern(path.step2.passportData.series, /^\d{2}\s?\d{2}$/, {
      message: 'Серия паспорта: 4 цифры (например 12 34)',
    });
    required(path.step2.passportData.number, { message: 'Введите номер паспорта' });
    pattern(path.step2.passportData.number, /^\d{6}$/, {
      message: 'Номер паспорта: 6 цифр',
    });
    required(path.step2.passportData.issueDate, { message: 'Введите дату выдачи паспорта' });
    validate(path.step2.passportData.issueDate, (value: unknown) =>
      validatePassportIssueDate(value as string | null | undefined)
    );
    required(path.step2.passportData.issuedBy, { message: 'Введите орган, выдавший паспорт' });
    required(path.step2.passportData.departmentCode, { message: 'Введите код подразделения' });
    pattern(path.step2.passportData.departmentCode, /^\d{3}-\d{3}$/, {
      message: 'Код подразделения: формат 123-456',
    });

    // INN (12 digits, personal)
    required(path.step2.inn, { message: 'Введите ИНН' });
    pattern(path.step2.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
    validate(path.step2.inn, (value: unknown) => validateInn12(value as string | null | undefined));

    // СНИЛС (11 digits, format 999-999-999 99)
    required(path.step2.snils, { message: 'Введите СНИЛС' });
    pattern(path.step2.snils, /^\d{3}-\d{3}-\d{3}\s\d{2}$/, {
      message: 'СНИЛС: формат 123-456-789 00',
    });
    validate(path.step2.snils, (value: unknown) =>
      validateSnils(value as string | null | undefined)
    );

    // ── Step 3 ──────────────────────────────────────────────────────────────
    required(path.step3.phoneMain, { message: 'Введите основной телефон' });
    pattern(path.step3.phoneMain, RU_PHONE, {
      message: 'Телефон: формат +7 (999) 999-99-99',
    });

    // phoneAdditional: optional but must match pattern if provided
    validate(path.step3.phoneAdditional, (value: unknown) => {
      const v = value as string | null;
      if (!v) return null;
      if (!RU_PHONE.test(v)) {
        return { code: 'phone_format', message: 'Телефон: формат +7 (999) 999-99-99' };
      }
      return null;
    });

    required(path.step3.email, { message: 'Введите email' });
    email(path.step3.email, { message: 'Введите корректный email' });

    // emailAdditional: optional but must be valid email if provided
    validate(path.step3.emailAdditional, (value: unknown) => {
      const v = value as string | null;
      if (!v) return null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return { code: 'email_format', message: 'Введите корректный дополнительный email' };
      }
      return null;
    });

    // Registration address (always required)
    required(path.step3.registrationAddress.region, { message: 'Введите регион' });
    required(path.step3.registrationAddress.city, { message: 'Введите город' });
    required(path.step3.registrationAddress.street, { message: 'Введите улицу' });
    required(path.step3.registrationAddress.house, { message: 'Введите дом' });
    required(path.step3.registrationAddress.postalCode, { message: 'Введите почтовый индекс' });
    pattern(path.step3.registrationAddress.postalCode, /^\d{6}$/, {
      message: 'Индекс: 6 цифр',
    });

    // Residence address: required only when sameAsRegistration = false
    applyWhen(
      path.step3.sameAsRegistration,
      (same: unknown) => same === false,
      (p: typeof path) => {
        required(p.step3.residenceAddress.region, { message: 'Введите регион проживания' });
        required(p.step3.residenceAddress.city, { message: 'Введите город проживания' });
        required(p.step3.residenceAddress.street, { message: 'Введите улицу проживания' });
        required(p.step3.residenceAddress.house, { message: 'Введите дом (проживание)' });
        required(p.step3.residenceAddress.postalCode, { message: 'Введите индекс (проживание)' });
        pattern(p.step3.residenceAddress.postalCode, /^\d{6}$/, {
          message: 'Индекс: 6 цифр',
        });
      }
    );

    // ── Step 4 ──────────────────────────────────────────────────────────────
    required(path.step4.employmentStatus, { message: 'Выберите статус занятости' });

    // Employed fields — required when employmentStatus = 'employed'
    applyWhen(
      path.step4.employmentStatus,
      (status: unknown) => status === 'employed',
      (p: typeof path) => {
        required(p.step4.companyName, { message: 'Введите название компании' });
        required(p.step4.companyInn, { message: 'Введите ИНН компании' });
        pattern(p.step4.companyInn, /^\d{10}$/, { message: 'ИНН компании: 10 цифр' });
        validate(p.step4.companyInn, (value: unknown) =>
          validateInn10(value as string | null | undefined)
        );
        required(p.step4.companyPhone, { message: 'Введите телефон компании' });
        pattern(p.step4.companyPhone, RU_PHONE, { message: 'Телефон: формат +7 (999) 999-99-99' });
        required(p.step4.companyAddress, { message: 'Введите адрес компании' });
        required(p.step4.position, { message: 'Введите должность' });
      }
    );

    // Self-employed fields — required when employmentStatus = 'selfEmployed'
    applyWhen(
      path.step4.employmentStatus,
      (status: unknown) => status === 'selfEmployed',
      (p: typeof path) => {
        required(p.step4.businessType, { message: 'Введите тип бизнеса' });
        required(p.step4.businessInn, { message: 'Введите ИНН ИП' });
        pattern(p.step4.businessInn, /^\d{12}$/, { message: 'ИНН ИП: 12 цифр' });
        validate(p.step4.businessInn, (value: unknown) =>
          validateInn12(value as string | null | undefined)
        );
        required(p.step4.businessActivity, { message: 'Опишите вид деятельности' });
      }
    );

    // Experience (always required, min 0)
    required(path.step4.workExperienceTotal, { message: 'Введите общий стаж' });
    min(path.step4.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
    required(path.step4.workExperienceCurrent, { message: 'Введите стаж на текущем месте' });
    min(path.step4.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });

    // Cross-field: workExperienceCurrent <= workExperienceTotal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validate(path.step4.workExperienceCurrent, (value: unknown, ctx: any) => {
      const current = value as number | null;
      const total = ctx.form.step4.workExperienceTotal.value.value as number | null;
      if (current == null || total == null) return null;
      if (current > total) {
        return {
          code: 'experience_exceeds_total',
          message: 'Стаж на текущем месте не может превышать общий стаж',
        };
      }
      return null;
    });

    // Income
    required(path.step4.monthlyIncome, { message: 'Введите ежемесячный доход' });
    min(path.step4.monthlyIncome, 10000, { message: 'Минимальный доход — 10 000 ₽' });

    // additionalIncome: optional, min 0 if provided
    validate(path.step4.additionalIncome, (value: unknown) => {
      const v = value as number | null;
      if (v == null) return null;
      if (v < 0)
        return {
          code: 'additional_income_negative',
          message: 'Дополнительный доход не может быть отрицательным',
        };
      return null;
    });

    // additionalIncomeSource is required when additionalIncome > 0
    applyWhen(
      path.step4.additionalIncome,
      (income: unknown) => typeof income === 'number' && income > 0,
      (p: typeof path) => {
        required(p.step4.additionalIncomeSource, {
          message: 'Укажите источник дополнительного дохода',
        });
      }
    );

    // ── Step 5 ──────────────────────────────────────────────────────────────
    required(path.step5.maritalStatus, { message: 'Выберите семейное положение' });
    required(path.step5.dependents, { message: 'Укажите количество иждивенцев' });
    min(path.step5.dependents, 0, { message: 'Количество иждивенцев не может быть отрицательным' });
    max(path.step5.dependents, 10, { message: 'Максимум 10 иждивенцев' });
    required(path.step5.education, { message: 'Выберите уровень образования' });

    // Properties array items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateItems(path.step5.properties, (itemPath: any) => {
      required(itemPath.type, { message: 'Выберите тип имущества' });
      required(itemPath.description, { message: 'Опишите имущество' });
      required(itemPath.estimatedValue, { message: 'Укажите оценочную стоимость' });
      min(itemPath.estimatedValue, 0, { message: 'Стоимость не может быть отрицательной' });
    });

    // Existing loans array items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateItems(path.step5.existingLoans, (itemPath: any) => {
      required(itemPath.bank, { message: 'Введите название банка' });
      required(itemPath.type, { message: 'Введите тип кредита' });
      required(itemPath.amount, { message: 'Введите сумму кредита' });
      min(itemPath.amount, 0, { message: 'Сумма не может быть отрицательной' });
      required(itemPath.remainingAmount, { message: 'Введите остаток задолженности' });
      min(itemPath.remainingAmount, 0, { message: 'Остаток не может быть отрицательным' });
      // Cross-field: remainingAmount <= amount
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validate(itemPath.remainingAmount, (value: unknown, ctx: any) => {
        const remaining = value as number;
        const total = ctx.form.amount.value.value as number;
        if (remaining > total) {
          return {
            code: 'remaining_exceeds_amount',
            message: 'Остаток задолженности не может превышать сумму кредита',
          };
        }
        return null;
      });
      required(itemPath.monthlyPayment, { message: 'Введите ежемесячный платёж' });
      min(itemPath.monthlyPayment, 0, { message: 'Платёж не может быть отрицательным' });
      required(itemPath.maturityDate, { message: 'Введите дату погашения' });
      validate(itemPath.maturityDate, (value: unknown) =>
        validateFutureDate(value as string | null | undefined)
      );
    });

    // Co-borrowers array items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateItems(path.step5.coBorrowers, (itemPath: any) => {
      // Personal data of co-borrower
      required(itemPath.personalData.lastName, { message: 'Введите фамилию созаёмщика' });
      required(itemPath.personalData.firstName, { message: 'Введите имя созаёмщика' });
      required(itemPath.personalData.middleName, { message: 'Введите отчество созаёмщика' });
      required(itemPath.personalData.birthDate, { message: 'Введите дату рождения созаёмщика' });
      validate(itemPath.personalData.birthDate, (value: unknown) =>
        validateAge18to70(value as string | null | undefined)
      );
      required(itemPath.personalData.gender, { message: 'Выберите пол созаёмщика' });
      required(itemPath.personalData.birthPlace, { message: 'Введите место рождения созаёмщика' });

      // Contact
      required(itemPath.phone, { message: 'Введите телефон созаёмщика' });
      pattern(itemPath.phone, RU_PHONE, { message: 'Телефон: формат +7 (999) 999-99-99' });
      required(itemPath.email, { message: 'Введите email созаёмщика' });
      email(itemPath.email, { message: 'Введите корректный email созаёмщика' });
      required(itemPath.relationship, { message: 'Укажите степень родства' });
      required(itemPath.monthlyIncome, { message: 'Введите доход созаёмщика' });
      min(itemPath.monthlyIncome, 0, { message: 'Доход не может быть отрицательным' });
    });

    // ── Step 6 ──────────────────────────────────────────────────────────────
    // Mandatory consents (must be true)
    validate(path.step6.agreePersonalData, (value: unknown) => {
      if (value !== true) {
        return {
          code: 'consent_required',
          message: 'Необходимо дать согласие на обработку персональных данных',
        };
      }
      return null;
    });
    validate(path.step6.agreeCreditHistory, (value: unknown) => {
      if (value !== true) {
        return {
          code: 'consent_required',
          message: 'Необходимо дать согласие на проверку кредитной истории',
        };
      }
      return null;
    });
    validate(path.step6.agreeTerms, (value: unknown) => {
      if (value !== true) {
        return { code: 'consent_required', message: 'Необходимо принять условия кредитования' };
      }
      return null;
    });
    validate(path.step6.confirmAccuracy, (value: unknown) => {
      if (value !== true) {
        return { code: 'confirm_required', message: 'Подтвердите точность введённых данных' };
      }
      return null;
    });

    // Electronic signature (SMS code, 6 digits)
    required(path.step6.electronicSignature, { message: 'Введите код из СМС' });
    pattern(path.step6.electronicSignature, /^\d{6}$/, {
      message: 'Код подтверждения: 6 цифр',
    });
  },

  // Stage 3a bisect — Group 1: only Step1 loanType-conditional fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  behavior: (path: any) => {
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

    // Group 2: Step3 residenceAddress per-field enableWhen
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

    // Group 3: copyFrom registrationAddress -> residenceAddress (per-field)
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

    // Group 4: Step4 employed-only enableWhen
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

    // Group 5: Step4 selfEmployed-only + additionalIncomeSource
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
    enableWhen(
      path.step4.additionalIncomeSource,
      (form: CreditApplicationForm) =>
        typeof form.step4.additionalIncome === 'number' && form.step4.additionalIncome > 0,
      { resetOnDisable: true }
    );

    // NOTE: FormArray gating (step5.properties / existingLoans / coBorrowers
    // by their hasX boolean flags) is intentionally NOT done via
    // enableWhen + resetOnDisable on the array node itself — that triggers a
    // reactive cycle on mount that hangs the browser (verified by bisect:
    // adding the three enableWhen calls to ArrayNode targets is the only
    // change that breaks DOMContentLoaded).
    // The gating is implemented in index.tsx as conditional rendering
    // ({hasProperty.value && <PropertyArray/>}) instead.

    // ── Stage 3b: watchField computed cascade ─────────────────────────────
    // Interest-rate lookup table
    const RATE_BY_TYPE: Record<string, number> = {
      mortgage: 8.5,
      car: 11,
      business: 14,
      refinancing: 9,
      consumer: 16,
    };

    // Compute interestRate and monthlyPayment (and cascade paymentToIncomeRatio)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recomputeRateAndPayment = (ctx: any) => {
      const loanType = (ctx.form.step1.loanType.value.value as string) ?? 'consumer';
      const newRate = RATE_BY_TYPE[loanType] ?? 16;
      const curRate = ctx.form.interestRate.value.value as number;
      if (Math.abs(curRate - newRate) > 0.0001) {
        ctx.form.interestRate.setValue(newRate);
      }

      const amount = ctx.form.step1.loanAmount.value.value as number | null;
      const term = ctx.form.step1.loanTerm.value.value as number;
      const rate = newRate; // use freshly-computed rate, not stale curRate

      let newPayment = 0;
      if (amount != null && amount > 0 && term > 0 && rate > 0) {
        const i = rate / 100 / 12;
        const n = term;
        newPayment = Math.round((amount * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1));
      }
      const curPayment = ctx.form.monthlyPayment.value.value as number;
      if (Math.abs(curPayment - newPayment) > 0.0001) {
        ctx.form.monthlyPayment.setValue(newPayment);
      }

      // cascade: paymentToIncomeRatio depends on monthlyPayment + totalIncome
      const totalIncome = ctx.form.totalIncome.value.value as number;
      const newRatio = totalIncome > 0 ? Math.round((newPayment / totalIncome) * 10000) / 100 : 0;
      const curRatio = ctx.form.paymentToIncomeRatio.value.value as number;
      if (Math.abs(curRatio - newRatio) > 0.0001) {
        ctx.form.paymentToIncomeRatio.setValue(newRatio);
      }
    };

    // Compute totalIncome and cascade paymentToIncomeRatio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recomputeIncomeAndPayment = (ctx: any) => {
      const monthly = (ctx.form.step4.monthlyIncome.value.value as number | null) ?? 0;
      const additional = (ctx.form.step4.additionalIncome.value.value as number | null) ?? 0;
      const newTotal = monthly + additional;
      const curTotal = ctx.form.totalIncome.value.value as number;
      if (Math.abs(curTotal - newTotal) > 0.0001) {
        ctx.form.totalIncome.setValue(newTotal);
      }

      const payment = ctx.form.monthlyPayment.value.value as number;
      const newRatio = newTotal > 0 ? Math.round((payment / newTotal) * 10000) / 100 : 0;
      const curRatio = ctx.form.paymentToIncomeRatio.value.value as number;
      if (Math.abs(curRatio - newRatio) > 0.0001) {
        ctx.form.paymentToIncomeRatio.setValue(newRatio);
      }
    };

    // Compute age from birthDate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recomputeAge = (ctx: any) => {
      const birthDate = ctx.form.step2.personalData.birthDate.value.value as string | null;
      let newAge = 0;
      if (birthDate) {
        const ms = Date.now() - new Date(birthDate).getTime();
        if (!isNaN(ms) && ms > 0) {
          newAge = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
        }
      }
      const curAge = ctx.form.age.value.value as number;
      if (curAge !== newAge) {
        ctx.form.age.setValue(newAge);
      }
    };

    // Compute fullName from lastName + firstName + middleName
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recomputeFullName = (ctx: any) => {
      const lastName = (ctx.form.step2.personalData.lastName.value.value as string) ?? '';
      const firstName = (ctx.form.step2.personalData.firstName.value.value as string) ?? '';
      const middleName = (ctx.form.step2.personalData.middleName.value.value as string) ?? '';
      const newName = [lastName, firstName, middleName].filter(Boolean).join(' ');
      const curName = ctx.form.fullName.value.value as string;
      if (curName !== newName) {
        ctx.form.fullName.setValue(newName);
      }
    };

    // One watchField per trigger path — all delegate to the shared compute fns.
    // Preamble rule #3: watchField accepts ONE FieldPathNode, never an array.
    watchField(path.step1.loanType, (_: unknown, ctx: unknown) => recomputeRateAndPayment(ctx), {
      immediate: false,
    });
    watchField(path.step1.loanAmount, (_: unknown, ctx: unknown) => recomputeRateAndPayment(ctx), {
      immediate: false,
    });
    watchField(path.step1.loanTerm, (_: unknown, ctx: unknown) => recomputeRateAndPayment(ctx), {
      immediate: false,
    });
    watchField(
      path.step4.monthlyIncome,
      (_: unknown, ctx: unknown) => recomputeIncomeAndPayment(ctx),
      { immediate: false }
    );
    watchField(
      path.step4.additionalIncome,
      (_: unknown, ctx: unknown) => recomputeIncomeAndPayment(ctx),
      { immediate: false }
    );
    watchField(path.step2.personalData.birthDate, (_: unknown, ctx: unknown) => recomputeAge(ctx), {
      immediate: false,
    });
    watchField(
      path.step2.personalData.lastName,
      (_: unknown, ctx: unknown) => recomputeFullName(ctx),
      { immediate: false }
    );
    watchField(
      path.step2.personalData.firstName,
      (_: unknown, ctx: unknown) => recomputeFullName(ctx),
      { immediate: false }
    );
    watchField(
      path.step2.personalData.middleName,
      (_: unknown, ctx: unknown) => recomputeFullName(ctx),
      { immediate: false }
    );
  },
});
