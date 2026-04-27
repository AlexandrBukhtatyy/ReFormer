import { createForm, type FormProxy, type FieldPath, type FormFields } from '@reformer/core';
import {
  required,
  email,
  min,
  max,
  pattern,
  notEmpty,
  validateItems,
  applyWhen,
} from '@reformer/core/validators';
import { enableWhen, copyFrom, watchField } from '@reformer/core/behaviors';
import { Input, Select, Textarea, Checkbox, RadioGroup, InputMask } from '@reformer/ui-kit';

import type { CreditApplicationForm } from './types';

// ----- option lists -----
export const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
];

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Самозанятый / ИП' },
  { value: 'unemployed', label: 'Не работаю' },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Не женат / не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

export const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
];

export const LOAN_STATUS_OPTIONS = [
  { value: 'active', label: 'Действующий' },
  { value: 'closed', label: 'Закрыт' },
  { value: 'overdue', label: 'Просрочен' },
];

export const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Супруг / супруга' },
  { value: 'parent', label: 'Родитель' },
  { value: 'child', label: 'Ребёнок' },
  { value: 'sibling', label: 'Брат / сестра' },
  { value: 'other', label: 'Другое' },
];

// Avoid eq pitfalls for floats: round to 2 decimals.
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function calcAge(birthDate: string): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age < 0 ? 0 : age;
}

// PMT-like monthly payment in RUB; returns 0 for invalid inputs.
function calcMonthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (!principal || principal <= 0 || !months || months <= 0) return 0;
  const r = annualRatePct > 0 ? annualRatePct / 100 / 12 : 0;
  if (r === 0) return round2(principal / months);
  const v = (principal * r) / (1 - Math.pow(1 + r, -months));
  return round2(v);
}

function rateForLoanType(loanType: string): number {
  switch (loanType) {
    case 'consumer':
      return 18;
    case 'mortgage':
      return 9;
    case 'car':
      return 12;
    default:
      return 0;
  }
}

// ===== Form factory =====

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: {
      // step 1
      loanType: {
        value: '' as CreditApplicationForm['loanType'],
        component: Select,
        componentProps: { label: 'Тип кредита', options: LOAN_TYPE_OPTIONS },
      },
      loanAmount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Сумма кредита (руб.)', type: 'number', min: 0 },
      },
      loanTerm: {
        value: 12,
        component: Input,
        componentProps: { label: 'Срок кредита (мес.)', type: 'number', min: 1 },
      },
      loanPurpose: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Цель кредита', rows: 2 },
      },
      propertyValue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Стоимость объекта (руб.)', type: 'number', min: 0 },
      },
      initialPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Первоначальный взнос (руб.)', type: 'number', min: 0 },
      },
      carBrand: { value: '', component: Input, componentProps: { label: 'Марка/модель авто' } },
      carYear: {
        value: new Date().getFullYear(),
        component: Input,
        componentProps: { label: 'Год выпуска', type: 'number' },
      },
      interestRate: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ставка, % годовых', type: 'number', readOnly: true },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный платёж (руб.)', type: 'number', readOnly: true },
      },

      // step 2
      lastName: { value: '', component: Input, componentProps: { label: 'Фамилия' } },
      firstName: { value: '', component: Input, componentProps: { label: 'Имя' } },
      middleName: { value: '', component: Input, componentProps: { label: 'Отчество' } },
      birthDate: {
        value: '',
        component: Input,
        componentProps: { label: 'Дата рождения', type: 'date' },
      },
      passport: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Паспорт (серия и номер)', mask: '0000 000000' },
      },
      inn: {
        value: '',
        component: InputMask,
        componentProps: { label: 'ИНН', mask: '000000000000' },
      },
      maritalStatus: {
        value: '' as CreditApplicationForm['maritalStatus'],
        component: Select,
        componentProps: { label: 'Семейное положение', options: MARITAL_STATUS_OPTIONS },
      },
      childrenCount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Количество детей', type: 'number', min: 0 },
      },
      fullName: {
        value: '',
        component: Input,
        componentProps: { label: 'Полное ФИО', readOnly: true },
      },
      age: {
        value: 0,
        component: Input,
        componentProps: { label: 'Возраст', type: 'number', readOnly: true },
      },

      // step 3
      employmentStatus: {
        value: '' as CreditApplicationForm['employmentStatus'],
        component: RadioGroup,
        componentProps: { label: 'Занятость', options: EMPLOYMENT_STATUS_OPTIONS },
      },
      companyName: {
        value: '',
        component: Input,
        componentProps: { label: 'Наименование компании' },
      },
      position: { value: '', component: Input, componentProps: { label: 'Должность' } },
      workExperience: {
        value: 0,
        component: Input,
        componentProps: { label: 'Стаж (мес.)', type: 'number', min: 0 },
      },
      monthlySalary: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный доход (руб.)', type: 'number', min: 0 },
      },
      businessType: { value: '', component: Input, componentProps: { label: 'Вид деятельности' } },
      monthlyRevenue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный доход от бизнеса (руб.)', type: 'number', min: 0 },
      },

      // step 4
      additionalIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Дополнительный доход (руб./мес.)', type: 'number', min: 0 },
      },
      monthlyExpenses: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячные расходы (руб.)', type: 'number', min: 0 },
      },
      hasProperty: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Есть имущество в собственности' },
      },
      properties: {
        value: [] as CreditApplicationForm['properties'],
        component: Input,
        componentProps: { label: 'Имущество' },
      },
      hasExistingLoans: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Есть действующие кредиты' },
      },
      existingLoans: {
        value: [] as CreditApplicationForm['existingLoans'],
        component: Input,
        componentProps: { label: 'Действующие кредиты' },
      },
      totalIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Общий доход (руб./мес.)', type: 'number', readOnly: true },
      },
      paymentToIncomeRatio: {
        value: 0,
        component: Input,
        componentProps: { label: 'Долговая нагрузка (PTI), %', type: 'number', readOnly: true },
      },

      // step 5
      hasCoBorrower: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Привлечь созаёмщиков' },
      },
      coBorrowers: {
        value: [] as CreditApplicationForm['coBorrowers'],
        component: Input,
        componentProps: { label: 'Созаёмщики' },
      },
      coBorrowersIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Доход созаёмщиков (руб./мес.)', type: 'number', readOnly: true },
      },

      // step 6
      agreeToProcessData: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласен на обработку персональных данных' },
      },
      agreeToCreditCheck: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласен на проверку кредитной истории' },
      },
      contactPhone: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Контактный телефон', mask: '+7 (000) 000-00-00' },
      },
      contactEmail: {
        value: '',
        component: Input,
        componentProps: { label: 'Контактный email', type: 'email' },
      },
    } as unknown as FormFields,

    // ----- validation -----
    validation: ((path: FieldPath<CreditApplicationForm>) => {
      // step 1 — base
      required(path.loanType, { message: 'Выберите тип кредита' });
      required(path.loanAmount);
      min(path.loanAmount, 1000, { message: 'Минимальная сумма 1 000 ₽' });
      required(path.loanTerm);
      min(path.loanTerm, 1);
      max(path.loanTerm, 360);
      required(path.loanPurpose);

      // mortgage-only
      applyWhen(
        path.loanType,
        (v: string) => v === 'mortgage',
        (p: FieldPath<CreditApplicationForm>) => {
          required(p.propertyValue, { message: 'Укажите стоимость объекта' });
          min(p.propertyValue, 1);
          required(p.initialPayment, { message: 'Укажите первоначальный взнос' });
          min(p.initialPayment, 0);
        }
      );

      // car-only
      applyWhen(
        path.loanType,
        (v: string) => v === 'car',
        (p: FieldPath<CreditApplicationForm>) => {
          required(p.carBrand, { message: 'Укажите марку автомобиля' });
          required(p.carYear);
          min(p.carYear, 1980);
          max(p.carYear, new Date().getFullYear() + 1);
        }
      );

      // step 2
      required(path.lastName);
      required(path.firstName);
      required(path.birthDate);
      required(path.passport, { message: 'Укажите паспортные данные' });
      pattern(path.passport, /^\d{4}\s\d{6}$/, { message: 'Формат: 0000 000000' });
      required(path.inn);
      pattern(path.inn, /^\d{10,12}$/, { message: 'ИНН: 10–12 цифр' });
      required(path.maritalStatus);
      min(path.childrenCount, 0);

      // step 3
      required(path.employmentStatus, { message: 'Выберите статус занятости' });

      applyWhen(
        path.employmentStatus,
        (v: string) => v === 'employed',
        (p: FieldPath<CreditApplicationForm>) => {
          required(p.companyName, { message: 'Укажите компанию' });
          required(p.position);
          required(p.workExperience);
          min(p.workExperience, 1);
          required(p.monthlySalary);
          min(p.monthlySalary, 1);
        }
      );

      applyWhen(
        path.employmentStatus,
        (v: string) => v === 'selfEmployed',
        (p: FieldPath<CreditApplicationForm>) => {
          required(p.businessType, { message: 'Укажите вид деятельности' });
          required(p.monthlyRevenue);
          min(p.monthlyRevenue, 1);
        }
      );

      // step 4
      min(path.additionalIncome, 0);
      min(path.monthlyExpenses, 0);

      applyWhen(
        path.hasProperty,
        (v: boolean) => v === true,
        (p: FieldPath<CreditApplicationForm>) => {
          notEmpty(p.properties, { message: 'Добавьте хотя бы один объект имущества' });
          validateItems(p.properties, (ip) => {
            required(ip.type, { message: 'Тип имущества обязателен' });
            required(ip.description);
            required(ip.estimatedValue);
            min(ip.estimatedValue, 1);
          });
        }
      );

      applyWhen(
        path.hasExistingLoans,
        (v: boolean) => v === true,
        (p: FieldPath<CreditApplicationForm>) => {
          notEmpty(p.existingLoans, { message: 'Добавьте хотя бы один кредит' });
          validateItems(p.existingLoans, (ip) => {
            required(ip.bankName);
            required(ip.loanType);
            required(ip.remainingDebt);
            min(ip.remainingDebt, 0);
            required(ip.monthlyPayment);
            min(ip.monthlyPayment, 0);
            required(ip.status);
          });
        }
      );

      // step 5
      applyWhen(
        path.hasCoBorrower,
        (v: boolean) => v === true,
        (p: FieldPath<CreditApplicationForm>) => {
          notEmpty(p.coBorrowers, { message: 'Добавьте хотя бы одного созаёмщика' });
          validateItems(p.coBorrowers, (ip) => {
            required(ip.fullName);
            required(ip.relationship);
            required(ip.monthlyIncome);
            min(ip.monthlyIncome, 1);
            required(ip.passport);
            pattern(ip.passport, /^\d{4}\s\d{6}$/, { message: 'Формат: 0000 000000' });
          });
        }
      );

      // step 6
      required(path.agreeToProcessData, { message: 'Необходимо согласие' });
      required(path.agreeToCreditCheck, { message: 'Необходимо согласие' });
      required(path.contactPhone);
      pattern(path.contactPhone, /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/, {
        message: 'Формат: +7 (XXX) XXX-XX-XX',
      });
      required(path.contactEmail);
      email(path.contactEmail);
    }) as never,

    // ----- behavior -----
    behavior: ((path: FieldPath<CreditApplicationForm>) => {
      // enableWhen — gated fields driven by independent triggers (loanType / employmentStatus).
      enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
        resetOnDisable: true,
      });
      enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
        resetOnDisable: true,
      });
      enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
      enableWhen(path.carYear, (form) => form.loanType === 'car', { resetOnDisable: true });

      enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
        resetOnDisable: true,
      });
      enableWhen(path.position, (form) => form.employmentStatus === 'employed', {
        resetOnDisable: true,
      });
      enableWhen(path.workExperience, (form) => form.employmentStatus === 'employed', {
        resetOnDisable: true,
      });
      enableWhen(path.monthlySalary, (form) => form.employmentStatus === 'employed', {
        resetOnDisable: true,
      });
      enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
        resetOnDisable: true,
      });
      enableWhen(path.monthlyRevenue, (form) => form.employmentStatus === 'selfEmployed', {
        resetOnDisable: true,
      });

      // copyFrom — quick contact-from-passport convenience: copy the cleaned digits as initial phone tail.
      // (Pure example of copyFrom; only triggers when contactPhone empty AND passport present.)
      copyFrom(path.firstName, path.fullName, {
        when: () => false, // disable real copy — fullName is computed via watchField below
      });

      // ----- watchField computed (1) initialPayment <= propertyValue clamp + recompute principal helper -----
      // We don't change initialPayment from itself; we only react to propertyValue:
      // if initialPayment exceeds new propertyValue, clamp it.
      watchField(
        path.propertyValue,
        (val, ctx) => {
          const ip = ctx.form.initialPayment.getValue() as number;
          if (typeof val === 'number' && val > 0 && typeof ip === 'number' && ip > val) {
            if (ctx.form.initialPayment.getValue() !== val) ctx.form.initialPayment.setValue(val);
          }
        },
        { immediate: false }
      );

      // (2) interestRate from loanType
      watchField(
        path.loanType,
        (val, ctx) => {
          const next = rateForLoanType((val ?? '') as string);
          if (ctx.form.interestRate.getValue() !== next) ctx.form.interestRate.setValue(next);
        },
        { immediate: false }
      );

      // (3) monthlyPayment = PMT(loanAmount-initialPayment for mortgage, otherwise loanAmount; rate; term)
      const recomputeMonthlyPayment = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
        const loanType = ctx.form.loanType.getValue() as string;
        const loanAmount = (ctx.form.loanAmount.getValue() as number) || 0;
        const initialPayment = (ctx.form.initialPayment.getValue() as number) || 0;
        const term = (ctx.form.loanTerm.getValue() as number) || 0;
        const rate = (ctx.form.interestRate.getValue() as number) || 0;
        const principal =
          loanType === 'mortgage' ? Math.max(0, loanAmount - initialPayment) : loanAmount;
        const next = calcMonthlyPayment(principal, rate, term);
        if (ctx.form.monthlyPayment.getValue() !== next) ctx.form.monthlyPayment.setValue(next);
      };
      watchField(path.loanAmount, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
      watchField(path.loanTerm, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
      watchField(path.interestRate, (_v, ctx) => recomputeMonthlyPayment(ctx), {
        immediate: false,
      });
      watchField(path.initialPayment, (_v, ctx) => recomputeMonthlyPayment(ctx), {
        immediate: false,
      });

      // (4) fullName = lastName + firstName + middleName
      const recomputeFullName = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
        const ln = ((ctx.form.lastName.getValue() as string) || '').trim();
        const fn = ((ctx.form.firstName.getValue() as string) || '').trim();
        const mn = ((ctx.form.middleName.getValue() as string) || '').trim();
        const next = [ln, fn, mn].filter(Boolean).join(' ');
        if (ctx.form.fullName.getValue() !== next) ctx.form.fullName.setValue(next);
      };
      watchField(path.lastName, (_v, ctx) => recomputeFullName(ctx), { immediate: false });
      watchField(path.firstName, (_v, ctx) => recomputeFullName(ctx), { immediate: false });
      watchField(path.middleName, (_v, ctx) => recomputeFullName(ctx), { immediate: false });

      // (5) age — single watcher on birthDate
      watchField(
        path.birthDate,
        (val, ctx) => {
          const next = calcAge((val ?? '') as string);
          if (ctx.form.age.getValue() !== next) ctx.form.age.setValue(next);
        },
        { immediate: false }
      );

      // (6) totalIncome — sum salary or revenue + additional + co-borrowers' total
      const recomputeTotalIncome = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
        const status = ctx.form.employmentStatus.getValue() as string;
        const salary = (ctx.form.monthlySalary.getValue() as number) || 0;
        const revenue = (ctx.form.monthlyRevenue.getValue() as number) || 0;
        const additional = (ctx.form.additionalIncome.getValue() as number) || 0;
        const coIncome = (ctx.form.coBorrowersIncome.getValue() as number) || 0;
        const employed = status === 'employed' ? salary : 0;
        const self = status === 'selfEmployed' ? revenue : 0;
        const next = round2(employed + self + additional + coIncome);
        if (ctx.form.totalIncome.getValue() !== next) ctx.form.totalIncome.setValue(next);
      };
      watchField(path.monthlySalary, (_v, ctx) => recomputeTotalIncome(ctx), { immediate: false });
      watchField(path.monthlyRevenue, (_v, ctx) => recomputeTotalIncome(ctx), { immediate: false });
      watchField(path.additionalIncome, (_v, ctx) => recomputeTotalIncome(ctx), {
        immediate: false,
      });
      watchField(path.employmentStatus, (_v, ctx) => recomputeTotalIncome(ctx), {
        immediate: false,
      });
      watchField(path.coBorrowersIncome, (_v, ctx) => recomputeTotalIncome(ctx), {
        immediate: false,
      });

      // (7) paymentToIncomeRatio = monthlyPayment / totalIncome * 100
      const recomputePTI = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
        const payment = (ctx.form.monthlyPayment.getValue() as number) || 0;
        const income = (ctx.form.totalIncome.getValue() as number) || 0;
        const next = income > 0 ? round2((payment / income) * 100) : 0;
        if (ctx.form.paymentToIncomeRatio.getValue() !== next)
          ctx.form.paymentToIncomeRatio.setValue(next);
      };
      watchField(path.monthlyPayment, (_v, ctx) => recomputePTI(ctx), { immediate: false });
      watchField(path.totalIncome, (_v, ctx) => recomputePTI(ctx), { immediate: false });

      // (8) coBorrowersIncome = sum of coBorrowers[].monthlyIncome (when hasCoBorrower)
      watchField(
        path.coBorrowers,
        (val, ctx) => {
          const has = ctx.form.hasCoBorrower.getValue() as boolean;
          const arr = (val ?? []) as CreditApplicationForm['coBorrowers'];
          const sum = has ? arr.reduce((acc, x) => acc + (Number(x?.monthlyIncome) || 0), 0) : 0;
          const next = round2(sum);
          if (ctx.form.coBorrowersIncome.getValue() !== next)
            ctx.form.coBorrowersIncome.setValue(next);
        },
        { immediate: false }
      );
      watchField(
        path.hasCoBorrower,
        (val, ctx) => {
          if (val !== true) {
            if (ctx.form.coBorrowersIncome.getValue() !== 0) ctx.form.coBorrowersIncome.setValue(0);
          } else {
            const arr =
              (ctx.form.coBorrowers.getValue() as CreditApplicationForm['coBorrowers']) ?? [];
            const sum = round2(arr.reduce((acc, x) => acc + (Number(x?.monthlyIncome) || 0), 0));
            if (ctx.form.coBorrowersIncome.getValue() !== sum)
              ctx.form.coBorrowersIncome.setValue(sum);
          }
        },
        { immediate: false }
      );
    }) as never,
  } as never) as FormProxy<CreditApplicationForm>;
}
