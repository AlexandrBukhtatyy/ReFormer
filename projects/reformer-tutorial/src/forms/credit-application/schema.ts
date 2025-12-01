import type { FormSchema } from 'reformer';
import type { CreditApplicationForm } from './type';

// Импорт схем из шагов
import { loanInfoSchema } from './steps/loan-info/schema';
import { personalInfoSchema } from './steps/personal-info/schema';
import { contactInfoSchema } from './steps/contact-info/schema';
import { employmentSchema } from './steps/employment/schema';
import { additionalInfoSchema } from './steps/additional-info/schema';
import { confirmationSchema } from './steps/confirmation/schema';

// Импорт computed поля схем
import { Input } from '@/components/ui/input';

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ============================================================================
  // Шаг 1: Основная информация о кредите
  // ============================================================================
  ...loanInfoSchema,

  // ============================================================================
  // Шаг 2: Персональные данные
  // ============================================================================
  ...personalInfoSchema,

  // ============================================================================
  // Шаг 3: Контактная информация
  // ============================================================================
  ...contactInfoSchema,

  // ============================================================================
  // Шаг 4: Информация о занятости
  // ============================================================================
  ...employmentSchema,

  // ============================================================================
  // Шаг 5: Дополнительная информация
  // ============================================================================
  ...additionalInfoSchema,

  // ============================================================================
  // Шаг 6: Согласия
  // ============================================================================
  ...confirmationSchema,

  // ============================================================================
  // Вычисляемые поля
  // ============================================================================
  interestRate: {
    value: 0,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', disabled: true },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж', disabled: true },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', disabled: true },
  },
  age: {
    value: null,
    component: Input,
    componentProps: { label: 'Возраст', disabled: true },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход', disabled: true },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: { label: 'Платёж/Доход (%)', disabled: true },
  },
};
