import { computeFrom, disableWhen, revalidateWhen, watchField } from '@reformer/core/behaviors';
import type { BehaviorSchemaFn } from '@reformer/core/behaviors';
import type { FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from './type';

// Импорт behaviors для каждого шага
import { loanBehaviorSchema } from './steps/loan-info/behaviors';
import { personalBehaviorSchema } from './steps/personal-info/behaviors';
import { contactBehaviorSchema } from './steps/contact-info/behaviors';
import { employmentBehaviorSchema } from './steps/employment/behaviors';
import { additionalBehaviorSchema } from './steps/additional-info/behaviors';

/**
 * Кросс-шаговые поведения
 *
 * Поведения, которые охватывают несколько шагов формы:
 * - Соотношение платежа к доходу
 * - Ревалидация платежа при изменении дохода
 * - Контроль доступа по возрасту
 * - Аналитика
 */
const crossStepBehaviorsSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Соотношение платежа к доходу
  // ==========================================
  computeFrom(
    [path.monthlyPayment, path.totalIncome, path.coBorrowersIncome],
    path.paymentToIncomeRatio,
    (values) => {
      const payment = values.monthlyPayment as number;
      const mainIncome = values.totalIncome as number;
      const coIncome = values.coBorrowersIncome as number;

      const totalHouseholdIncome = (mainIncome || 0) + (coIncome || 0);
      if (!totalHouseholdIncome || !payment) return 0;

      return Math.round((payment / totalHouseholdIncome) * 100);
    }
  );

  // Отключить paymentToIncomeRatio (только для чтения)
  disableWhen(path.paymentToIncomeRatio, () => true);

  // ==========================================
  // Ревалидация платежа при изменении дохода
  // ==========================================
  revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);

  // ==========================================
  // Контроль доступа по возрасту
  // Поля кредита отключены если возраст < 18
  // ==========================================
  disableWhen(path.loanAmount, (form) => {
    const age = form.age as number | null;
    return age !== null && age < 18;
  });
  disableWhen(path.loanTerm, (form) => {
    const age = form.age as number | null;
    return age !== null && age < 18;
  });
  disableWhen(path.loanPurpose, (form) => {
    const age = form.age as number | null;
    return age !== null && age < 18;
  });

  // ==========================================
  // Аналитика
  // ==========================================
  watchField(path.loanAmount, (value) => {
    console.log('Loan amount changed:', value);
  });

  watchField(path.interestRate, (value) => {
    console.log('Interest rate computed:', value);
  });

  watchField(path.employmentStatus, (value) => {
    console.log('Employment status changed:', value);
  });
};

/**
 * Полная схема поведений для формы заявки на кредит
 *
 * Организована по шагам формы для удобства поддержки:
 * - Шаг 1: Информация о кредите
 * - Шаг 2: Персональная информация
 * - Шаг 3: Контактная информация
 * - Шаг 4: Занятость
 * - Шаг 5: Дополнительная информация
 * - Кросс-шаговые: Поведения, охватывающие несколько шагов
 */
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Шаг 1: Информация о кредите
  // ==========================================
  loanBehaviorSchema(path);

  // ==========================================
  // Шаг 2: Персональная информация
  // ==========================================
  personalBehaviorSchema(path);

  // ==========================================
  // Шаг 3: Контактная информация
  // ==========================================
  contactBehaviorSchema(path);

  // ==========================================
  // Шаг 4: Занятость
  // ==========================================
  employmentBehaviorSchema(path);

  // ==========================================
  // Шаг 5: Дополнительная информация
  // ==========================================
  additionalBehaviorSchema(path);

  // ==========================================
  // Кросс-шаговые поведения
  // ==========================================
  crossStepBehaviorsSchema(path);
};
